import { describe, expect, it, vi } from "vitest";
import { RoomManager } from "./room-manager";
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
});
