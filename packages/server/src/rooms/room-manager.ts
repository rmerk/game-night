import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { generateUniqueRoomCode } from "./room-code";
import type { Room } from "./room";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

export class RoomManager {
  private rooms = new Map<string, Room>();

  createRoom(
    hostName: string,
    logger: FastifyBaseLogger,
  ): { roomId: string; roomCode: string; roomUrl: string; hostToken: string } {
    const roomCode = generateUniqueRoomCode(this.getActiveRoomCodes());
    const roomId = randomUUID();
    const hostToken = randomUUID();
    const roomLogger = logger.child({ roomCode });

    const room: Room = {
      roomId,
      roomCode,
      hostToken,
      players: new Map(),
      sessions: new Map(),
      gamePhase: "lobby",
      createdAt: Date.now(),
      logger: roomLogger,
    };

    this.rooms.set(roomCode, room);
    roomLogger.info({ roomId, hostName }, "Room created");

    return {
      roomId,
      roomCode,
      roomUrl: `${BASE_URL}/room/${roomCode}`,
      hostToken,
    };
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getRoomStatus(code: string): { full: boolean; playerCount: number; phase: string } | null {
    const room = this.getRoom(code);
    if (!room) return null;

    const playerCount = room.players.size;
    return {
      full: playerCount >= 4,
      playerCount,
      phase: room.gamePhase,
    };
  }

  getActiveRoomCodes(): Set<string> {
    return new Set(this.rooms.keys());
  }
}
