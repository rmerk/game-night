import type { WebSocket, RawData } from "ws";
import type { FastifyBaseLogger } from "fastify";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";

export interface ParsedMessage {
  version: number;
  type: string;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function rawDataToString(data: RawData): string {
  if (Buffer.isBuffer(data)) return data.toString("utf-8");
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf-8");
  return Buffer.from(data).toString("utf-8");
}

export function handleMessage(
  ws: WebSocket,
  data: RawData,
  logger: FastifyBaseLogger,
): ParsedMessage | null {
  const raw = rawDataToString(data);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.warn("Malformed WebSocket message: invalid JSON");
    return null;
  }

  if (!isRecord(parsed)) {
    logger.warn("Malformed WebSocket message: not an object");
    return null;
  }

  if (!("version" in parsed) || parsed.version === undefined) {
    logger.warn("Malformed WebSocket message: missing version field");
    return null;
  }

  if (parsed.version !== PROTOCOL_VERSION) {
    const error = JSON.stringify({
      version: PROTOCOL_VERSION,
      type: "ERROR",
      code: "UNSUPPORTED_VERSION",
      message: "Protocol version not supported",
    });
    ws.send(error);
    return null;
  }

  const type = typeof parsed.type === "string" ? parsed.type : "";
  return { ...parsed, version: PROTOCOL_VERSION, type };
}
