import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import type { SuitedTile } from "@mahjong-game/shared";

const connectMock = vi.fn().mockResolvedValue(undefined);
const disconnectMock = vi.fn().mockResolvedValue(undefined);

vi.mock("./useLiveKit", () => ({
  useLiveKit: () => ({
    connect: connectMock,
    disconnect: disconnectMock,
  }),
}));

import { useRoomConnection } from "./useRoomConnection";

describe("useRoomConnection LiveKit token retry (6B.5)", () => {
  const OriginalWebSocket = globalThis.WebSocket;
  let messageHandler: ((ev: MessageEvent) => void) | null = null;
  const sentPayloads: unknown[] = [];

  beforeEach(() => {
    setActivePinia(createPinia());
    messageHandler = null;
    sentPayloads.length = 0;
    connectMock.mockClear();
    disconnectMock.mockClear();
    connectMock.mockResolvedValue(undefined);
    globalThis.WebSocket = class {
      static readonly CONNECTING = 0;
      static readonly OPEN = 1;
      static readonly CLOSING = 2;
      static readonly CLOSED = 3;
      readonly readyState = WebSocket.OPEN;
      send = vi.fn((raw: string) => {
        try {
          sentPayloads.push(JSON.parse(raw));
        } catch {
          sentPayloads.push(raw);
        }
      });
      addEventListener(type: string, listener: EventListener) {
        if (type === "open") {
          queueMicrotask(() => listener.call(this, new Event("open")));
        }
        if (type === "message") {
          messageHandler = listener as (ev: MessageEvent) => void;
        }
      }
      removeEventListener() {}
      close() {}
    } as unknown as typeof WebSocket;
  });

  afterEach(() => {
    globalThis.WebSocket = OriginalWebSocket;
    vi.restoreAllMocks();
  });

  function dispatchServerMessage(data: Record<string, unknown>): void {
    messageHandler?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  function playState(): Record<string, unknown> {
    const t1: SuitedTile = { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 };
    return {
      roomId: "r",
      roomCode: "ABC12",
      gamePhase: "play",
      players: [],
      myPlayerId: "player-1",
      myRack: [t1],
      exposedGroups: {},
      discardPools: {},
      wallRemaining: 10,
      currentTurn: "player-0",
      turnPhase: "draw",
      callWindow: null,
      scores: {},
      lastDiscard: null,
      gameResult: null,
      pendingMahjong: null,
      challengeState: null,
      socialOverrideState: null,
      tableTalkReportState: null,
      tableTalkReportCountsByPlayerId: {},
      charleston: null,
      shownHands: {},
      jokerRulesMode: "standard",
      myDeadHand: false,
      paused: false,
    };
  }

  function requestTokenCount(): number {
    return sentPayloads.filter(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        (p as { type?: string }).type === "REQUEST_LIVEKIT_TOKEN",
    ).length;
  }

  it("sends REQUEST_LIVEKIT_TOKEN only once across STATE_UPDATEs until retryLiveKitConnection", async () => {
    const conn = useRoomConnection();
    conn.connect("ABC12", "TestUser");
    await Promise.resolve();

    dispatchServerMessage({
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state: playState(),
    });
    expect(requestTokenCount()).toBe(1);

    dispatchServerMessage({
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state: playState(),
    });
    expect(requestTokenCount()).toBe(1);

    const p = conn.retryLiveKitConnection();
    await Promise.resolve();
    expect(requestTokenCount()).toBe(2);
    dispatchServerMessage({
      version: PROTOCOL_VERSION,
      type: "LIVEKIT_TOKEN",
      token: "jwt",
      url: "wss://lk.example/ws",
    });
    await p;
    expect(connectMock).toHaveBeenCalled();
  });

  it("retryLiveKitConnection resolves true when livekit_token and connect succeed", async () => {
    const conn = useRoomConnection();
    conn.connect("ABC12", "TestUser");
    await Promise.resolve();

    dispatchServerMessage({
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state: playState(),
    });

    const resultPromise = conn.retryLiveKitConnection();
    await Promise.resolve();
    dispatchServerMessage({
      version: PROTOCOL_VERSION,
      type: "LIVEKIT_TOKEN",
      token: "jwt",
      url: "wss://lk.example/ws",
    });
    await expect(resultPromise).resolves.toBe(true);
  });

  it("retryLiveKitConnection resolves false when connect throws", async () => {
    connectMock.mockRejectedValueOnce(new Error("boom"));
    const conn = useRoomConnection();
    conn.connect("ABC12", "TestUser");
    await Promise.resolve();

    dispatchServerMessage({
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state: playState(),
    });

    const resultPromise = conn.retryLiveKitConnection();
    await Promise.resolve();
    dispatchServerMessage({
      version: PROTOCOL_VERSION,
      type: "LIVEKIT_TOKEN",
      token: "jwt",
      url: "wss://lk.example/ws",
    });
    await expect(resultPromise).resolves.toBe(false);
  });

  it("retryLiveKitConnection resolves false if no LIVEKIT_TOKEN within timeout", async () => {
    vi.useFakeTimers();
    const conn = useRoomConnection();
    conn.connect("ABC12", "TestUser");
    await Promise.resolve();

    dispatchServerMessage({
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state: playState(),
    });

    const resultPromise = conn.retryLiveKitConnection();
    await vi.advanceTimersByTimeAsync(10_001);
    await expect(resultPromise).resolves.toBe(false);
    vi.useRealTimers();
  });

  it("after timeout, a new retryLiveKitConnection attempt can still succeed", async () => {
    vi.useFakeTimers();
    const conn = useRoomConnection();
    conn.connect("ABC12", "TestUser");
    await Promise.resolve();

    dispatchServerMessage({
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state: playState(),
    });

    const first = conn.retryLiveKitConnection();
    await vi.advanceTimersByTimeAsync(10_001);
    await expect(first).resolves.toBe(false);

    const second = conn.retryLiveKitConnection();
    await Promise.resolve();
    dispatchServerMessage({
      version: PROTOCOL_VERSION,
      type: "LIVEKIT_TOKEN",
      token: "jwt2",
      url: "wss://lk.example/ws",
    });
    await expect(second).resolves.toBe(true);
    vi.useRealTimers();
  });
});
