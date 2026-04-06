/**
 * Charleston auto-advance for players who cannot act (disconnect grace path, Story 3B.5;
 * dead-seat path, Story 4B.5). Lives in its own module to avoid join-handler ↔ leave-handler cycles.
 */
import type { FastifyBaseLogger } from "fastify";
import type {
  Tile,
  CharlestonPassAction,
  CharlestonVoteAction,
  CourtesyPassAction,
} from "@mahjong-game/shared";
import { handleAction } from "@mahjong-game/shared";
import type { Room } from "../rooms/room";
import type { RoomManager } from "../rooms/room-manager";
import { broadcastGameState } from "./state-broadcaster";
import { syncTurnTimer } from "./turn-timer";

export type CharlestonAutoReason = "grace_expiry" | "dead_seat";

function selectRandomNonJokerTiles(rack: Tile[], count: number): Tile[] {
  const nonJokers = rack.filter((t) => t.category !== "joker");
  const jokers = rack.filter((t) => t.category === "joker");
  const shuffled = [...nonJokers].sort(() => Math.random() - 0.5);
  const selected: Tile[] = shuffled.slice(0, count);
  if (selected.length < count) {
    selected.push(...jokers.slice(0, count - selected.length));
  }
  return selected;
}

/** True if this player still owes a Charleston submission in the current charleston sub-phase. */
export function charlestonPlayerNeedsAutoAdvance(room: Room, playerId: string): boolean {
  const gs = room.gameState;
  if (!gs || gs.gamePhase !== "charleston" || !gs.charleston) return false;
  const charleston = gs.charleston;
  const playerState = gs.players[playerId];
  if (!playerState || !charleston.activePlayerIds.includes(playerId)) return false;

  if (charleston.status === "passing") {
    return !charleston.submittedPlayerIds.includes(playerId);
  }
  if (charleston.status === "vote-ready") {
    return charleston.votesByPlayerId[playerId] === undefined;
  }
  if (charleston.status === "courtesy-ready") {
    return charleston.courtesySubmissionsByPlayerId[playerId] === undefined;
  }
  return false;
}

export function applyCharlestonAutoAction(
  room: Room,
  playerId: string,
  logger: FastifyBaseLogger,
  roomManager: RoomManager | undefined,
  reason: CharlestonAutoReason,
): void {
  if (!charlestonPlayerNeedsAutoAdvance(room, playerId)) {
    return;
  }

  const gs = room.gameState!;
  const charleston = gs.charleston!;
  const playerState = gs.players[playerId];

  let autoAction: CharlestonPassAction | CharlestonVoteAction | CourtesyPassAction | null = null;

  if (charleston.status === "passing") {
    if (!charleston.submittedPlayerIds.includes(playerId)) {
      const tiles = selectRandomNonJokerTiles(playerState.rack, 3);
      autoAction = { type: "CHARLESTON_PASS", playerId, tileIds: tiles.map((t) => t.id) };
    }
  } else if (charleston.status === "vote-ready") {
    if (charleston.votesByPlayerId[playerId] === undefined) {
      autoAction = { type: "CHARLESTON_VOTE", playerId, accept: false };
    }
  } else if (charleston.status === "courtesy-ready") {
    if (charleston.courtesySubmissionsByPlayerId[playerId] === undefined) {
      autoAction = { type: "COURTESY_PASS", playerId, count: 0, tileIds: [] };
    }
  }

  if (!autoAction) return;

  const result = handleAction(gs, autoAction);
  if (result.accepted) {
    broadcastGameState(room, gs, result.resolved);
    syncTurnTimer(room, logger, 0, roomManager);
    logger.info(
      { roomCode: room.roomCode, playerId, actionType: autoAction.type, reason },
      "Charleston auto-action applied",
    );
  } else {
    logger.warn(
      {
        roomCode: room.roomCode,
        playerId,
        actionType: autoAction.type,
        reason,
        err: result.reason,
      },
      "Charleston auto-action rejected unexpectedly",
    );
  }
}

const MAX_CHARLESTON_DEAD_SEAT_DRAIN = 16;

/**
 * Apply Charleston auto-actions for dead-seat players until none are blocking or cap hit.
 * Call after converting a player to dead seat (or when multiple dead seats could chain).
 */
export function drainCharlestonForDeadSeats(
  room: Room,
  logger: FastifyBaseLogger,
  roomManager: RoomManager | undefined,
): void {
  if (room.gameState?.gamePhase !== "charleston") return;

  for (let i = 0; i < MAX_CHARLESTON_DEAD_SEAT_DRAIN; i++) {
    if (room.gameState?.gamePhase !== "charleston") break;

    let progressed = false;
    for (const pid of room.seatStatus.deadSeatPlayerIds) {
      if (!charlestonPlayerNeedsAutoAdvance(room, pid)) continue;
      applyCharlestonAutoAction(room, pid, logger, roomManager, "dead_seat");
      progressed = true;
      break;
    }
    if (!progressed) break;
  }
}
