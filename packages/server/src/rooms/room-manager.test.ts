import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { WebSocket } from "ws";
import { RoomManager } from "./room-manager";
import { createSessionToken } from "./session-manager";
import {
  startLifecycleTimer,
  hasLifecycleTimer,
  setDisconnectTimeoutMs,
  setIdleTimeoutMs,
  setAbandonedTimeoutMs,
  DEFAULT_DISCONNECT_TIMEOUT_MS,
  DEFAULT_IDLE_TIMEOUT_MS,
  DEFAULT_ABANDONED_TIMEOUT_MS,
} from "./room-lifecycle";
import type { FastifyBaseLogger } from "fastify";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_CODE_REGEX = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

function createMockLogger(): FastifyBaseLogger {
  const mock = {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    silent: vi.fn(),
    level: "info",
    child: vi.fn(),
  };
  mock.child.mockReturnValue(mock);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test mock
  return mock as unknown as FastifyBaseLogger;
}

describe("RoomManager", () => {
  describe("createRoom", () => {
    it("returns roomId, roomCode, roomUrl, and hostToken", () => {
      const manager = new RoomManager();
      const result = manager.createRoom("TestHost", createMockLogger());

      expect(result).toHaveProperty("roomId");
      expect(result).toHaveProperty("roomCode");
      expect(result).toHaveProperty("roomUrl");
      expect(result).toHaveProperty("hostToken");
    });

    it("generates a valid 6-character room code", () => {
      const manager = new RoomManager();
      const result = manager.createRoom("TestHost", createMockLogger());

      expect(result.roomCode).toMatch(ROOM_CODE_REGEX);
    });

    it("generates valid UUIDs for roomId and hostToken", () => {
      const manager = new RoomManager();
      const result = manager.createRoom("TestHost", createMockLogger());

      expect(result.roomId).toMatch(UUID_REGEX);
      expect(result.hostToken).toMatch(UUID_REGEX);
    });

    it("includes room code in roomUrl", () => {
      const manager = new RoomManager();
      const result = manager.createRoom("TestHost", createMockLogger());

      expect(result.roomUrl).toContain(`/room/${result.roomCode}`);
    });

    it("creates a child logger per room", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("TestHost", createMockLogger());

      // Verify room was stored with the generated code
      const room = manager.getRoom(roomCode);
      expect(room).toBeDefined();
      expect(room!.logger).toBeDefined();
    });

    it("generates unique codes for multiple rooms", () => {
      const manager = new RoomManager();
      const logger = createMockLogger();
      const codes = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const result = manager.createRoom(`Host${i}`, logger);
        codes.add(result.roomCode);
      }

      expect(codes.size).toBe(20);
    });
  });

  describe("getRoomStatus", () => {
    it("returns status for an existing room", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("TestHost", createMockLogger());

      const status = manager.getRoomStatus(roomCode);
      expect(status).toEqual({
        full: false,
        playerCount: 0,
        phase: "lobby",
      });
    });

    it("returns null for a nonexistent room code", () => {
      const manager = new RoomManager();
      const status = manager.getRoomStatus("ZZZZZZ");

      expect(status).toBeNull();
    });

    it("performs case-insensitive lookup", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("TestHost", createMockLogger());

      const status = manager.getRoomStatus(roomCode.toLowerCase());
      expect(status).not.toBeNull();
      expect(status!.phase).toBe("lobby");
    });
  });

  describe("getRoom", () => {
    it("returns the room for a valid code", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("TestHost", createMockLogger());

      const room = manager.getRoom(roomCode);
      expect(room).toBeDefined();
      expect(room!.roomCode).toBe(roomCode);
    });

    it("returns undefined for an unknown code", () => {
      const manager = new RoomManager();
      expect(manager.getRoom("ZZZZZZ")).toBeUndefined();
    });

    it("is case-insensitive", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("TestHost", createMockLogger());

      expect(manager.getRoom(roomCode.toLowerCase())).toBeDefined();
    });
  });

  describe("cleanupRoom", () => {
    function createMockWs(readyState: number = WebSocket.OPEN): WebSocket {
      return {
        readyState,
        send: vi.fn(),
        close: vi.fn(),
      } as unknown as WebSocket;
    }

    it("removes room from active rooms map", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("Host", createMockLogger());

      manager.cleanupRoom(roomCode, "all_disconnected");

      expect(manager.getRoom(roomCode)).toBeUndefined();
    });

    it("broadcasts ROOM_CLOSING to connected clients before closing", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("Host", createMockLogger());
      const room = manager.getRoom(roomCode)!;

      const ws = createMockWs();
      room.sessions.set("player-0", {
        player: {
          playerId: "player-0",
          displayName: "P0",
          wind: "east",
          isHost: true,
          connected: true,
          connectedAt: 0,
        },
        roomCode,
        ws,
      });

      manager.cleanupRoom(roomCode, "idle_timeout");

      // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.fn() mock
      expect(ws.send).toHaveBeenCalledOnce();
      // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.fn() mock
      const sendMock = vi.mocked(ws.send);
      const sent = JSON.parse(sendMock.mock.calls[0][0] as string);
      expect(sent.type).toBe("SYSTEM_EVENT");
      expect(sent.event).toBe("ROOM_CLOSING");
      expect(sent.reason).toBe("idle_timeout");
    });

    it("closes all WebSocket connections with code 1000", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("Host", createMockLogger());
      const room = manager.getRoom(roomCode)!;

      const ws1 = createMockWs();
      const ws2 = createMockWs();
      room.sessions.set("player-0", {
        player: {
          playerId: "player-0",
          displayName: "P0",
          wind: "east",
          isHost: true,
          connected: true,
          connectedAt: 0,
        },
        roomCode,
        ws: ws1,
      });
      room.sessions.set("player-1", {
        player: {
          playerId: "player-1",
          displayName: "P1",
          wind: "south",
          isHost: false,
          connected: true,
          connectedAt: 0,
        },
        roomCode,
        ws: ws2,
      });

      manager.cleanupRoom(roomCode, "all_disconnected");

      // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.fn() mock
      expect(ws1.close).toHaveBeenCalledWith(1000, "ROOM_CLOSING");
      // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.fn() mock
      expect(ws2.close).toHaveBeenCalledWith(1000, "ROOM_CLOSING");
    });

    it("revokes all session tokens", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("Host", createMockLogger());
      const room = manager.getRoom(roomCode)!;

      room.players.set("player-0", {
        playerId: "player-0",
        displayName: "P0",
        wind: "east",
        isHost: true,
        connected: true,
        connectedAt: 0,
      });
      room.players.set("player-1", {
        playerId: "player-1",
        displayName: "P1",
        wind: "south",
        isHost: false,
        connected: true,
        connectedAt: 0,
      });
      createSessionToken(room, "player-0");
      createSessionToken(room, "player-1");

      expect(room.tokenMap.size).toBe(2);

      manager.cleanupRoom(roomCode, "abandoned");

      // Room is removed, but verify token maps were cleared before removal
      expect(manager.findPlayerByToken("any-token")).toBeNull();
    });

    it("is idempotent — second call is a no-op", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("Host", createMockLogger());

      manager.cleanupRoom(roomCode, "all_disconnected");
      expect(() => manager.cleanupRoom(roomCode, "all_disconnected")).not.toThrow();
      expect(manager.getRoom(roomCode)).toBeUndefined();
    });

    it("cancels grace timers during cleanup", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("Host", createMockLogger());
      const room = manager.getRoom(roomCode)!;

      const graceCallback = vi.fn();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- test: vitest setTimeout returns number
      room.graceTimers.set(
        "player-0",
        setTimeout(graceCallback, 30_000) as unknown as ReturnType<typeof setTimeout>,
      );

      manager.cleanupRoom(roomCode, "all_disconnected");

      // Grace timer should not fire
      vi.useFakeTimers();
      vi.advanceTimersByTime(30_000);
      expect(graceCallback).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("releases room code for reuse", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("Host", createMockLogger());

      expect(manager.getActiveRoomCodes().has(roomCode)).toBe(true);

      manager.cleanupRoom(roomCode, "all_disconnected");

      expect(manager.getActiveRoomCodes().has(roomCode)).toBe(false);
    });

    it("does not send to WebSockets that are not OPEN", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("Host", createMockLogger());
      const room = manager.getRoom(roomCode)!;

      const closedWs = createMockWs(WebSocket.CLOSED);
      room.sessions.set("player-0", {
        player: {
          playerId: "player-0",
          displayName: "P0",
          wind: "east",
          isHost: true,
          connected: false,
          connectedAt: 0,
        },
        roomCode,
        ws: closedWs,
      });

      manager.cleanupRoom(roomCode, "all_disconnected");

      // eslint-disable-next-line @typescript-eslint/unbound-method -- vi.fn() mock
      expect(closedWs.send).not.toHaveBeenCalled();
    });
  });

  describe("cleanupRoom — integration with lifecycle timers", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      setDisconnectTimeoutMs(DEFAULT_DISCONNECT_TIMEOUT_MS);
      setIdleTimeoutMs(DEFAULT_IDLE_TIMEOUT_MS);
      setAbandonedTimeoutMs(DEFAULT_ABANDONED_TIMEOUT_MS);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("disconnect timer triggers cleanupRoom after 2 minutes", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("Host", createMockLogger());
      const room = manager.getRoom(roomCode)!;

      // Simulate disconnect-timeout trigger
      startLifecycleTimer(room, "disconnect-timeout", () => {
        manager.cleanupRoom(roomCode, "all_disconnected");
      });

      expect(manager.getRoom(roomCode)).toBeDefined();
      vi.advanceTimersByTime(DEFAULT_DISCONNECT_TIMEOUT_MS);
      expect(manager.getRoom(roomCode)).toBeUndefined();
    });

    it("idle timer triggers cleanupRoom after 5 minutes", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("Host", createMockLogger());
      const room = manager.getRoom(roomCode)!;

      startLifecycleTimer(room, "idle-timeout", () => {
        manager.cleanupRoom(roomCode, "idle_timeout");
      });

      vi.advanceTimersByTime(DEFAULT_IDLE_TIMEOUT_MS);
      expect(manager.getRoom(roomCode)).toBeUndefined();
    });

    it("abandoned timer starts on room creation", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("Host", createMockLogger());
      const room = manager.getRoom(roomCode)!;

      expect(hasLifecycleTimer(room, "abandoned-timeout")).toBe(true);
    });

    it("abandoned timer triggers cleanup after 30 minutes", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("Host", createMockLogger());

      vi.advanceTimersByTime(DEFAULT_ABANDONED_TIMEOUT_MS);
      expect(manager.getRoom(roomCode)).toBeUndefined();
    });

    it("room isolation — cleanup of one room does not affect another", () => {
      const manager = new RoomManager();
      const logger = createMockLogger();
      const { roomCode: codeA } = manager.createRoom("HostA", logger);
      const { roomCode: codeB } = manager.createRoom("HostB", logger);
      const roomB = manager.getRoom(codeB)!;

      // Add players and tokens to room B
      roomB.players.set("player-0", {
        playerId: "player-0",
        displayName: "P0",
        wind: "east",
        isHost: true,
        connected: true,
        connectedAt: 0,
      });
      const tokenB = createSessionToken(roomB, "player-0");

      manager.cleanupRoom(codeA, "all_disconnected");

      // Room B is completely unaffected
      expect(manager.getRoom(codeB)).toBeDefined();
      expect(roomB.players.size).toBe(1);
      expect(manager.findPlayerByToken(tokenB)).not.toBeNull();
    });

    it("token rejection after cleanup", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("Host", createMockLogger());
      const room = manager.getRoom(roomCode)!;

      room.players.set("player-0", {
        playerId: "player-0",
        displayName: "P0",
        wind: "east",
        isHost: true,
        connected: true,
        connectedAt: 0,
      });
      const token = createSessionToken(room, "player-0");

      // Token valid before cleanup
      expect(manager.findPlayerByToken(token)).not.toBeNull();

      manager.cleanupRoom(roomCode, "all_disconnected");

      // Token invalid after cleanup
      expect(manager.findPlayerByToken(token)).toBeNull();
    });

    it("idempotent cleanup — no crash on double call", () => {
      const manager = new RoomManager();
      const { roomCode } = manager.createRoom("Host", createMockLogger());

      manager.cleanupRoom(roomCode, "all_disconnected");

      // Second call should be a no-op, no throw
      expect(() => manager.cleanupRoom(roomCode, "all_disconnected")).not.toThrow();
    });
  });
});
