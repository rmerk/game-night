import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  startLifecycleTimer,
  cancelLifecycleTimer,
  cancelAllLifecycleTimers,
  hasLifecycleTimer,
  setDisconnectTimeoutMs,
  setIdleTimeoutMs,
  setAbandonedTimeoutMs,
  DEFAULT_DISCONNECT_TIMEOUT_MS,
  DEFAULT_IDLE_TIMEOUT_MS,
  DEFAULT_ABANDONED_TIMEOUT_MS,
} from "./room-lifecycle";
import type { Room } from "./room";
import { createSilentTestLogger } from "../testing/silent-logger";

function createMockRoom(overrides?: Partial<Room>): Room {
  const base: Room = {
    roomId: "test-room-id",
    roomCode: "TEST01",
    hostToken: "host-token",
    players: new Map(),
    sessions: new Map(),
    tokenMap: new Map(),
    playerTokens: new Map(),
    graceTimers: new Map(),
    lifecycleTimers: new Map(),
    socialOverrideTimer: null,
    tableTalkReportTimer: null,
    gameState: null,
    jokerRulesMode: "standard",
    chatHistory: [],
    chatRateTimestamps: new Map(),
    reactionRateTimestamps: new Map(),
    paused: false,
    pausedAt: null,
    turnTimerConfig: { mode: "timed", durationMs: 20_000 },
    turnTimerHandle: null,
    turnTimerStage: null,
    turnTimerPlayerId: null,
    consecutiveTurnTimeouts: new Map(),
    afkVoteState: null,
    afkVoteCooldownPlayerIds: new Set(),
    deadSeatPlayerIds: new Set(),
    departedPlayerIds: new Set(),
    departureVoteState: null,
    createdAt: Date.now(),
    logger: createSilentTestLogger(),
  };
  return {
    ...base,
    ...overrides,
    socialOverrideTimer: overrides?.socialOverrideTimer ?? null,
    tableTalkReportTimer: overrides?.tableTalkReportTimer ?? null,
    turnTimerHandle: overrides?.turnTimerHandle ?? null,
    turnTimerStage: overrides?.turnTimerStage ?? null,
    turnTimerPlayerId: overrides?.turnTimerPlayerId ?? null,
  };
}

describe("room-lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setDisconnectTimeoutMs(DEFAULT_DISCONNECT_TIMEOUT_MS);
    setIdleTimeoutMs(DEFAULT_IDLE_TIMEOUT_MS);
    setAbandonedTimeoutMs(DEFAULT_ABANDONED_TIMEOUT_MS);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("startLifecycleTimer", () => {
    test("starts a disconnect-timeout timer that fires after 2 minutes", () => {
      const room = createMockRoom();
      const callback = vi.fn();

      startLifecycleTimer(room, "disconnect-timeout", callback);

      expect(hasLifecycleTimer(room, "disconnect-timeout")).toBe(true);
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(DEFAULT_DISCONNECT_TIMEOUT_MS);
      expect(callback).toHaveBeenCalledOnce();
    });

    test("starts an idle-timeout timer that fires after 5 minutes", () => {
      const room = createMockRoom();
      const callback = vi.fn();

      startLifecycleTimer(room, "idle-timeout", callback);

      expect(hasLifecycleTimer(room, "idle-timeout")).toBe(true);
      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS);
      expect(callback).toHaveBeenCalledOnce();
    });

    test("starts an abandoned-timeout timer that fires after 30 minutes", () => {
      const room = createMockRoom();
      const callback = vi.fn();

      startLifecycleTimer(room, "abandoned-timeout", callback);

      expect(hasLifecycleTimer(room, "abandoned-timeout")).toBe(true);
      vi.advanceTimersByTime(DEFAULT_ABANDONED_TIMEOUT_MS);
      expect(callback).toHaveBeenCalledOnce();
    });

    test("replaces existing timer of the same type", () => {
      const room = createMockRoom();
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      startLifecycleTimer(room, "disconnect-timeout", callback1);
      startLifecycleTimer(room, "disconnect-timeout", callback2);

      vi.advanceTimersByTime(DEFAULT_DISCONNECT_TIMEOUT_MS);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledOnce();
    });

    test("multiple timer types can coexist on same room", () => {
      const room = createMockRoom();
      const disconnectCb = vi.fn();
      const idleCb = vi.fn();
      const abandonedCb = vi.fn();

      startLifecycleTimer(room, "disconnect-timeout", disconnectCb);
      startLifecycleTimer(room, "idle-timeout", idleCb);
      startLifecycleTimer(room, "abandoned-timeout", abandonedCb);

      expect(room.lifecycleTimers.size).toBe(3);

      vi.advanceTimersByTime(DEFAULT_DISCONNECT_TIMEOUT_MS);
      expect(disconnectCb).toHaveBeenCalledOnce();
      expect(idleCb).not.toHaveBeenCalled();
      expect(abandonedCb).not.toHaveBeenCalled();
    });
  });

  describe("cancelLifecycleTimer", () => {
    test("cancels an active timer", () => {
      const room = createMockRoom();
      const callback = vi.fn();

      startLifecycleTimer(room, "disconnect-timeout", callback);
      cancelLifecycleTimer(room, "disconnect-timeout");

      expect(hasLifecycleTimer(room, "disconnect-timeout")).toBe(false);
      vi.advanceTimersByTime(DEFAULT_DISCONNECT_TIMEOUT_MS);
      expect(callback).not.toHaveBeenCalled();
    });

    test("is safe to call when no timer exists", () => {
      const room = createMockRoom();

      expect(() => cancelLifecycleTimer(room, "disconnect-timeout")).not.toThrow();
    });
  });

  describe("cancelAllLifecycleTimers", () => {
    test("cancels all active lifecycle timers", () => {
      const room = createMockRoom();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const cb3 = vi.fn();

      startLifecycleTimer(room, "disconnect-timeout", cb1);
      startLifecycleTimer(room, "idle-timeout", cb2);
      startLifecycleTimer(room, "abandoned-timeout", cb3);

      cancelAllLifecycleTimers(room);

      expect(room.lifecycleTimers.size).toBe(0);
      vi.advanceTimersByTime(DEFAULT_ABANDONED_TIMEOUT_MS);
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
      expect(cb3).not.toHaveBeenCalled();
    });

    test("is safe to call when no timers exist", () => {
      const room = createMockRoom();
      expect(() => cancelAllLifecycleTimers(room)).not.toThrow();
    });
  });

  describe("configurable timeouts", () => {
    test("setDisconnectTimeoutMs changes disconnect timer duration", () => {
      const room = createMockRoom();
      const callback = vi.fn();

      setDisconnectTimeoutMs(1000);
      startLifecycleTimer(room, "disconnect-timeout", callback);

      vi.advanceTimersByTime(999);
      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(callback).toHaveBeenCalledOnce();
    });

    test("setIdleTimeoutMs changes idle timer duration", () => {
      const room = createMockRoom();
      const callback = vi.fn();

      setIdleTimeoutMs(2000);
      startLifecycleTimer(room, "idle-timeout", callback);

      vi.advanceTimersByTime(2000);
      expect(callback).toHaveBeenCalledOnce();
    });

    test("setAbandonedTimeoutMs changes abandoned timer duration", () => {
      const room = createMockRoom();
      const callback = vi.fn();

      setAbandonedTimeoutMs(5000);
      startLifecycleTimer(room, "abandoned-timeout", callback);

      vi.advanceTimersByTime(5000);
      expect(callback).toHaveBeenCalledOnce();
    });
  });

  describe("timer removes itself from map after firing", () => {
    test("disconnect timer cleans up after firing", () => {
      const room = createMockRoom();
      startLifecycleTimer(room, "disconnect-timeout", vi.fn());

      vi.advanceTimersByTime(DEFAULT_DISCONNECT_TIMEOUT_MS);
      expect(hasLifecycleTimer(room, "disconnect-timeout")).toBe(false);
    });
  });
});
