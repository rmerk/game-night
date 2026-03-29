import type { WebSocket } from "ws";
import type { FastifyBaseLogger } from "fastify";
import type { GameAction } from "@mahjong-game/shared";
import { PROTOCOL_VERSION, handleAction } from "@mahjong-game/shared";
import type { Room } from "../rooms/room";
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

  // Game must be active to accept actions
  if (!room.gameState) {
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
