import type { FastifyBaseLogger } from "fastify";
import { handleAction } from "@mahjong-game/shared";
import type { Room } from "../rooms/room";
import type { RoomManager } from "../rooms/room-manager";
import { broadcastGameState } from "./state-broadcaster";
import { pickAutoDiscardTileId, syncTurnTimer } from "./turn-timer";

/**
 * Play-phase grace expiry: auto-pass in call window, or auto-discard on the current player's discard step.
 * Charleston and scoreboard are handled elsewhere (applyCharlestonAutoAction / no-op).
 */
export function applyGraceExpiryGameActions(
  room: Room,
  playerId: string,
  logger: FastifyBaseLogger,
  roomManager?: RoomManager,
): void {
  if (room.paused) return;
  if (!room.gameState) return;
  const gs = room.gameState;

  if (gs.gamePhase === "scoreboard" || gs.gamePhase === "rematch") {
    return;
  }

  if (gs.gamePhase !== "play") {
    return;
  }

  if (gs.callWindow && gs.turnPhase === "callWindow") {
    const cw = gs.callWindow;
    if (cw.discarderId !== playerId && !cw.passes.includes(playerId)) {
      const result = handleAction(gs, { type: "PASS_CALL", playerId });
      if (result.accepted) {
        broadcastGameState(room, gs, result.resolved);
        syncTurnTimer(room, logger, 0, roomManager);
        logger.info(
          { roomCode: room.roomCode, playerId },
          "Grace expiry: auto PASS_CALL for disconnected player",
        );
      } else {
        logger.warn(
          { roomCode: room.roomCode, playerId, reason: result.reason },
          "Grace expiry: PASS_CALL failed",
        );
      }
    }
    return;
  }

  if (gs.currentTurn === playerId && gs.turnPhase === "discard") {
    const rack = gs.players[playerId]?.rack;
    if (!rack) return;
    const tileId = pickAutoDiscardTileId(rack);
    if (!tileId) {
      logger.warn(
        { roomCode: room.roomCode, playerId },
        "Grace expiry: no non-joker tile to auto-discard",
      );
      return;
    }
    const result = handleAction(gs, { type: "DISCARD_TILE", playerId, tileId });
    if (result.accepted) {
      broadcastGameState(room, gs, result.resolved);
      syncTurnTimer(room, logger, 0, roomManager);
      logger.info(
        { roomCode: room.roomCode, playerId, tileId },
        "Grace expiry: auto DISCARD_TILE for disconnected player",
      );
    } else {
      logger.warn(
        { roomCode: room.roomCode, playerId, reason: result.reason },
        "Grace expiry: DISCARD_TILE failed",
      );
    }
  }
}
