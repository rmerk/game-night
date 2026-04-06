import type { FastifyBaseLogger } from "fastify";
import type { Room } from "../rooms/room";
import type { RoomManager } from "../rooms/room-manager";
import { startLifecycleTimer } from "../rooms/room-lifecycle";
import { releaseSeat } from "../rooms/seat-release";
import { broadcastStateToRoom } from "./state-broadcaster";
import { resetTurnTimerStateOnGameEnd } from "./turn-timer";

export { releaseSeat } from "../rooms/seat-release";

/**
 * Auto-end an in-flight game when the room-level pause timer expires (AC7).
 */
export function handlePauseTimeout(
  room: Room,
  roomManager: RoomManager | undefined,
  logger: FastifyBaseLogger,
): void {
  if (!room.pause.paused) {
    return;
  }

  const gs = room.gameState;
  if (gs && (gs.gamePhase === "play" || gs.gamePhase === "charleston")) {
    gs.gamePhase = "scoreboard";
    gs.gameResult = { winnerId: null, points: 0 };
  }

  room.pause.paused = false;
  room.pause.pausedAt = null;

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
  // Story 4B.4: defensive cleanup. When pause was triggered by the
  // simultaneous-disconnect branch in join-handler, `cancelAfkVote(..., "pause")`
  // already cleared any active vote and `cancelTurnTimer` already cleared the
  // turn timer — so on entry here `afkVoteState` / `turnTimerHandle` are
  // typically null. Still call `resetTurnTimerStateOnGameEnd` to clear the
  // consecutive-timeout counters and to stay robust against future pause
  // entry paths.
  resetTurnTimerStateOnGameEnd(room, logger);
  logger.info({ roomCode: room.roomCode }, "Pause timeout fired — game auto-ended");
}
