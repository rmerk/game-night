import { Buffer } from "node:buffer";
import type { FastifyBaseLogger } from "fastify";
import { WebSocket } from "ws";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import type { Room } from "../rooms/room";

/** Outbound WebSocket JSON frame budget (AR30); match ws-server `maxPayload`. */
export const WS_MAX_PAYLOAD_BYTES = 65_536;

/**
 * Serialize CHAT_HISTORY for one client. Drops entries from the **oldest** end until the
 * UTF-8 byte size of the JSON is ≤ WS_MAX_PAYLOAD_BYTES. STATE_UPDATE must be sent first;
 * this string is sent on the same socket immediately after that message (join / reconnect / REQUEST_STATE).
 */
export function buildChatHistoryPayloadJson(room: Room): string {
  const history = room.chatHistory;
  for (let start = 0; start <= history.length; start += 1) {
    const payload = {
      version: PROTOCOL_VERSION,
      type: "CHAT_HISTORY" as const,
      messages: history.slice(start),
    };
    const json = JSON.stringify(payload);
    if (Buffer.byteLength(json, "utf8") <= WS_MAX_PAYLOAD_BYTES) {
      return json;
    }
  }
  return JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "CHAT_HISTORY",
    messages: [],
  });
}

export function sendChatHistoryAfterStateUpdate(
  ws: WebSocket,
  room: Room,
  logger: FastifyBaseLogger,
  context: string,
): void {
  if (ws.readyState !== WebSocket.OPEN) {
    logger.debug({ context, readyState: ws.readyState }, "Skipping send on non-open WebSocket");
    return;
  }
  const json = buildChatHistoryPayloadJson(room);
  try {
    ws.send(json);
  } catch (error) {
    logger.warn({ error, context }, "Failed to send WebSocket message");
  }
}
