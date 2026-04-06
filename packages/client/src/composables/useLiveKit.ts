import type { Ref, ShallowRef } from "vue";
import { ref, shallowRef } from "vue";
import { storeToRefs } from "pinia";
import type { LocalParticipant, RemoteParticipant } from "livekit-client";
import { Room, RoomEvent, Track } from "livekit-client";
import type { LiveKitConnectionStatus } from "../stores/liveKit";
import { useLiveKitStore } from "../stores/liveKit";

const room = shallowRef<Room | null>(null);
const remoteParticipants = ref<Map<string, unknown>>(new Map());
const participantVideoByIdentity = ref<Map<string, ParticipantVideoState>>(new Map());
const activeSpeakers = ref<Set<string>>(new Set());
const error = ref<string | null>(null);

/** Camera preview state per LiveKit identity (= app player id). Tracks are `unknown` for declaration emit portability. */
export type ParticipantVideoState = {
  /** `null` when no camera track (still typed as `unknown` for declaration emit). */
  videoTrack: unknown;
  isCameraEnabled: boolean;
};

function syncRemoteParticipants(r: Room): void {
  remoteParticipants.value = new Map(r.remoteParticipants);
}

function syncVideoStateFromRoom(r: Room): void {
  const next = new Map<string, ParticipantVideoState>();

  const add = (participant: LocalParticipant | RemoteParticipant): void => {
    const pub = participant.getTrackPublication(Track.Source.Camera);
    if (pub?.videoTrack) {
      next.set(participant.identity, {
        videoTrack: pub.videoTrack,
        isCameraEnabled: !pub.isMuted,
      });
    } else {
      next.set(participant.identity, { videoTrack: null, isCameraEnabled: false });
    }
  };

  add(r.localParticipant);
  for (const [, p] of r.remoteParticipants) {
    add(p);
  }
  participantVideoByIdentity.value = next;
}

function patchParticipantVideo(identity: string, state: ParticipantVideoState): void {
  const m = new Map(participantVideoByIdentity.value);
  m.set(identity, state);
  participantVideoByIdentity.value = m;
}

function registerRoomVideoHandlers(r: Room): void {
  r.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
    if (publication.source !== Track.Source.Camera || track.kind !== Track.Kind.Video) {
      return;
    }
    patchParticipantVideo(participant.identity, {
      videoTrack: track,
      isCameraEnabled: !publication.isMuted,
    });
  });

  r.on(RoomEvent.TrackUnsubscribed, (_track, publication, participant) => {
    if (publication.source !== Track.Source.Camera) {
      return;
    }
    patchParticipantVideo(participant.identity, { videoTrack: null, isCameraEnabled: false });
  });

  r.on(RoomEvent.LocalTrackPublished, (publication, participant) => {
    if (publication.source !== Track.Source.Camera) {
      return;
    }
    const vt = publication.videoTrack;
    patchParticipantVideo(participant.identity, {
      videoTrack: vt ?? null,
      isCameraEnabled: Boolean(vt && !publication.isMuted),
    });
  });

  r.on(RoomEvent.LocalTrackUnpublished, (publication, participant) => {
    if (publication.source !== Track.Source.Camera) {
      return;
    }
    patchParticipantVideo(participant.identity, { videoTrack: null, isCameraEnabled: false });
  });

  r.on(RoomEvent.TrackMuted, (publication, participant) => {
    if (publication.source !== Track.Source.Camera) {
      return;
    }
    const prev = participantVideoByIdentity.value.get(participant.identity);
    patchParticipantVideo(participant.identity, {
      videoTrack: prev?.videoTrack ?? null,
      isCameraEnabled: false,
    });
  });

  r.on(RoomEvent.TrackUnmuted, (publication, participant) => {
    if (publication.source !== Track.Source.Camera) {
      return;
    }
    const vt = publication.videoTrack;
    patchParticipantVideo(participant.identity, {
      videoTrack: vt ?? null,
      isCameraEnabled: Boolean(vt && !publication.isMuted),
    });
  });

  r.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
    activeSpeakers.value = new Set(speakers.map((p) => p.identity));
  });
}

export type UseLiveKitReturn = {
  connectionStatus: Ref<LiveKitConnectionStatus>;
  /** LiveKit `Room` instance — typed as unknown for declaration emit (SDK pulls deep internal types). */
  room: ShallowRef<unknown>;
  /** Remote identities from `Room.remoteParticipants` (SDK participant type omitted for emit portability). */
  remoteParticipants: Ref<Map<string, unknown>>;
  /** Camera track + enabled flag per participant identity (local + remote). */
  participantVideoByIdentity: Ref<Map<string, ParticipantVideoState>>;
  /** Identities currently considered active speakers (audio). */
  activeSpeakers: Ref<Set<string>>;
  error: Ref<string | null>;
  connect: (tokenStr: string, url: string) => Promise<void>;
  disconnect: () => Promise<void>;
  cleanup: () => void;
};

/**
 * LiveKit voice/video session. Module-level room instance so token handling and UI share one connection.
 * Failures are non-fatal for gameplay (NFR23).
 */
export function useLiveKit(): UseLiveKitReturn {
  const store = useLiveKitStore();
  const { connectionStatus } = storeToRefs(store);

  async function disconnect(): Promise<void> {
    if (room.value) {
      try {
        await room.value.disconnect();
      } catch {
        /* ignore */
      }
      room.value = null;
    }
    remoteParticipants.value = new Map();
    participantVideoByIdentity.value = new Map();
    activeSpeakers.value = new Set();
    error.value = null;
    store.setConnectionStatus("idle");
  }

  async function connect(tokenStr: string, url: string): Promise<void> {
    error.value = null;
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      store.setConnectionStatus("failed");
      error.value = "LiveKit URL missing";
      if (import.meta.env.DEV) {
        // oxlint-disable-next-line no-console -- dev-only visibility for missing VITE_LIVEKIT_URL
        console.warn("[useLiveKit] Missing LiveKit URL; skipping WebRTC connect");
      }
      return;
    }

    await disconnect();

    store.setToken(tokenStr, trimmedUrl);
    store.setConnectionStatus("connecting");

    const r = new Room({ adaptiveStream: true, dynacast: true });
    room.value = r;

    registerRoomVideoHandlers(r);

    r.on(RoomEvent.ParticipantConnected, () => {
      syncRemoteParticipants(r);
      syncVideoStateFromRoom(r);
    });
    r.on(RoomEvent.ParticipantDisconnected, () => {
      syncRemoteParticipants(r);
      syncVideoStateFromRoom(r);
    });
    r.on(RoomEvent.Reconnecting, () => {
      store.setConnectionStatus("connecting");
    });
    r.on(RoomEvent.Reconnected, () => {
      store.setConnectionStatus("connected");
      syncRemoteParticipants(r);
      syncVideoStateFromRoom(r);
    });
    r.on(RoomEvent.Disconnected, () => {
      store.setConnectionStatus("disconnected");
    });

    try {
      await r.connect(trimmedUrl, tokenStr, { autoSubscribe: true });
      store.setConnectionStatus("connected");
      syncRemoteParticipants(r);
      syncVideoStateFromRoom(r);
    } catch (e) {
      store.setConnectionStatus("failed");
      const msg = e instanceof Error ? e.message : String(e);
      error.value = msg;
      if (import.meta.env.DEV) {
        // oxlint-disable-next-line no-console -- dev-only; A/V failure is non-fatal (NFR23)
        console.warn("[useLiveKit] LiveKit connect failed", e);
      }
      try {
        await r.disconnect();
      } catch {
        /* ignore */
      }
      room.value = null;
      remoteParticipants.value = new Map();
      participantVideoByIdentity.value = new Map();
      activeSpeakers.value = new Set();
    }
  }

  function cleanup(): void {
    void disconnect();
  }

  return {
    connectionStatus,
    room: room as ShallowRef<unknown>,
    remoteParticipants,
    participantVideoByIdentity,
    activeSpeakers,
    error,
    connect,
    disconnect,
    cleanup,
  };
}
