import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { RoomEvent } from "livekit-client";
import { useLiveKitStore } from "../stores/liveKit";
import { useLiveKit } from "./useLiveKit";

const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockDisconnect = vi.fn().mockResolvedValue(undefined);

type MockRoomInstance = {
  remoteParticipants: Map<string, { identity: string }>;
  on: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  _handlers: Map<string, (...args: unknown[]) => void>;
};

let lastRoom: MockRoomInstance | null = null;

vi.mock("livekit-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("livekit-client")>();
  return {
    ...actual,
    Room: class MockRoom {
      remoteParticipants = new Map<string, { identity: string }>();
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
    lastRoom!.remoteParticipants.set("a", { identity: "a" });
    const fn = lastRoom!._handlers.get(RoomEvent.ParticipantConnected);
    expect(fn).toBeDefined();
    fn!();
    expect(lk.remoteParticipants.value.get("a")).toEqual({ identity: "a" });
  });
});
