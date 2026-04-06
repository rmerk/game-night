/**
 * Intentional player departure (Story 4B.5): `LEAVE_ROOM` + departure vote vs AFK vote vs social-override vote.
 *
 * **Vote visibility:** AFK vote is not threaded into `PlayerGameView` (mid-vote reconnect gap accepted in 4B.4).
 * Departure vote IS threaded via `PlayerGameView.departureVoteState` because outcomes are terminal and the
 * 30s window makes reconnect-during-vote common.
 *
 * **Pause interaction (AC13):** On simultaneous-disconnect pause we cancel the departure vote and broadcast
 * `DEPARTURE_VOTE_RESOLVED { outcome: "cancelled" }`. On `GAME_RESUMED`, `resumeDepartureVoteIfNeeded` restarts
 * the vote for the first departed player if exactly one departure is pending and the game is still in-flight.
 *
 * **Host migration (Story 4B.6):** When the host's seat is released or they are dead-seated, `migrateHost`
 * in [`../rooms/host-migration.ts`](../rooms/host-migration.ts) assigns `isHost` to the next eligible player.
 */
import type { WebSocket } from "ws";
import type { FastifyBaseLogger } from "fastify";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import type { Room, PlayerSession } from "../rooms/room";
import type { RoomManager } from "../rooms/room-manager";
import {
  cancelLifecycleTimer,
  getDepartureVoteTimeoutMs,
  startLifecycleTimer,
} from "../rooms/room-lifecycle";
import { releaseSeat } from "../rooms/seat-release";
import { migrateHost } from "../rooms/host-migration";
import { drainCharlestonForDeadSeats } from "./charleston-auto-action";
import { broadcastStateToRoom } from "./state-broadcaster";
import {
  cancelAfkVote,
  cancelTurnTimer,
  autoEndGameOnDeparture,
  syncTurnTimer,
} from "./turn-timer";

export function sendProtocolError(
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

function countLivingEligibleVoters(room: Room, targetPlayerId: string): number {
  let n = 0;
  for (const p of room.players.values()) {
    if (!p.connected) continue;
    if (room.seatStatus.departedPlayerIds.has(p.playerId)) continue;
    if (room.seatStatus.deadSeatPlayerIds.has(p.playerId)) continue;
    if (p.playerId === targetPlayerId) continue;
    n++;
  }
  return n;
}

function countLivingPlayersForAutoEnd(room: Room): number {
  let n = 0;
  for (const p of room.players.values()) {
    if (!p.connected) continue;
    if (room.seatStatus.departedPlayerIds.has(p.playerId)) continue;
    if (room.seatStatus.deadSeatPlayerIds.has(p.playerId)) continue;
    n++;
  }
  return n;
}

function stripAfkVoteFromDepartingPlayer(
  room: Room,
  departingPlayerId: string,
  logger: FastifyBaseLogger,
): void {
  const vs = room.votes.afk;
  if (!vs) return;
  if (vs.targetPlayerId === departingPlayerId) {
    cancelAfkVote(room, logger, "target_active");
    return;
  }
  if (vs.votes.has(departingPlayerId)) {
    vs.votes.delete(departingPlayerId);
  }
}

/**
 * Cancel an active departure vote without resolving to dead_seat/end_game (except broadcast cancelled).
 */
export function cancelDepartureVote(
  room: Room,
  logger: FastifyBaseLogger,
  reason: "multi_departure" | "pause" | "game_ended",
): void {
  const state = room.votes.departure;
  if (!state) return;
  const target = state.targetPlayerId;
  cancelLifecycleTimer(room, "departure-vote-timeout");
  room.votes.departure = null;
  broadcastStateToRoom(room, undefined, {
    type: "DEPARTURE_VOTE_RESOLVED",
    targetPlayerId: target,
    outcome: "cancelled",
  });
  logger.info(
    { roomCode: room.roomCode, reason, targetPlayerId: target },
    "Departure vote cancelled",
  );
}

export function handleLeaveRoomMessage(
  ws: WebSocket,
  session: PlayerSession,
  room: Room,
  logger: FastifyBaseLogger,
  roomManager: RoomManager,
): void {
  const playerId = session.player.playerId;
  if (room.seatStatus.departedPlayerIds.has(playerId)) {
    logger.warn(
      { roomCode: room.roomCode, playerId },
      "LEAVE_ROOM ignored — player already departed",
    );
    return;
  }

  logger.info({ roomCode: room.roomCode, playerId }, "Player departed");
  markPlayerDeparted(room, playerId, logger, roomManager);

  try {
    ws.close(4000, "LEAVE_ROOM");
  } catch (error) {
    logger.warn({ error, roomCode: room.roomCode }, "Failed to close WebSocket after LEAVE_ROOM");
  }
}

export function markPlayerDeparted(
  room: Room,
  playerId: string,
  logger: FastifyBaseLogger,
  roomManager: RoomManager,
): void {
  const player = room.players.get(playerId);
  if (!player) return;

  const gs = room.gameState;
  const phase = gs?.gamePhase;
  const isLobbyOrScoreboard =
    gs === null || phase === "lobby" || phase === "scoreboard" || phase === "rematch";

  if (isLobbyOrScoreboard) {
    const playerName = player.displayName;
    const wasHost = player.isHost;
    releaseSeat(room, playerId);
    if (wasHost) {
      const migration = migrateHost(room, logger);
      if (migration.newHostId) {
        const newHost = room.players.get(migration.newHostId);
        broadcastStateToRoom(room, undefined, {
          type: "HOST_PROMOTED",
          previousHostId: playerId,
          newHostId: migration.newHostId,
          newHostName: newHost?.displayName ?? "",
        });
      }
    }
    broadcastStateToRoom(room, undefined, {
      type: "PLAYER_DEPARTED",
      playerId,
      playerName,
    });
    logger.info({ roomCode: room.roomCode, playerId }, "Lobby/scoreboard leave — seat released");
    return;
  }

  room.seatStatus.departedPlayerIds.add(playerId);
  player.connected = false;

  const graceTimer = room.graceTimers.get(playerId);
  if (graceTimer) {
    clearTimeout(graceTimer);
    room.graceTimers.delete(playerId);
  }

  if (room.turnTimer.playerId === playerId) {
    cancelTurnTimer(room, logger);
  }

  stripAfkVoteFromDepartingPlayer(room, playerId, logger);

  const playerName = player.displayName;
  broadcastStateToRoom(room, undefined, {
    type: "PLAYER_DEPARTED",
    playerId,
    playerName,
  });

  if (room.seatStatus.departedPlayerIds.size >= 2) {
    cancelDepartureVote(room, logger, "multi_departure");
    autoEndGameOnDeparture(room, logger, roomManager);
    return;
  }

  if (countLivingPlayersForAutoEnd(room) < 2) {
    cancelDepartureVote(room, logger, "multi_departure");
    autoEndGameOnDeparture(room, logger, roomManager);
    return;
  }

  startDepartureVote(room, playerId, playerName, logger, roomManager);
}

export function startDepartureVote(
  room: Room,
  targetPlayerId: string,
  targetPlayerName: string,
  logger: FastifyBaseLogger,
  roomManager: RoomManager,
): void {
  if (room.votes.departure !== null) return;

  const expiresMs = getDepartureVoteTimeoutMs();
  const expiresAt = Date.now() + expiresMs;
  room.votes.departure = {
    targetPlayerId,
    targetPlayerName,
    startedAt: Date.now(),
    expiresAt,
    votes: new Map(),
  };

  startLifecycleTimer(room, "departure-vote-timeout", () => {
    handleDepartureVoteTimeoutExpiry(room, logger, roomManager);
  });

  broadcastStateToRoom(room, undefined, {
    type: "DEPARTURE_VOTE_STARTED",
    targetPlayerId,
    targetPlayerName,
    expiresAt,
  });
  logger.info({ roomCode: room.roomCode, targetPlayerId }, "Departure vote started");
}

export function handleDepartureVoteTimeoutExpiry(
  room: Room,
  logger: FastifyBaseLogger,
  roomManager: RoomManager,
): void {
  if (!room.votes.departure) return;
  if (room.pause.paused) {
    cancelDepartureVote(room, logger, "pause");
    return;
  }
  resolveDepartureVote(room, logger, roomManager, "timeout");
}

export function resolveDepartureVote(
  room: Room,
  logger: FastifyBaseLogger,
  roomManager: RoomManager,
  trigger: "vote" | "timeout",
): void {
  const state = room.votes.departure;
  if (!state) return;

  const target = state.targetPlayerId;
  const livingVoterCount = countLivingEligibleVoters(room, target);
  const threshold = Math.max(1, Math.ceil(livingVoterCount / 2));

  let deadSeatCount = 0;
  let endGameCount = 0;
  for (const v of state.votes.values()) {
    if (v === "dead_seat") deadSeatCount++;
    else endGameCount++;
  }

  let outcome: "dead_seat" | "end_game" | null = null;
  const deadWins = deadSeatCount >= threshold;
  const endWins = endGameCount >= threshold;
  if (deadWins && !endWins) outcome = "dead_seat";
  else if (endWins && !deadWins) outcome = "end_game";
  else if (deadWins && endWins) {
    outcome = null;
  } else if (trigger === "timeout") {
    outcome = "end_game";
  }

  if (!outcome) return;

  cancelLifecycleTimer(room, "departure-vote-timeout");
  room.votes.departure = null;

  broadcastStateToRoom(room, undefined, {
    type: "DEPARTURE_VOTE_RESOLVED",
    targetPlayerId: target,
    outcome,
  });

  if (outcome === "dead_seat") {
    convertToDeadSeat(room, target, logger, roomManager);
  } else {
    autoEndGameOnDeparture(room, logger, roomManager);
  }
}

export function handleDepartureVoteCastMessage(
  ws: WebSocket,
  session: PlayerSession,
  room: Room,
  parsed: Record<string, unknown>,
  logger: FastifyBaseLogger,
  roomManager: RoomManager,
): void {
  const targetPlayerId = parsed.targetPlayerId;
  const choice = parsed.choice;
  if (typeof targetPlayerId !== "string" || (choice !== "dead_seat" && choice !== "end_game")) {
    sendProtocolError(ws, logger, "INVALID_ACTION", "Invalid departure vote payload");
    return;
  }

  const voterId = session.player.playerId;
  const vs = room.votes.departure;
  if (!vs) {
    sendProtocolError(ws, logger, "NO_ACTIVE_DEPARTURE_VOTE", "No active departure vote");
    return;
  }
  if (vs.targetPlayerId !== targetPlayerId) {
    sendProtocolError(
      ws,
      logger,
      "INVALID_DEPARTURE_VOTE_TARGET",
      "Vote target does not match active vote",
    );
    return;
  }
  if (voterId === targetPlayerId) {
    sendProtocolError(ws, logger, "CANNOT_VOTE_ON_DEPARTED", "Cannot vote on departed player");
    return;
  }
  if (
    room.seatStatus.deadSeatPlayerIds.has(voterId) ||
    room.seatStatus.departedPlayerIds.has(voterId)
  ) {
    sendProtocolError(ws, logger, "INVALID_ACTION", "Cannot cast departure vote");
    return;
  }
  if (room.players.get(voterId)?.connected !== true) {
    sendProtocolError(ws, logger, "INVALID_ACTION", "Disconnected players cannot vote");
    return;
  }

  vs.votes.set(voterId, choice);
  broadcastStateToRoom(room, undefined, {
    type: "DEPARTURE_VOTE_CAST",
    voterId,
    targetPlayerId,
    choice,
  });
  resolveDepartureVote(room, logger, roomManager, "vote");
}

export function convertToDeadSeat(
  room: Room,
  playerId: string,
  logger: FastifyBaseLogger,
  roomManager: RoomManager,
): void {
  const subject = room.players.get(playerId);
  const wasHost = subject?.isHost ?? false;
  const playerName = subject?.displayName ?? "";

  room.seatStatus.departedPlayerIds.delete(playerId);
  room.seatStatus.deadSeatPlayerIds.add(playerId);
  room.sessions.delete(playerId);

  broadcastStateToRoom(room, undefined, {
    type: "PLAYER_CONVERTED_TO_DEAD_SEAT",
    playerId,
    playerName,
  });

  if (wasHost) {
    const migration = migrateHost(room, logger, { excludePlayerIds: new Set([playerId]) });
    if (migration.newHostId) {
      const newHost = room.players.get(migration.newHostId);
      broadcastStateToRoom(room, undefined, {
        type: "HOST_PROMOTED",
        previousHostId: playerId,
        newHostId: migration.newHostId,
        newHostName: newHost?.displayName ?? "",
      });
    }
  }

  drainCharlestonForDeadSeats(room, logger, roomManager);
  syncTurnTimer(room, logger, 0, roomManager);
  logger.info({ roomCode: room.roomCode, playerId }, "Player converted to dead seat");
}

export function resumeDepartureVoteIfNeeded(
  room: Room,
  logger: FastifyBaseLogger,
  roomManager: RoomManager,
): void {
  const gs = room.gameState;
  if (
    !gs ||
    gs.gamePhase === "scoreboard" ||
    gs.gamePhase === "rematch" ||
    gs.gamePhase === "lobby"
  ) {
    return;
  }
  if (room.votes.departure) return;

  if (room.seatStatus.departedPlayerIds.size >= 2) {
    autoEndGameOnDeparture(room, logger, roomManager);
    return;
  }

  const [firstId] = room.seatStatus.departedPlayerIds;
  if (!firstId) return;
  const name = room.players.get(firstId)?.displayName ?? "";
  startDepartureVote(room, firstId, name, logger, roomManager);
}
