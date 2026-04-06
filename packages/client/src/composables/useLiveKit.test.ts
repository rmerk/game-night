import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { RoomEvent, Track } from "livekit-client";
import { useLiveKitStore } from "../stores/liveKit";
import { useLiveKit } from "./useLiveKit";

const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockDisconnect = vi.fn().mockResolvedValue(undefined);

const { micPerm, camPerm } = vi.hoisted(() => {
  const { ref } = require("vue") as typeof import("vue");
  return {
    micPerm: ref<PermissionState | "">(""),
    camPerm: ref<PermissionState | "">(""),
  };
});

vi.mock("@vueuse/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  return {
    ...actual,
    usePermission: (name: string) => (name === "microphone" ? micPerm : camPerm),
  };
});

type MockRoomInstance = {
  remoteParticipants: Map<
    string,
    { identity: string; getTrackPublication?: ReturnType<typeof vi.fn> }
  >;
  localParticipant: {
    identity: string;
    isMicrophoneEnabled: boolean;
    isCameraEnabled: boolean;
    getTrackPublication: ReturnType<typeof vi.fn>;
    setMicrophoneEnabled: ReturnType<typeof vi.fn>;
    setCameraEnabled: ReturnType<typeof vi.fn>;
    enableCameraAndMicrophone: ReturnType<typeof vi.fn>;
  };
  on: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  _handlers: Map<string, (...args: unknown[]) => void>;
};

let lastRoom: MockRoomInstance | null = null;

/** Set before `connect()` so `syncVideoStateFromRoom` sees a camera publication. */
let mockLocalCameraPublication: {
  source: (typeof Track)["Source"]["Camera"];
  videoTrack: unknown;
  isMuted: boolean;
} | null = null;

vi.mock("livekit-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("livekit-client")>();
  return {
    ...actual,
    Room: class MockRoom {
      remoteParticipants = new Map<
        string,
        { identity: string; getTrackPublication?: ReturnType<typeof vi.fn> }
      >();
      localParticipant: MockRoomInstance["localParticipant"];
      _handlers = new Map<string, (...args: unknown[]) => void>();
      on = vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        this._handlers.set(event, fn);
      });
      connect = mockConnect;
      disconnect = mockDisconnect;
      constructor() {
        const lp: MockRoomInstance["localParticipant"] = {
          identity: "local",
          isMicrophoneEnabled: false,
          isCameraEnabled: false,
          getTrackPublication: vi.fn(() => mockLocalCameraPublication ?? undefined),
          setMicrophoneEnabled: vi.fn(async (enabled: boolean) => {
            lp.isMicrophoneEnabled = enabled;
          }),
          setCameraEnabled: vi.fn(async (enabled: boolean) => {
            lp.isCameraEnabled = enabled;
          }),
          enableCameraAndMicrophone: vi.fn(async () => {
            lp.isMicrophoneEnabled = true;
            lp.isCameraEnabled = true;
          }),
        };
        this.localParticipant = lp;
        // oxlint-disable-next-line @typescript-eslint/no-this-alias -- capture mock instance for event tests
        lastRoom = this;
      }
    },
  };
});

describe("useLiveKit", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockLocalCameraPublication = null;
    mockConnect.mockResolvedValue(undefined);
    mockDisconnect.mockResolvedValue(undefined);
    micPerm.value = "";
    camPerm.value = "";
    await useLiveKit().disconnect();
  });

  it("connect with valid token and url reaches connected status", async () => {
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    expect(useLiveKitStore().connectionStatus).toBe("connected");
    expect(mockConnect).toHaveBeenCalledWith(
      "wss://example.livekit.cloud",
      "fake-token",
      expect.objectContaining({ autoSubscribe: true }),
    );
  });

  it("connect with empty url sets failed and does not call Room.connect", async () => {
    const lk = useLiveKit();
    await lk.connect("t", "   ");
    expect(useLiveKitStore().connectionStatus).toBe("failed");
    expect(mockConnect).not.toHaveBeenCalled();
  });

  it("disconnect resets store to idle", async () => {
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    await lk.disconnect();
    expect(useLiveKitStore().connectionStatus).toBe("idle");
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("connect failure sets status to failed with error message and cleans up", async () => {
    mockConnect.mockRejectedValueOnce(new Error("token expired"));
    const lk = useLiveKit();
    await lk.connect("bad-token", "wss://example.livekit.cloud");
    expect(useLiveKitStore().connectionStatus).toBe("failed");
    expect(lk.error.value).toBe("token expired");
    expect(lk.room.value).toBeNull();
    expect(lk.remoteParticipants.value.size).toBe(0);
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it("participant handlers sync remoteParticipants from the room map", async () => {
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    lastRoom!.remoteParticipants.set("a", {
      identity: "a",
      getTrackPublication: vi.fn().mockReturnValue(undefined),
    });
    const fn = lastRoom!._handlers.get(RoomEvent.ParticipantConnected);
    expect(fn).toBeDefined();
    fn!();
    expect(lk.remoteParticipants.value.get("a")).toEqual({
      identity: "a",
      getTrackPublication: expect.any(Function),
    });
  });

  it("syncs participantVideoByIdentity from room after connect", async () => {
    const mockVideo = { kind: Track.Kind.Video };
    mockLocalCameraPublication = {
      source: Track.Source.Camera,
      videoTrack: mockVideo,
      isMuted: false,
    };
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    expect(lk.participantVideoByIdentity.value.get("local")).toEqual({
      videoTrack: mockVideo,
      isCameraEnabled: true,
    });
  });

  it("TrackSubscribed updates participant video state", async () => {
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    const mockTrack = { kind: Track.Kind.Video };
    const mockPub = {
      source: Track.Source.Camera,
      isMuted: false,
    };
    const mockParticipant = { identity: "p1" };
    const fn = lastRoom!._handlers.get(RoomEvent.TrackSubscribed);
    expect(fn).toBeDefined();
    fn!(mockTrack, mockPub, mockParticipant);
    expect(lk.participantVideoByIdentity.value.get("p1")).toEqual({
      videoTrack: mockTrack,
      isCameraEnabled: true,
    });
  });

  it("TrackUnsubscribed clears participant video state", async () => {
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    const mockTrack = { kind: Track.Kind.Video };
    const mockPub = { source: Track.Source.Camera, isMuted: false };
    const mockParticipant = { identity: "p1" };
    lastRoom!._handlers.get(RoomEvent.TrackSubscribed)!(mockTrack, mockPub, mockParticipant);
    lastRoom!._handlers.get(RoomEvent.TrackUnsubscribed)!(mockTrack, mockPub, mockParticipant);
    expect(lk.participantVideoByIdentity.value.get("p1")).toEqual({
      videoTrack: null,
      isCameraEnabled: false,
    });
  });

  it("ActiveSpeakersChanged updates activeSpeakers set", async () => {
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    const fn = lastRoom!._handlers.get(RoomEvent.ActiveSpeakersChanged);
    expect(fn).toBeDefined();
    fn!([{ identity: "a" }, { identity: "b" }]);
    expect(lk.activeSpeakers.value.has("a")).toBe(true);
    expect(lk.activeSpeakers.value.has("b")).toBe(true);
  });

  it("TrackMuted sets isCameraEnabled false while preserving track", async () => {
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    const mockTrack = { kind: Track.Kind.Video };
    const mockPub = { source: Track.Source.Camera, isMuted: false };
    const mockParticipant = { identity: "p1" };
    lastRoom!._handlers.get(RoomEvent.TrackSubscribed)!(mockTrack, mockPub, mockParticipant);
    expect(lk.participantVideoByIdentity.value.get("p1")?.isCameraEnabled).toBe(true);
    lastRoom!._handlers.get(RoomEvent.TrackMuted)!(
      { source: Track.Source.Camera },
      mockParticipant,
    );
    const state = lk.participantVideoByIdentity.value.get("p1");
    expect(state?.videoTrack).toEqual(mockTrack);
    expect(state?.isCameraEnabled).toBe(false);
  });

  it("TrackUnmuted restores isCameraEnabled to true", async () => {
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    const mockTrack = { kind: Track.Kind.Video };
    const mockPub = { source: Track.Source.Camera, isMuted: false };
    const mockParticipant = { identity: "p1" };
    lastRoom!._handlers.get(RoomEvent.TrackSubscribed)!(mockTrack, mockPub, mockParticipant);
    lastRoom!._handlers.get(RoomEvent.TrackMuted)!(
      { source: Track.Source.Camera },
      mockParticipant,
    );
    expect(lk.participantVideoByIdentity.value.get("p1")?.isCameraEnabled).toBe(false);
    lastRoom!._handlers.get(RoomEvent.TrackUnmuted)!(
      { source: Track.Source.Camera, videoTrack: mockTrack, isMuted: false },
      mockParticipant,
    );
    const state = lk.participantVideoByIdentity.value.get("p1");
    expect(state?.videoTrack).toEqual(mockTrack);
    expect(state?.isCameraEnabled).toBe(true);
  });

  it("LocalTrackPublished updates local participant video state", async () => {
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    const mockTrack = { kind: Track.Kind.Video };
    const localParticipant = lastRoom!.localParticipant;
    lastRoom!._handlers.get(RoomEvent.LocalTrackPublished)!(
      { source: Track.Source.Camera, videoTrack: mockTrack, isMuted: false },
      localParticipant,
    );
    const state = lk.participantVideoByIdentity.value.get("local");
    expect(state?.videoTrack).toEqual(mockTrack);
    expect(state?.isCameraEnabled).toBe(true);
  });

  it("LocalTrackUnpublished clears local participant video state", async () => {
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    const mockTrack = { kind: Track.Kind.Video };
    const localParticipant = lastRoom!.localParticipant;
    lastRoom!._handlers.get(RoomEvent.LocalTrackPublished)!(
      { source: Track.Source.Camera, videoTrack: mockTrack, isMuted: false },
      localParticipant,
    );
    lastRoom!._handlers.get(RoomEvent.LocalTrackUnpublished)!(
      { source: Track.Source.Camera },
      localParticipant,
    );
    const state = lk.participantVideoByIdentity.value.get("local");
    expect(state?.videoTrack).toBeNull();
    expect(state?.isCameraEnabled).toBe(false);
  });

  it("disconnect clears participantVideoByIdentity and activeSpeakers", async () => {
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    lastRoom!._handlers.get(RoomEvent.ActiveSpeakersChanged)!([{ identity: "x" }]);
    await lk.disconnect();
    expect(lk.participantVideoByIdentity.value.size).toBe(0);
    expect(lk.activeSpeakers.value.size).toBe(0);
  });

  it("disconnect clears localMicEnabled and localCameraEnabled", async () => {
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    lastRoom!.localParticipant.isMicrophoneEnabled = true;
    lastRoom!.localParticipant.isCameraEnabled = true;
    lk.localMicEnabled.value = true;
    lk.localCameraEnabled.value = true;
    await lk.disconnect();
    expect(lk.localMicEnabled.value).toBe(false);
    expect(lk.localCameraEnabled.value).toBe(false);
  });

  it("toggleMic calls setMicrophoneEnabled and syncs localMicEnabled", async () => {
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    expect(lk.localMicEnabled.value).toBe(false);
    await lk.toggleMic();
    expect(lastRoom!.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    expect(lk.localMicEnabled.value).toBe(true);
    await lk.toggleMic();
    expect(lastRoom!.localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(false);
    expect(lk.localMicEnabled.value).toBe(false);
  });

  it("toggleCamera calls setCameraEnabled and syncs localCameraEnabled", async () => {
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    expect(lk.localCameraEnabled.value).toBe(false);
    await lk.toggleCamera();
    expect(lastRoom!.localParticipant.setCameraEnabled).toHaveBeenCalledWith(true);
    expect(lk.localCameraEnabled.value).toBe(true);
  });

  it("requestPermissions calls enableCameraAndMicrophone and returns granted", async () => {
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    const result = await lk.requestPermissions();
    expect(result).toBe("granted");
    expect(lastRoom!.localParticipant.enableCameraAndMicrophone).toHaveBeenCalled();
    expect(lk.localMicEnabled.value).toBe(true);
    expect(lk.localCameraEnabled.value).toBe(true);
  });

  it("requestPermissions does not call enableCameraAndMicrophone when browser permission is denied", async () => {
    micPerm.value = "denied";
    camPerm.value = "denied";
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    const result = await lk.requestPermissions();
    expect(result).toBe("denied");
    expect(lastRoom!.localParticipant.enableCameraAndMicrophone).not.toHaveBeenCalled();
  });

  it("LocalTrackPublished for microphone syncs localMicEnabled from participant", async () => {
    const lk = useLiveKit();
    await lk.connect("fake-token", "wss://example.livekit.cloud");
    lastRoom!.localParticipant.isMicrophoneEnabled = true;
    lastRoom!._handlers.get(RoomEvent.LocalTrackPublished)!(
      { source: Track.Source.Microphone },
      lastRoom!.localParticipant,
    );
    expect(lk.localMicEnabled.value).toBe(true);
  });

  it("avPermissionState is granted only when both mic and camera are granted", async () => {
    const lk = useLiveKit();
    micPerm.value = "granted";
    camPerm.value = "granted";
    expect(lk.avPermissionState.value).toBe("granted");
  });

  it("avPermissionState is denied if either permission is denied", async () => {
    const lk = useLiveKit();
    micPerm.value = "denied";
    camPerm.value = "prompt";
    expect(lk.avPermissionState.value).toBe("denied");
  });

  it("avPermissionState is prompt when either is prompt and none denied", async () => {
    const lk = useLiveKit();
    micPerm.value = "prompt";
    camPerm.value = "granted";
    expect(lk.avPermissionState.value).toBe("prompt");
  });

  it("avPermissionState is unknown when both are empty", async () => {
    const lk = useLiveKit();
    micPerm.value = "";
    camPerm.value = "";
    expect(lk.avPermissionState.value).toBe("unknown");
  });
});
