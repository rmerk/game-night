import { describe, expect, it, vi } from "vitest";
import {
  createSessionToken,
  resolveToken,
  revokeToken,
  DEFAULT_GRACE_PERIOD_MS,
} from "./session-manager";
import type { Room } from "./room";
import type { FastifyBaseLogger } from "fastify";

function createMockRoom(overrides: Partial<Room> = {}): Room {
  return {
    roomId: "test-room-id",
    roomCode: "ABCDEF",
    hostToken: "host-token",
    players: new Map(),
    sessions: new Map(),
    tokenMap: new Map(),
    playerTokens: new Map(),
    graceTimers: new Map(),
    gameState: null,
    createdAt: Date.now(),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    } as unknown as FastifyBaseLogger,
    ...overrides,
  };
}

describe("session-manager", () => {
  describe("createSessionToken", () => {
    it("generates a UUID token and stores bidirectional mapping", () => {
      const room = createMockRoom();
      const token = createSessionToken(room, "player-0");

      expect(token).toMatch(/^[0-9a-f-]{36}$/);
      expect(room.tokenMap.get(token)).toBe("player-0");
      expect(room.playerTokens.get("player-0")).toBe(token);
    });

    it("generates unique tokens for different players", () => {
      const room = createMockRoom();
      const token0 = createSessionToken(room, "player-0");
      const token1 = createSessionToken(room, "player-1");

      expect(token0).not.toBe(token1);
      expect(room.tokenMap.size).toBe(2);
      expect(room.playerTokens.size).toBe(2);
    });

    it("revokes old token when generating new token for same player", () => {
      const room = createMockRoom();
      const oldToken = createSessionToken(room, "player-0");
      const newToken = createSessionToken(room, "player-0");

      expect(newToken).not.toBe(oldToken);
      expect(room.playerTokens.get("player-0")).toBe(newToken);
      expect(room.tokenMap.get(newToken)).toBe("player-0");
      // Old token should be cleaned up
      expect(room.tokenMap.get(oldToken)).toBeUndefined();
      expect(room.tokenMap.size).toBe(1);
    });
  });

  describe("resolveToken", () => {
    it("returns playerId for valid token", () => {
      const room = createMockRoom();
      const token = createSessionToken(room, "player-2");

      expect(resolveToken(room, token)).toBe("player-2");
    });

    it("returns undefined for unknown token", () => {
      const room = createMockRoom();

      expect(resolveToken(room, "nonexistent-token")).toBeUndefined();
    });
  });

  describe("revokeToken", () => {
    it("removes both token and player mappings", () => {
      const room = createMockRoom();
      const token = createSessionToken(room, "player-0");

      revokeToken(room, "player-0");

      expect(room.tokenMap.get(token)).toBeUndefined();
      expect(room.playerTokens.get("player-0")).toBeUndefined();
    });

    it("does nothing for player with no token", () => {
      const room = createMockRoom();

      revokeToken(room, "player-0"); // Should not throw

      expect(room.tokenMap.size).toBe(0);
      expect(room.playerTokens.size).toBe(0);
    });
  });

  describe("DEFAULT_GRACE_PERIOD_MS", () => {
    it("is 30 seconds", () => {
      expect(DEFAULT_GRACE_PERIOD_MS).toBe(30_000);
    });
  });
});
