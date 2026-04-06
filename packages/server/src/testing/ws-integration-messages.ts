import { WebSocket, type RawData } from "ws";

export function rawDataToUtf8(data: RawData): string {
  if (Buffer.isBuffer(data)) return data.toString("utf-8");
  if (Array.isArray(data)) return Buffer.concat(data).toString("utf-8");
  return Buffer.from(data).toString("utf-8");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** First JSON message that is not CHAT_HISTORY (server may send CHAT_HISTORY after STATE_UPDATE). */
export function waitForJsonMessageSkipChatHistory(ws: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const handler = (data: RawData) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(rawDataToUtf8(data)) as Record<string, unknown>;
      } catch {
        return;
      }
      if (msg.type === "CHAT_HISTORY") {
        return;
      }
      ws.removeListener("message", handler);
      resolve(msg);
    };
    ws.on("message", handler);
  });
}

export type WaitForStateUpdateResolvedActionOptions = {
  predicate?: (ra: Record<string, unknown>) => boolean;
  timeoutMs?: number;
};

/** Next STATE_UPDATE whose resolvedAction.type matches (skips CHAT_HISTORY). */
export function waitForStateUpdateResolvedAction(
  ws: WebSocket,
  resolvedType: string,
  options?: WaitForStateUpdateResolvedActionOptions,
): Promise<Record<string, unknown>> {
  const timeoutMs = options?.timeoutMs ?? 15_000;
  const predicate = options?.predicate;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeListener("message", onMessage);
      reject(new Error(`timeout waiting for resolvedAction ${resolvedType}`));
    }, timeoutMs);

    function onMessage(data: RawData) {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(rawDataToUtf8(data)) as Record<string, unknown>;
      } catch {
        return;
      }
      if (msg.type === "CHAT_HISTORY") return;
      if (msg.type === "STATE_UPDATE") {
        const ra = msg.resolvedAction;
        if (
          isPlainObject(ra) &&
          ra.type === resolvedType &&
          (predicate === undefined || predicate(ra))
        ) {
          clearTimeout(timer);
          ws.removeListener("message", onMessage);
          resolve(msg);
        }
      }
    }
    ws.on("message", onMessage);
  });
}
