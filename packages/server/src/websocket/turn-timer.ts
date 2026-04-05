/**
 * Play-phase turn timer (Story 4B.4): `initial` → `extended` → auto-discard, with AFK vote escalation.
 *
 * The turn timer uses a dedicated `room.turnTimerHandle` (stateful stages). The AFK vote expiry uses
 * the lifecycle framework (`"afk-vote-timeout"`).
 *
 * **Disconnected players:** grace-expiry owns auto-discard for `connected === false`; the turn timer
 * never arms in that case and grace-expiry does not increment `consecutiveTurnTimeouts` (AFK is for
 * present-but-inattentive players only).
 */
import type { WebSocket } from "ws";
import type { FastifyBaseLogger } from "fastify";
import { handleAction, PROTOCOL_VERSION } from "@mahjong-game/shared";
import type { Tile } from "@mahjong-game/shared";
import type { PlayerSession, Room, TurnTimerConfig } from "../rooms/room";
import {
  cancelLifecycleTimer,
  getAfkVoteTimeoutMs,
  startLifecycleTimer,
} from "../rooms/room-lifecycle";
import { broadcastGameState, broadcastStateToRoom } from "./state-broadcaster";

export const DEFAULT_TURN_TIMER_CONFIG: Readonly<TurnTimerConfig> = {
  mode: "timed",
  durationMs: 20_000,
};

let defaultTurnTimerConfig: TurnTimerConfig = { mode: "timed", durationMs: 20_000 };

export function setDefaultTurnTimerConfig(config: TurnTimerConfig): void {
  defaultTurnTimerConfig = { ...config };
}

export function getDefaultTurnTimerConfig(): TurnTimerConfig {
  return { ...defaultTurnTimerConfig };
}

/** Last non-joker tile from the back of the rack — shared with grace-expiry auto-discard. */
export function pickAutoDiscardTileId(rack: Tile[]): string | null {
  for (let i = rack.length - 1; i >= 0; i--) {
    const t = rack[i];
    if (t.category !== "joker") {
      return t.id;
    }
  }
  return null;
}

export function cancelTurnTimer(room: Room, logger: FastifyBaseLogger): void {
  if (room.turnTimerHandle) {
    clearTimeout(room.turnTimerHandle);
  }
  room.turnTimerHandle = null;
  room.turnTimerStage = null;
  room.turnTimerPlayerId = null;
  logger.debug({ roomCode: room.roomCode }, "Turn timer cancelled");
}

/**
 * Clear turn timer + consecutive-timeout map + AFK vote state (no vote broadcast — game already ended).
 */
export function resetTurnTimerStateOnGameEnd(room: Room, logger: FastifyBaseLogger): void {
  cancelTurnTimer(room, logger);
  room.consecutiveTurnTimeouts.clear();
  if (room.afkVoteState) {
    cancelLifecycleTimer(room, "afk-vote-timeout");
    room.afkVoteState = null;
  }
}

function sendProtocolError(
  ws: WebSocket,
  logger: FastifyBaseLogger,
  code: string,
  message: string,
): void {
  const payload = {
    version: PROTOCOL_VERSION,
    type: "ERROR" as const,
    code,
    message,
  };
  try {
    ws.send(JSON.stringify(payload));
  } catch (error) {
    logger.warn({ error, code }, "Failed to send protocol ERROR to client");
  }
}

function shouldArmPlayPhaseTimer(room: Room): boolean {
  if (room.turnTimerConfig.mode !== "timed") return false;
  if (room.paused) return false;
  const gs = room.gameState;
  if (!gs || gs.gamePhase !== "play") return false;
  if (gs.turnPhase !== "draw" && gs.turnPhase !== "discard") return false;
  const cur = gs.currentTurn;
  const p = room.players.get(cur);
  if (!p?.connected) return false;
  if (room.deadSeatPlayerIds.has(cur)) return false;
  return true;
}

/**
 * Auto-discard for turn-timeout / dead-seat stub — does not reset `consecutiveTurnTimeouts`.
 * @returns whether discard succeeded
 */
export function performTurnTimeoutAutoDiscard(
  room: Room,
  playerId: string,
  logger: FastifyBaseLogger,
): boolean {
  const gs = room.gameState;
  if (!gs) return false;
  const rack = gs.players[playerId]?.rack;
  if (!rack) return false;
  const tileId = pickAutoDiscardTileId(rack);
  if (!tileId) {
    logger.warn(
      { roomCode: room.roomCode, playerId },
      "Turn timer: no non-joker tile to auto-discard",
    );
    return false;
  }
  const result = handleAction(gs, { type: "DISCARD_TILE", playerId, tileId });
  if (!result.accepted) {
    logger.warn(
      { roomCode: room.roomCode, playerId, reason: result.reason },
      "Turn timer: DISCARD_TILE failed",
    );
    return false;
  }
  broadcastGameState(room, gs, result.resolved);
  broadcastStateToRoom(room, undefined, {
    type: "TURN_TIMEOUT_AUTO_DISCARD",
    playerId,
    tileId,
  });
  return true;
}

function startAfkVote(room: Room, targetPlayerId: string, logger: FastifyBaseLogger): void {
  if (room.afkVoteState !== null) return;
  if (room.afkVoteCooldownPlayerIds.has(targetPlayerId)) return;
  // AC9: never open a vote against an offline player — they cannot cancel it.
  if (room.players.get(targetPlayerId)?.connected !== true) return;

  room.afkVoteState = {
    targetPlayerId,
    startedAt: Date.now(),
    votes: new Map(),
  };
  const expiresMs = getAfkVoteTimeoutMs();
  startLifecycleTimer(room, "afk-vote-timeout", () => {
    handleAfkVoteTimeoutExpiry(room, logger);
  });
  broadcastStateToRoom(room, undefined, {
    type: "AFK_VOTE_STARTED",
    targetPlayerId,
    expiresAt: Date.now() + expiresMs,
  });
  logger.info({ roomCode: room.roomCode, targetPlayerId }, "AFK vote started");
}

/** Exported for tests — lifecycle callback for `"afk-vote-timeout"`. */
export function handleAfkVoteTimeoutExpiry(room: Room, logger: FastifyBaseLogger): void {
  resolveAfkVote(room, logger, "timeout");
}

function resolveAfkVote(room: Room, logger: FastifyBaseLogger, trigger: "vote" | "timeout"): void {
  const state = room.afkVoteState;
  if (!state) return;

  let approves = 0;
  let denies = 0;
  for (const v of state.votes.values()) {
    if (v === "approve") approves++;
    else denies++;
  }

  const target = state.targetPlayerId;

  if (approves >= 2) {
    cancelLifecycleTimer(room, "afk-vote-timeout");
    room.afkVoteState = null;
    room.deadSeatPlayerIds.add(target);
    broadcastStateToRoom(room, undefined, {
      type: "AFK_VOTE_RESOLVED",
      targetPlayerId: target,
      outcome: "passed",
    });
    logger.info({ roomCode: room.roomCode, targetPlayerId: target }, "AFK vote passed");
    syncTurnTimer(room, logger);
    return;
  }

  if (denies >= 2) {
    cancelLifecycleTimer(room, "afk-vote-timeout");
    room.afkVoteState = null;
    room.afkVoteCooldownPlayerIds.add(target);
    broadcastStateToRoom(room, undefined, {
      type: "AFK_VOTE_RESOLVED",
      targetPlayerId: target,
      outcome: "failed",
    });
    logger.info({ roomCode: room.roomCode, targetPlayerId: target }, "AFK vote failed (denies)");
    syncTurnTimer(room, logger);
    return;
  }

  if (trigger === "timeout") {
    cancelLifecycleTimer(room, "afk-vote-timeout");
    room.afkVoteState = null;
    room.afkVoteCooldownPlayerIds.add(target);
    broadcastStateToRoom(room, undefined, {
      type: "AFK_VOTE_RESOLVED",
      targetPlayerId: target,
      outcome: "failed",
    });
    logger.info({ roomCode: room.roomCode, targetPlayerId: target }, "AFK vote failed (timeout)");
    syncTurnTimer(room, logger);
  }
}

export function cancelAfkVote(
  room: Room,
  logger: FastifyBaseLogger,
  reason: "target_active" | "pause" | "game_ended",
): void {
  if (!room.afkVoteState) return;
  const target = room.afkVoteState.targetPlayerId;
  cancelLifecycleTimer(room, "afk-vote-timeout");
  room.afkVoteState = null;
  if (reason !== "game_ended") {
    broadcastStateToRoom(room, undefined, {
      type: "AFK_VOTE_RESOLVED",
      targetPlayerId: target,
      outcome: "cancelled",
    });
  }
  logger.info({ roomCode: room.roomCode, reason, targetPlayerId: target }, "AFK vote cancelled");
}

export function handleAfkVoteCastMessage(
  ws: WebSocket,
  session: PlayerSession,
  room: Room,
  parsed: Record<string, unknown>,
  logger: FastifyBaseLogger,
): void {
  const targetPlayerId = parsed.targetPlayerId;
  const vote = parsed.vote;
  if (typeof targetPlayerId !== "string" || (vote !== "approve" && vote !== "deny")) {
    sendProtocolError(ws, logger, "INVALID_ACTION", "Invalid AFK vote payload");
    return;
  }

  const voterId = session.player.playerId;
  if (!room.afkVoteState) {
    sendProtocolError(ws, logger, "NO_ACTIVE_VOTE", "No active AFK vote");
    return;
  }
  if (room.afkVoteState.targetPlayerId !== targetPlayerId) {
    sendProtocolError(ws, logger, "INVALID_VOTE_TARGET", "Vote target does not match active vote");
    return;
  }
  if (voterId === targetPlayerId) {
    sendProtocolError(ws, logger, "CANNOT_VOTE_ON_SELF", "Cannot vote on yourself");
    return;
  }
  if (room.deadSeatPlayerIds.has(voterId)) {
    sendProtocolError(ws, logger, "INVALID_ACTION", "Dead seat players cannot vote");
    return;
  }
  // AC12: defensive — should always be true when receiving a live message.
  if (room.players.get(voterId)?.connected !== true) {
    sendProtocolError(ws, logger, "INVALID_ACTION", "Disconnected players cannot vote");
    return;
  }

  room.afkVoteState.votes.set(voterId, vote);
  broadcastStateToRoom(room, undefined, {
    type: "AFK_VOTE_CAST",
    voterId,
    targetPlayerId,
    vote,
  });
  resolveAfkVote(room, logger, "vote");
}

export function handleTurnTimerExpiry(room: Room, logger: FastifyBaseLogger): void {
  room.turnTimerHandle = null;

  const P = room.turnTimerPlayerId;
  const stage = room.turnTimerStage;
  room.turnTimerPlayerId = null;
  room.turnTimerStage = null;

  if (!P || !stage) return;

  const gs = room.gameState;
  if (!gs || gs.gamePhase !== "play" || gs.currentTurn !== P) return;
  if (room.paused) return;
  // AC9: AFK escalation targets present-but-inattentive players only.
  // Grace-expiry owns disconnected players; bail out if the current player
  // dropped after the timer was armed.
  if (room.players.get(P)?.connected !== true) return;

  if (stage === "initial") {
    const D = room.turnTimerConfig.durationMs;
    room.turnTimerPlayerId = P;
    room.turnTimerStage = "extended";
    room.turnTimerHandle = setTimeout(() => {
      handleTurnTimerExpiry(room, logger);
    }, D);
    broadcastStateToRoom(room, undefined, {
      type: "TURN_TIMER_NUDGE",
      playerId: P,
      expiresAt: Date.now() + D,
    });
    logger.info(
      { roomCode: room.roomCode, playerId: P },
      "Turn timer: first timeout — nudge + extend",
    );
    return;
  }

  if (stage === "extended") {
    const prev = room.consecutiveTurnTimeouts.get(P) ?? 0;
    const next = prev + 1;
    room.consecutiveTurnTimeouts.set(P, next);

    if (next >= 3 && !room.afkVoteCooldownPlayerIds.has(P) && room.afkVoteState === null) {
      startAfkVote(room, P, logger);
    }

    performTurnTimeoutAutoDiscard(room, P, logger);
    syncTurnTimer(room, logger);
  }
}

const MAX_DEAD_SEAT_SYNC_DEPTH = 4;

/**
 * Single entry: cancel any existing timer, then either run the dead-seat stub, arm a new timer, or no-op.
 */
export function syncTurnTimer(room: Room, logger: FastifyBaseLogger, deadSeatDepth = 0): void {
  cancelTurnTimer(room, logger);

  const gs = room.gameState;
  if (!gs || gs.gamePhase !== "play") return;

  const current = gs.currentTurn;
  const pl = room.players.get(current);

  // TODO(4B.5): replace with proper dead-seat turn-skip — stub advances turn via auto-discard only.
  if (
    deadSeatDepth < MAX_DEAD_SEAT_SYNC_DEPTH &&
    room.deadSeatPlayerIds.has(current) &&
    pl?.connected &&
    !room.paused &&
    (gs.turnPhase === "draw" || gs.turnPhase === "discard")
  ) {
    performTurnTimeoutAutoDiscard(room, current, logger);
    syncTurnTimer(room, logger, deadSeatDepth + 1);
    return;
  }

  if (!shouldArmPlayPhaseTimer(room)) return;

  const D = room.turnTimerConfig.durationMs;
  const pid = gs.currentTurn;
  room.turnTimerPlayerId = pid;
  room.turnTimerStage = "initial";
  room.turnTimerHandle = setTimeout(() => {
    handleTurnTimerExpiry(room, logger);
  }, D);
}
