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
import { startLifecycleTimer } from "../rooms/room-lifecycle";
import { broadcastGameState } from "./state-broadcaster";

function clearSocialOverrideTimer(room: Room): void {
  if (room.socialOverrideTimer) {
    clearTimeout(room.socialOverrideTimer);
    room.socialOverrideTimer = null;
  }
}

function clearTableTalkReportTimer(room: Room): void {
  if (room.tableTalkReportTimer) {
    clearTimeout(room.tableTalkReportTimer);
    room.tableTalkReportTimer = null;
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

  if (room.paused) {
    sendActionError(ws, logger, "ROOM_PAUSED", "Room is paused waiting for players to reconnect");
    return;
  }

  // START_GAME is the only action allowed before gameState exists
  if (!room.gameState) {
    if (actionObj.type === "START_GAME") {
      handleStartGameAction(ws, room, playerId, logger);
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

    if (!room.gameState.socialOverrideState) {
      clearSocialOverrideTimer(room);
    } else if (authenticatedAction.type === "SOCIAL_OVERRIDE_REQUEST") {
      clearSocialOverrideTimer(room);
      room.socialOverrideTimer = setTimeout(() => {
        room.socialOverrideTimer = null;
        const gs = room.gameState;
        if (!gs?.socialOverrideState) return;
        const timeoutResult = handleSocialOverrideTimeout(gs);
        if (timeoutResult.accepted) {
          broadcastGameState(room, gs, timeoutResult.resolved);
        }
      }, SOCIAL_OVERRIDE_TIMEOUT_SECONDS * 1000);
    }

    if (!room.gameState.tableTalkReportState) {
      clearTableTalkReportTimer(room);
    } else if (authenticatedAction.type === "TABLE_TALK_REPORT") {
      clearTableTalkReportTimer(room);
      room.tableTalkReportTimer = setTimeout(() => {
        room.tableTalkReportTimer = null;
        const gs = room.gameState;
        if (!gs?.tableTalkReportState) return;
        const timeoutResult = handleTableTalkTimeout(gs);
        if (timeoutResult.accepted) {
          broadcastGameState(room, gs, timeoutResult.resolved);
        }
      }, SOCIAL_OVERRIDE_TIMEOUT_SECONDS * 1000);
    }

    // Idle timeout: start timer when game reaches scoreboard phase
    if (roomManager && room.gameState.gamePhase === "scoreboard") {
      startLifecycleTimer(room, "idle-timeout", () => {
        roomManager.cleanupRoom(room.roomCode, "idle_timeout");
      });
    }
    // Future: cancel idle-timeout when a REMATCH (or similar) GameAction is added to the shared type.
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
 * Handle START_GAME action from lobby state.
 * Server-side authorization: only the host can start, and exactly 4 players must be connected.
 * The shared engine handles game-level validation (phase check, player count, dealing).
 */
function handleStartGameAction(
  ws: WebSocket,
  room: Room,
  playerId: string,
  logger: FastifyBaseLogger,
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

  // 3. Build playerIds in seat order (player-0 through player-3)
  const playerIds = Array.from(room.players.keys()).sort();

  // 4. Initialize lobby state and dispatch to engine
  room.gameState = createLobbyState();
  const result = handleAction(room.gameState, {
    type: "START_GAME",
    playerIds,
    jokerRulesMode: room.jokerRulesMode,
  });

  if (result.accepted) {
    logger.info({ roomCode: room.roomCode, playerId }, "Game started");
    broadcastGameState(room, room.gameState, result.resolved);
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
