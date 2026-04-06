import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { RoomEvent, Track } from "livekit-client";
import { useLiveKitStore } from "../stores/liveKit";
import { useLiveKit } from "./useLiveKit";

const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockDisconnect = vi.fn().mockResolvedValue(undefined);

type MockRoomInstance = {
  remoteParticipants: Map<
    string,
    { identity: string; getTrackPublication?: ReturnType<typeof vi.fn> }
  >;
  localParticipant: {
    identity: string;
    getTrackPublication: ReturnType<typeof vi.fn>;
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
      localParticipant = {
        identity: "local",
        getTrackPublication: vi.fn(() => mockLocalCameraPublication ?? undefined),
      };
      _handlers = new Map<string, (...args: unknown[]) => void>();
      on = vi.fn((event: string, fn: (...args: unknown[]) => void) => {
        this._handlers.set(event, fn);
      });
      connect = mockConnect;
      disconnect = mockDisconnect;
      constructor() {
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
});
