import type { WebSocket } from "ws";
import type { FastifyBaseLogger } from "fastify";
import type { GameAction } from "@mahjong-game/shared";
import { PROTOCOL_VERSION, handleAction, createLobbyState } from "@mahjong-game/shared";
import type { Room } from "../rooms/room";
import type { RoomManager } from "../rooms/room-manager";
import { startLifecycleTimer, cancelLifecycleTimer } from "../rooms/room-lifecycle";
import { broadcastGameState } from "./state-broadcaster";

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
  if (!rawAction || typeof rawAction !== "object") {
    sendActionError(ws, "INVALID_ACTION", "Action payload is required");
    return;
  }

  const actionObj = rawAction as Record<string, unknown>;
  if (!actionObj.type || typeof actionObj.type !== "string") {
    sendActionError(ws, "INVALID_ACTION", "Action type is required");
    return;
  }

  // START_GAME is the only action allowed before gameState exists
  if (!room.gameState) {
    if (actionObj.type === "START_GAME") {
      handleStartGameAction(ws, room, playerId, logger);
      return;
    }
    sendActionError(ws, "GAME_NOT_STARTED", "No active game in this room");
    return;
  }

  // SECURITY: Overwrite playerId with authenticated identity — never trust client
  // The action is validated by the game engine's exhaustive switch — unknown types are rejected
  const authenticatedAction = { ...actionObj, playerId } as GameAction;

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

    // Idle timeout: start timer when game reaches scoreboard phase
    if (roomManager && room.gameState.gamePhase === "scoreboard") {
      startLifecycleTimer(room, "idle-timeout", () => {
        roomManager.cleanupRoom(room.roomCode, "idle_timeout");
      });
    }

    // Cancel idle timer if REMATCH action dispatched (future action type)
    if ((authenticatedAction.type as string) === "REMATCH") {
      cancelLifecycleTimer(room, "idle-timeout");
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
    sendActionError(ws, "ACTION_REJECTED", result.reason ?? "Action was rejected");
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
    sendActionError(ws, "NOT_HOST", "Only the host can start the game");
    return;
  }

  // 2. Validate — exactly 4 connected players
  const connectedCount = Array.from(room.players.values()).filter((p) => p.connected).length;
  if (connectedCount < 4) {
    logger.info(
      { roomCode: room.roomCode, playerId, connectedCount },
      "START_GAME rejected: not enough players",
    );
    sendActionError(ws, "NOT_ENOUGH_PLAYERS", `Need 4 players, only ${connectedCount} connected`);
    return;
  }

  // 3. Build playerIds in seat order (player-0 through player-3)
  const playerIds = Array.from(room.players.keys()).sort();

  // 4. Initialize lobby state and dispatch to engine
  room.gameState = createLobbyState();
  const result = handleAction(room.gameState, {
    type: "START_GAME",
    playerIds,
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
    sendActionError(ws, "ACTION_REJECTED", result.reason ?? "Failed to start game");
  }
}

function sendActionError(ws: WebSocket, code: string, message: string): void {
  ws.send(
    JSON.stringify({
      version: PROTOCOL_VERSION,
      type: "ERROR",
      code,
      message,
    }),
  );
}
