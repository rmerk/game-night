import type { WebSocket } from "ws";
import type { FastifyBaseLogger } from "fastify";
import type { GameAction } from "@mahjong-game/shared";
import {
  PROTOCOL_VERSION,
  handleAction,
  createLobbyState,
  handleSocialOverrideTimeout,
  handleTableTalkTimeout,
  SOCIAL_OVERRIDE_TIMEOUT_SECONDS,
} from "@mahjong-game/shared";
import type { Room } from "../rooms/room";
import type { RoomManager } from "../rooms/room-manager";
import {
  mergeCompletedGameIntoSession,
  rotateDealerPlayerIdsForRematch,
} from "../rooms/session-scoring";
import { cancelLifecycleTimer, startLifecycleTimer } from "../rooms/room-lifecycle";
import { broadcastGameState, broadcastStateToRoom } from "./state-broadcaster";
import {
  cancelAfkVote,
  cancelTurnTimer,
  resetTurnTimerStateOnGameEnd,
  syncTurnTimer,
} from "./turn-timer";

function clearSocialOverrideTimer(room: Room): void {
  if (room.votes.socialOverrideTimer) {
    clearTimeout(room.votes.socialOverrideTimer);
    room.votes.socialOverrideTimer = null;
  }
}

function clearTableTalkReportTimer(room: Room): void {
  if (room.votes.tableTalkReportTimer) {
    clearTimeout(room.votes.tableTalkReportTimer);
    room.votes.tableTalkReportTimer = null;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validateCallTileIdsField(
  action: Record<string, unknown>,
  actionType: string,
): string | null {
  const tileIds = action.tileIds;
  if (!isStringArray(tileIds)) {
    return `${actionType} requires tileIds: string[]`;
  }
  if (tileIds.length === 0) {
    return `${actionType} requires at least one tileId`;
  }
  if (new Set(tileIds).size !== tileIds.length) {
    return `${actionType} tileIds must be unique`;
  }
  return null;
}

function validateStartGamePayload(action: Record<string, unknown>): string | null {
  const rawIds = action.playerIds;
  if (rawIds !== undefined && !isStringArray(rawIds)) {
    return "START_GAME playerIds must be string[] if provided";
  }
  const seed = action.seed;
  if (seed !== undefined && (typeof seed !== "number" || !Number.isFinite(seed))) {
    return "START_GAME seed must be a finite number if provided";
  }
  return null;
}

function validateActionPayload(action: Record<string, unknown>): string | null {
  const type = action.type;
  if (typeof type !== "string") {
    return "Action type is required";
  }

  // Runtime payload checks prevent malformed ACTION payloads from reaching shared handlers.
  switch (type) {
    case "START_GAME":
      return validateStartGamePayload(action);
    case "DRAW_TILE":
    case "PASS_CALL":
    case "RETRACT_CALL":
    case "DECLARE_MAHJONG":
    case "CANCEL_MAHJONG":
    case "CONFIRM_INVALID_MAHJONG":
    case "CHALLENGE_MAHJONG":
    case "SHOW_HAND":
      return null;
    case "DISCARD_TILE":
      return typeof action.tileId === "string" ? null : "DISCARD_TILE requires string tileId";
    case "JOKER_EXCHANGE":
      return typeof action.jokerGroupId === "string" && typeof action.naturalTileId === "string"
        ? null
        : "JOKER_EXCHANGE requires string jokerGroupId and naturalTileId";
    case "CHARLESTON_PASS":
      return isStringArray(action.tileIds) && action.tileIds.length === 3
        ? null
        : "CHARLESTON_PASS requires exactly 3 tileIds";
    case "CALL_PUNG":
    case "CALL_KONG":
    case "CALL_QUINT":
    case "CALL_NEWS":
    case "CALL_DRAGON_SET":
    case "CALL_MAHJONG":
    case "CONFIRM_CALL":
      return validateCallTileIdsField(action, type);
    case "CHARLESTON_VOTE":
      return typeof action.accept === "boolean" ? null : "CHARLESTON_VOTE requires boolean accept";
    case "CHALLENGE_VOTE":
      return action.vote === "valid" || action.vote === "invalid"
        ? null
        : "CHALLENGE_VOTE requires vote: 'valid' | 'invalid'";
    case "SOCIAL_OVERRIDE_REQUEST":
      return typeof action.description === "string"
        ? null
        : "SOCIAL_OVERRIDE_REQUEST requires string description";
    case "SOCIAL_OVERRIDE_VOTE":
      return typeof action.approve === "boolean"
        ? null
        : "SOCIAL_OVERRIDE_VOTE requires boolean approve";
    case "TABLE_TALK_REPORT":
      return typeof action.reportedPlayerId === "string" && typeof action.description === "string"
        ? null
        : "TABLE_TALK_REPORT requires string reportedPlayerId and description";
    case "TABLE_TALK_VOTE":
      return typeof action.approve === "boolean"
        ? null
        : "TABLE_TALK_VOTE requires boolean approve";
    case "COURTESY_PASS": {
      const count = action.count;
      if (typeof count !== "number" || !Number.isInteger(count)) {
        return "COURTESY_PASS requires integer count";
      }
      if (count < 0 || count > 3) {
        return "COURTESY_PASS count must be between 0 and 3";
      }
      if (!isStringArray(action.tileIds)) {
        return "COURTESY_PASS requires tileIds: string[]";
      }
      return action.tileIds.length === count
        ? null
        : "COURTESY_PASS tileIds length must equal count";
    }
    default:
      return "Unsupported action type";
  }
}

/**
 * Build a typed GameAction after validateActionPayload succeeds.
 * Keeps construction aligned with the same field checks as validation.
 */
function parseGameAction(action: Record<string, unknown>, playerId: string): GameAction | null {
  const type = action.type;
  if (typeof type !== "string") {
    return null;
  }

  const tileIds = action.tileIds;
  const tileIdsArr = isStringArray(tileIds) ? [...tileIds] : null;

  switch (type) {
    case "START_GAME": {
      const rawIds = action.playerIds;
      const playerIds = isStringArray(rawIds) ? [...rawIds] : [];
      const seed = action.seed;
      if (seed !== undefined && (typeof seed !== "number" || !Number.isFinite(seed))) {
        return null;
      }
      return seed === undefined
        ? { type: "START_GAME", playerIds }
        : { type: "START_GAME", playerIds, seed };
    }
    case "DRAW_TILE":
      return { type: "DRAW_TILE", playerId };
    case "CHARLESTON_PASS":
      return tileIdsArr && tileIdsArr.length === 3
        ? { type: "CHARLESTON_PASS", playerId, tileIds: tileIdsArr }
        : null;
    case "CHARLESTON_VOTE":
      return typeof action.accept === "boolean"
        ? { type: "CHARLESTON_VOTE", playerId, accept: action.accept }
        : null;
    case "COURTESY_PASS": {
      const count = action.count;
      if (typeof count !== "number" || !Number.isInteger(count) || count < 0 || count > 3) {
        return null;
      }
      if (!tileIdsArr || tileIdsArr.length !== count) {
        return null;
      }
      return { type: "COURTESY_PASS", playerId, count, tileIds: tileIdsArr };
    }
    case "DISCARD_TILE":
      return typeof action.tileId === "string"
        ? { type: "DISCARD_TILE", playerId, tileId: action.tileId }
        : null;
    case "JOKER_EXCHANGE":
      return typeof action.jokerGroupId === "string" && typeof action.naturalTileId === "string"
        ? {
            type: "JOKER_EXCHANGE",
            playerId,
            jokerGroupId: action.jokerGroupId,
            naturalTileId: action.naturalTileId,
          }
        : null;
    case "PASS_CALL":
      return { type: "PASS_CALL", playerId };
    case "CALL_PUNG":
      return tileIdsArr ? { type: "CALL_PUNG", playerId, tileIds: tileIdsArr } : null;
    case "CALL_KONG":
      return tileIdsArr ? { type: "CALL_KONG", playerId, tileIds: tileIdsArr } : null;
    case "CALL_QUINT":
      return tileIdsArr ? { type: "CALL_QUINT", playerId, tileIds: tileIdsArr } : null;
    case "CALL_NEWS":
      return tileIdsArr ? { type: "CALL_NEWS", playerId, tileIds: tileIdsArr } : null;
    case "CALL_DRAGON_SET":
      return tileIdsArr ? { type: "CALL_DRAGON_SET", playerId, tileIds: tileIdsArr } : null;
    case "CALL_MAHJONG":
      return tileIdsArr ? { type: "CALL_MAHJONG", playerId, tileIds: tileIdsArr } : null;
    case "CONFIRM_CALL":
      return tileIdsArr ? { type: "CONFIRM_CALL", playerId, tileIds: tileIdsArr } : null;
    case "RETRACT_CALL":
      return { type: "RETRACT_CALL", playerId };
    case "DECLARE_MAHJONG":
      return { type: "DECLARE_MAHJONG", playerId };
    case "CANCEL_MAHJONG":
      return { type: "CANCEL_MAHJONG", playerId };
    case "CONFIRM_INVALID_MAHJONG":
      return { type: "CONFIRM_INVALID_MAHJONG", playerId };
    case "CHALLENGE_MAHJONG":
      return { type: "CHALLENGE_MAHJONG", playerId };
    case "CHALLENGE_VOTE":
      return action.vote === "valid" || action.vote === "invalid"
        ? { type: "CHALLENGE_VOTE", playerId, vote: action.vote }
        : null;
    case "SOCIAL_OVERRIDE_REQUEST":
      return typeof action.description === "string"
        ? { type: "SOCIAL_OVERRIDE_REQUEST", playerId, description: action.description }
        : null;
    case "SOCIAL_OVERRIDE_VOTE":
      return typeof action.approve === "boolean"
        ? { type: "SOCIAL_OVERRIDE_VOTE", playerId, approve: action.approve }
        : null;
    case "TABLE_TALK_REPORT":
      return typeof action.reportedPlayerId === "string" && typeof action.description === "string"
        ? {
            type: "TABLE_TALK_REPORT",
            playerId,
            reportedPlayerId: action.reportedPlayerId,
            description: action.description,
          }
        : null;
    case "TABLE_TALK_VOTE":
      return typeof action.approve === "boolean"
        ? { type: "TABLE_TALK_VOTE", playerId, approve: action.approve }
        : null;
    case "SHOW_HAND":
      return { type: "SHOW_HAND", playerId };
    default:
      return null;
  }
}

/**
 * Handle an ACTION message from a client.
 * Resolves the player's identity from the connection, overwrites playerId,
 * dispatches to the game engine, and broadcasts results.
 */
export function handleActionMessage(
  ws: WebSocket,
  message: Record<string, unknown>,
  room: Room,
  playerId: string,
  logger: FastifyBaseLogger,
  roomManager?: RoomManager,
): void {
  const rawAction: unknown = message.action;
  if (!isPlainObject(rawAction)) {
    sendActionError(ws, logger, "INVALID_ACTION", "Action payload is required");
    return;
  }

  const actionObj = rawAction;
  if (!actionObj.type || typeof actionObj.type !== "string") {
    sendActionError(ws, logger, "INVALID_ACTION", "Action type is required");
    return;
  }

  const validationError = validateActionPayload(actionObj);
  if (validationError) {
    sendActionError(ws, logger, "INVALID_ACTION", validationError);
    return;
  }

  if (room.pause.paused) {
    sendActionError(ws, logger, "ROOM_PAUSED", "Room is paused waiting for players to reconnect");
    return;
  }

  if (room.gameState && room.seatStatus.deadSeatPlayerIds.has(playerId)) {
    sendActionError(ws, logger, "DEAD_SEAT", "Dead seat players cannot take actions");
    return;
  }

  if (room.seatStatus.departedPlayerIds.has(playerId)) {
    sendActionError(ws, logger, "PLAYER_DEPARTED", "Departed players cannot take actions");
    return;
  }

  // START_GAME is the only action allowed before gameState exists
  if (!room.gameState) {
    if (actionObj.type === "START_GAME") {
      handleStartGameAction(ws, room, playerId, logger, roomManager);
      return;
    }
    sendActionError(ws, logger, "GAME_NOT_STARTED", "No active game in this room");
    return;
  }

  const authenticatedAction = parseGameAction(actionObj, playerId);
  if (!authenticatedAction) {
    sendActionError(ws, logger, "INVALID_ACTION", "Action payload could not be parsed");
    return;
  }

  logger.info(
    { roomCode: room.roomCode, playerId, actionType: authenticatedAction.type },
    "Processing game action",
  );

  const result = handleAction(room.gameState, authenticatedAction);

  if (result.accepted) {
    logger.info(
      { roomCode: room.roomCode, playerId, actionType: authenticatedAction.type },
      "Action accepted",
    );
    broadcastGameState(room, room.gameState, result.resolved);

    room.turnTimer.consecutiveTimeouts.delete(playerId);

    const postActionGameState = room.gameState;
    if (
      postActionGameState &&
      (postActionGameState.gamePhase === "scoreboard" ||
        postActionGameState.gamePhase === "rematch")
    ) {
      resetTurnTimerStateOnGameEnd(room, logger);
    } else {
      if (room.votes.afk?.targetPlayerId === playerId) {
        cancelAfkVote(room, logger, "target_active");
      }
      syncTurnTimer(room, logger, 0, roomManager);
    }

    if (!room.gameState.socialOverrideState) {
      clearSocialOverrideTimer(room);
    } else if (authenticatedAction.type === "SOCIAL_OVERRIDE_REQUEST") {
      clearSocialOverrideTimer(room);
      room.votes.socialOverrideTimer = setTimeout(() => {
        room.votes.socialOverrideTimer = null;
        const gs = room.gameState;
        if (!gs?.socialOverrideState) return;
        const timeoutResult = handleSocialOverrideTimeout(gs);
        if (timeoutResult.accepted) {
          broadcastGameState(room, gs, timeoutResult.resolved);
          if (gs.gamePhase === "scoreboard" || gs.gamePhase === "rematch") {
            resetTurnTimerStateOnGameEnd(room, logger);
          } else {
            syncTurnTimer(room, logger, 0, roomManager);
          }
        }
      }, SOCIAL_OVERRIDE_TIMEOUT_SECONDS * 1000);
    }

    if (!room.gameState.tableTalkReportState) {
      clearTableTalkReportTimer(room);
    } else if (authenticatedAction.type === "TABLE_TALK_REPORT") {
      clearTableTalkReportTimer(room);
      room.votes.tableTalkReportTimer = setTimeout(() => {
        room.votes.tableTalkReportTimer = null;
        const gs = room.gameState;
        if (!gs?.tableTalkReportState) return;
        const timeoutResult = handleTableTalkTimeout(gs);
        if (timeoutResult.accepted) {
          broadcastGameState(room, gs, timeoutResult.resolved);
          if (gs.gamePhase === "scoreboard" || gs.gamePhase === "rematch") {
            resetTurnTimerStateOnGameEnd(room, logger);
          } else {
            syncTurnTimer(room, logger, 0, roomManager);
          }
        }
      }, SOCIAL_OVERRIDE_TIMEOUT_SECONDS * 1000);
    }

    // Idle timeout: start timer when game reaches scoreboard phase
    if (roomManager && room.gameState.gamePhase === "scoreboard") {
      startLifecycleTimer(room, "idle-timeout", () => {
        roomManager.cleanupRoom(room.roomCode, "idle_timeout");
      });
    }
  } else {
    logger.info(
      {
        roomCode: room.roomCode,
        playerId,
        actionType: authenticatedAction.type,
        reason: result.reason,
      },
      "Action rejected",
    );
    sendActionError(ws, logger, "ACTION_REJECTED", result.reason ?? "Action was rejected");
  }
}

/**
 * Host-only rematch gate after scoreboard/rematch phase (Story 4B.7).
 * Four eligible connected seats with no dead-seat / departed flags → same path as START_GAME.
 */
/**
 * Host ends the room session from scoreboard — snapshot totals, return to lobby (Story 5B.4).
 */
export function handleEndSession(
  ws: WebSocket,
  room: Room,
  playerId: string,
  logger: FastifyBaseLogger,
): void {
  const player = room.players.get(playerId);
  if (!player?.isHost) {
    logger.info({ roomCode: room.roomCode, playerId }, "END_SESSION rejected: not host");
    sendActionError(ws, logger, "NOT_HOST", "Only the host can end the session");
    return;
  }
  if (room.gameState === null) {
    sendActionError(ws, logger, "NO_ACTIVE_GAME", "No game in progress");
    return;
  }
  const phase = room.gameState.gamePhase;
  if (phase !== "scoreboard" && phase !== "rematch") {
    sendActionError(
      ws,
      logger,
      "NOT_BETWEEN_GAMES",
      "End session is only available after a game ends",
    );
    return;
  }
  const gs = room.gameState;
  mergeCompletedGameIntoSession(room, gs);
  const sessionTotals = { ...room.sessionHistory.scoresFromPriorGames };
  const sessionGameHistory = [...room.sessionHistory.gameHistory];
  room.sessionHistory.scoresFromPriorGames = {};
  room.sessionHistory.gameHistory = [];
  room.gameState = null;
  cancelLifecycleTimer(room, "idle-timeout");
  logger.info({ roomCode: room.roomCode, playerId }, "Session ended by host");
  broadcastStateToRoom(room, undefined, {
    type: "SESSION_ENDED",
    sessionTotals,
    sessionGameHistory,
  });
}

export function handleRematch(
  ws: WebSocket,
  room: Room,
  playerId: string,
  logger: FastifyBaseLogger,
  roomManager?: RoomManager,
): void {
  const player = room.players.get(playerId);
  if (!player?.isHost) {
    logger.info({ roomCode: room.roomCode, playerId }, "REMATCH rejected: not host");
    sendActionError(ws, logger, "NOT_HOST", "Only the host can start a rematch");
    return;
  }
  if (room.gameState === null) {
    sendActionError(ws, logger, "NOT_BETWEEN_GAMES", "Rematch only available after a game ends");
    return;
  }
  const phase = room.gameState.gamePhase;
  if (phase !== "scoreboard" && phase !== "rematch") {
    sendActionError(ws, logger, "NOT_BETWEEN_GAMES", "Rematch only available after a game ends");
    return;
  }

  const connectedCount = [...room.players.values()].filter((p) => p.connected).length;
  const canRematch =
    connectedCount === 4 &&
    room.seatStatus.deadSeatPlayerIds.size === 0 &&
    room.seatStatus.departedPlayerIds.size === 0;

  if (!canRematch) {
    // Eligible = connected AND not dead-seat AND not departed (departed may still be tracked
    // even after seat release). Avoids double-counting from overlapping sets.
    const eligible = [...room.players.values()].filter(
      (p) =>
        p.connected &&
        !room.seatStatus.deadSeatPlayerIds.has(p.playerId) &&
        !room.seatStatus.departedPlayerIds.has(p.playerId),
    ).length;
    const missingSeats = Math.max(1, 4 - eligible);

    cancelTurnTimer(room, logger);
    room.turnTimer.consecutiveTimeouts.clear();
    if (room.votes.afk) {
      cancelLifecycleTimer(room, "afk-vote-timeout");
      room.votes.afk = null;
    }
    room.turnTimer.afkVoteCooldownPlayerIds.clear();
    room.seatStatus.deadSeatPlayerIds.clear();
    room.seatStatus.departedPlayerIds.clear();
    if (room.votes.departure) {
      cancelLifecycleTimer(room, "departure-vote-timeout");
      room.votes.departure = null;
    }
    clearSocialOverrideTimer(room);
    clearTableTalkReportTimer(room);

    room.gameState = null;
    logger.info(
      { roomCode: room.roomCode, connectedCount, missingSeats },
      "REMATCH: not enough eligible seats — returned to lobby",
    );
    broadcastStateToRoom(room, undefined, {
      type: "REMATCH_WAITING_FOR_PLAYERS",
      missingSeats,
    });
    return;
  }

  handleStartGameAction(ws, room, playerId, logger, roomManager);
}

/**
 * Handle START_GAME action from lobby state.
 * Server-side authorization: only the host can start, and exactly 4 players must be connected.
 * The shared engine handles game-level validation (phase check, player count, dealing).
 */
function handleStartGameAction(
  ws: WebSocket,
  room: Room,
  playerId: string,
  logger: FastifyBaseLogger,
  roomManager?: RoomManager,
): void {
  // 1. Validate — host authorization (server-side concern)
  const player = room.players.get(playerId);
  if (!player?.isHost) {
    logger.info({ roomCode: room.roomCode, playerId }, "START_GAME rejected: not host");
    sendActionError(ws, logger, "NOT_HOST", "Only the host can start the game");
    return;
  }

  // 2. Validate — exactly 4 connected players
  const connectedCount = Array.from(room.players.values()).filter((p) => p.connected).length;
  if (connectedCount < 4) {
    logger.info(
      { roomCode: room.roomCode, playerId, connectedCount },
      "START_GAME rejected: not enough players",
    );
    sendActionError(
      ws,
      logger,
      "NOT_ENOUGH_PLAYERS",
      `Need 4 players, only ${connectedCount} connected`,
    );
    return;
  }

  // 3. Build playerIds: rematch rotates dealer CCW; cold start uses sorted order (Story 5B.4)
  const preGame = room.gameState;
  let playerIds: string[];
  if (
    preGame &&
    Object.keys(preGame.players).length === 4 &&
    (preGame.gamePhase === "scoreboard" || preGame.gamePhase === "rematch")
  ) {
    mergeCompletedGameIntoSession(room, preGame);
    cancelLifecycleTimer(room, "idle-timeout");
    const rotated = rotateDealerPlayerIdsForRematch(preGame);
    playerIds = rotated ?? Array.from(room.players.keys()).sort();
  } else {
    playerIds = Array.from(room.players.keys()).sort();
  }

  // 4. Initialize lobby state and dispatch to engine
  room.gameState = createLobbyState();
  const result = handleAction(room.gameState, {
    type: "START_GAME",
    playerIds,
    jokerRulesMode: room.jokerRulesMode,
  });

  if (result.accepted) {
    logger.info({ roomCode: room.roomCode, playerId }, "Game started");
    cancelTurnTimer(room, logger);
    room.turnTimer.consecutiveTimeouts.clear();
    if (room.votes.afk) {
      cancelLifecycleTimer(room, "afk-vote-timeout");
      room.votes.afk = null;
    }
    room.turnTimer.afkVoteCooldownPlayerIds.clear();
    room.seatStatus.deadSeatPlayerIds.clear();
    room.seatStatus.departedPlayerIds.clear();
    if (room.votes.departure) {
      cancelLifecycleTimer(room, "departure-vote-timeout");
      room.votes.departure = null;
    }
    broadcastGameState(room, room.gameState, result.resolved);
    syncTurnTimer(room, logger, 0, roomManager);
  } else {
    // Engine rejected — clean up the lobby state
    room.gameState = null;
    logger.info(
      { roomCode: room.roomCode, playerId, reason: result.reason },
      "START_GAME rejected by engine",
    );
    sendActionError(ws, logger, "ACTION_REJECTED", result.reason ?? "Failed to start game");
  }
}

function sendActionError(
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
    logger.warn({ error, code }, "Failed to send action ERROR to client");
  }
}
