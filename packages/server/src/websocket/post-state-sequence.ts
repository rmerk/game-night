import type { FastifyBaseLogger } from "fastify";
import { WebSocket } from "ws";
import type { StateUpdateMessage } from "@mahjong-game/shared";
import type { Room } from "../rooms/room";
import { sendChatHistoryAfterStateUpdate } from "./chat-history";

/**
 * Canonical per-socket post-STATE_UPDATE send order lives here. New messages added in Epic 4B
 * (PLAYER_RECONNECTED post-state metadata, grace-cancel signals, phase fallbacks) that must land on
 * the SAME socket immediately after STATE_UPDATE go INSIDE this helper and nowhere else. Fan-out
 * broadcasts via broadcastStateToRoom are a separate mechanism. See 6A retrospective action item
 * 6a-retro-2.
 */
export function sendPostStateSequence(
  ws: WebSocket,
  stateMessage: StateUpdateMessage,
  room: Room,
  logger: FastifyBaseLogger,
  context: string,
): void {
  if (ws.readyState !== WebSocket.OPEN) {
    logger.debug({ context, readyState: ws.readyState }, "Skipping send on non-open WebSocket");
    return;
  }

  try {
    ws.send(JSON.stringify(stateMessage));
  } catch (error) {
    logger.warn({ error, context }, "Failed to send WebSocket message");
    return;
  }

  sendChatHistoryAfterStateUpdate(ws, room, logger, context);
}
