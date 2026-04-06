import type { FastifyBaseLogger } from "fastify";
import { WebSocket } from "ws";

export function trySendJson(
  ws: WebSocket,
  payload: Record<string, unknown>,
  logger: FastifyBaseLogger,
  context: string,
): void {
  if (ws.readyState !== WebSocket.OPEN) {
    logger.debug({ context, readyState: ws.readyState }, "Skipping send on non-open WebSocket");
    return;
  }

  try {
    ws.send(JSON.stringify(payload));
  } catch (error) {
    logger.warn({ error, context }, "Failed to send WebSocket message");
  }
}
