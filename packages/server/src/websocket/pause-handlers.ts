import type { FastifyBaseLogger } from "fastify";
import type { Room } from "../rooms/room";
import type { RoomManager } from "../rooms/room-manager";
import { startLifecycleTimer } from "../rooms/room-lifecycle";
import { broadcastStateToRoom } from "./state-broadcaster";

/**
 * Drop a player from the room maps (tokens, sessions, rate limits). Does not run engine actions.
 * Used by grace-expiry seat release and pause-timeout auto-end (Story 4B.3).
 */
export function releaseSeat(room: Room, playerId: string): void {
  const token = room.playerTokens.get(playerId);
  if (token) {
    room.tokenMap.delete(token);
    room.playerTokens.delete(playerId);
  }
  room.players.delete(playerId);
  room.sessions.delete(playerId);
  room.chatRateTimestamps.delete(playerId);
  room.reactionRateTimestamps.delete(playerId);
}

/**
 * Auto-end an in-flight game when the room-level pause timer expires (AC7).
 */
export function handlePauseTimeout(
  room: Room,
  roomManager: RoomManager | undefined,
  logger: FastifyBaseLogger,
): void {
  if (!room.paused) {
    return;
  }

  const gs = room.gameState;
  if (gs && (gs.gamePhase === "play" || gs.gamePhase === "charleston")) {
    gs.gamePhase = "scoreboard";
    gs.gameResult = { winnerId: null, points: 0 };
  }

  room.paused = false;
  room.pausedAt = null;

  const toRelease = [...room.players.values()].filter((p) => !p.connected).map((p) => p.playerId);
  for (const pid of toRelease) {
    releaseSeat(room, pid);
  }

  // AC7: room stays alive for scoreboard. Arm the standard scoreboard idle-timeout
  // (same pattern as action-handler's natural scoreboard transition) so a room with
  // ≥2 connected players still cleans up eventually. The degenerate ≤1 case falls
  // through to abandoned-timeout, matching the grace-expiry seat-release path.
  if (roomManager && gs && gs.gamePhase === "scoreboard") {
    if (room.players.size <= 1) {
      startLifecycleTimer(room, "abandoned-timeout", () => {
        roomManager.cleanupRoom(room.roomCode, "abandoned");
      });
    } else {
      startLifecycleTimer(room, "idle-timeout", () => {
        roomManager.cleanupRoom(room.roomCode, "idle_timeout");
      });
    }
  }

  broadcastStateToRoom(room, undefined, { type: "GAME_ABANDONED", reason: "pause-timeout" });
  logger.info({ roomCode: room.roomCode }, "Pause timeout fired — game auto-ended");
}
