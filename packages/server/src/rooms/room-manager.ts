import { randomUUID } from "node:crypto";
import { WebSocket } from "ws";
import type { FastifyBaseLogger } from "fastify";
import { DEFAULT_ROOM_SETTINGS, PROTOCOL_VERSION } from "@mahjong-game/shared";
import type { RoomClosingReason, SystemEventMessage } from "@mahjong-game/shared";
import { generateUniqueRoomCode } from "./room-code";
import type { Room } from "./room";
import { cancelAllLifecycleTimers, startLifecycleTimer } from "./room-lifecycle";
import { revokeToken } from "./session-manager";
import { cancelTurnTimer } from "../websocket/turn-timer";

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
      tokenMap: new Map(),
      playerTokens: new Map(),
      graceTimers: new Map(),
      lifecycleTimers: new Map(),
      socialOverrideTimer: null,
      tableTalkReportTimer: null,
      gameState: null,
      settings: { ...DEFAULT_ROOM_SETTINGS },
      jokerRulesMode: DEFAULT_ROOM_SETTINGS.jokerRulesMode,
      chatHistory: [],
      chatRateTimestamps: new Map(),
      reactionRateTimestamps: new Map(),
      paused: false,
      pausedAt: null,
      turnTimerConfig: {
        mode: DEFAULT_ROOM_SETTINGS.timerMode,
        durationMs: DEFAULT_ROOM_SETTINGS.turnDurationMs,
      },
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
      logger: roomLogger,
    };

    this.rooms.set(roomCode, room);
    roomLogger.info({ roomId, hostName }, "Room created");

    // Start abandoned room timer — cancelled when 2+ players are in the room
    startLifecycleTimer(room, "abandoned-timeout", () => {
      this.cleanupRoom(roomCode, "abandoned");
    });

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
      phase: room.gameState?.gamePhase ?? "lobby",
    };
  }

  findPlayerByToken(token: string): { room: Room; playerId: string } | null {
    for (const room of this.rooms.values()) {
      const playerId = room.tokenMap.get(token);
      if (playerId) {
        return { room, playerId };
      }
    }
    return null;
  }

  findSessionByWs(ws: import("ws").WebSocket): { room: Room; playerId: string } | null {
    for (const room of this.rooms.values()) {
      for (const [playerId, session] of room.sessions) {
        if (session.ws === ws) {
          return { room, playerId };
        }
      }
    }
    return null;
  }

  cleanupRoom(roomCode: string, reason: RoomClosingReason): void {
    const room = this.getRoom(roomCode);
    if (!room) return; // Idempotent — already cleaned up

    // 1. Cancel all timers (grace timers + lifecycle timers)
    for (const timer of room.graceTimers.values()) {
      clearTimeout(timer);
    }
    room.graceTimers.clear();
    cancelAllLifecycleTimers(room);
    if (room.socialOverrideTimer) {
      clearTimeout(room.socialOverrideTimer);
      room.socialOverrideTimer = null;
    }
    if (room.tableTalkReportTimer) {
      clearTimeout(room.tableTalkReportTimer);
      room.tableTalkReportTimer = null;
    }
    cancelTurnTimer(room, room.logger);

    room.chatHistory.length = 0;
    room.chatRateTimestamps.clear();
    room.reactionRateTimestamps.clear();

    // 2. Snapshot sessions and clear map — prevents stale close handlers
    //    from creating orphaned timers on the dead room
    const sessions = Array.from(room.sessions.values());
    room.sessions.clear();

    // 3. Broadcast ROOM_CLOSING to connected clients
    const closeMessage: SystemEventMessage = {
      version: PROTOCOL_VERSION,
      type: "SYSTEM_EVENT",
      event: "ROOM_CLOSING",
      reason,
    };
    const closeMessageStr = JSON.stringify(closeMessage);
    for (const session of sessions) {
      if (session.ws.readyState === WebSocket.OPEN) {
        session.ws.send(closeMessageStr);
      }
    }

    // 4. Close all WebSocket connections
    for (const session of sessions) {
      if (
        session.ws.readyState === WebSocket.OPEN ||
        session.ws.readyState === WebSocket.CONNECTING
      ) {
        session.ws.close(1000, "ROOM_CLOSING");
      }
    }

    // 5. Revoke all session tokens
    for (const playerId of room.players.keys()) {
      revokeToken(room, playerId);
    }

    // 6. Remove room from active rooms map
    this.rooms.delete(room.roomCode);

    // 7. Log cleanup completion
    room.logger.info({ roomCode: room.roomCode, reason }, "Room cleaned up");
  }

  getActiveRoomCodes(): Set<string> {
    return new Set(this.rooms.keys());
  }
}
