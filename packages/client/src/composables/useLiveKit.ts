import type { Ref, ShallowRef } from "vue";
import { ref, shallowRef } from "vue";
import { storeToRefs } from "pinia";
import { Room, RoomEvent } from "livekit-client";
import type { LiveKitConnectionStatus } from "../stores/liveKit";
import { useLiveKitStore } from "../stores/liveKit";

const room = shallowRef<Room | null>(null);
const remoteParticipants = ref<Map<string, unknown>>(new Map());
const error = ref<string | null>(null);

function syncRemoteParticipants(r: Room): void {
  remoteParticipants.value = new Map(r.remoteParticipants);
}

export type UseLiveKitReturn = {
  connectionStatus: Ref<LiveKitConnectionStatus>;
  /** LiveKit `Room` instance — typed as unknown for declaration emit (SDK pulls deep internal types). */
  room: ShallowRef<unknown>;
  /** Remote identities from `Room.remoteParticipants` (SDK participant type omitted for emit portability). */
  remoteParticipants: Ref<Map<string, unknown>>;
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

    r.on(RoomEvent.ParticipantConnected, () => {
      syncRemoteParticipants(r);
    });
    r.on(RoomEvent.ParticipantDisconnected, () => {
      syncRemoteParticipants(r);
    });
    r.on(RoomEvent.Reconnecting, () => {
      store.setConnectionStatus("connecting");
    });
    r.on(RoomEvent.Reconnected, () => {
      store.setConnectionStatus("connected");
      syncRemoteParticipants(r);
    });
    r.on(RoomEvent.Disconnected, () => {
      store.setConnectionStatus("disconnected");
    });

    try {
      await r.connect(trimmedUrl, tokenStr, { autoSubscribe: true });
      store.setConnectionStatus("connected");
      syncRemoteParticipants(r);
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
    }
  }

  function cleanup(): void {
    void disconnect();
  }

  return {
    connectionStatus,
    room: room as ShallowRef<unknown>,
    remoteParticipants,
    error,
    connect,
    disconnect,
    cleanup,
  };
}
