import {
  PROTOCOL_VERSION,
  type LobbyState,
  type PlayerGameView,
  type ServerErrorMessage,
  type StateUpdateMessage,
  type SystemEventMessage,
} from "@mahjong-game/shared";

export type ParsedServerMessage =
  | { kind: "state_update"; message: StateUpdateMessage }
  | { kind: "error"; message: ServerErrorMessage }
  | { kind: "system_event"; message: SystemEventMessage }
  | { kind: "ignored" };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseServerMessage(raw: string): ParsedServerMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return null;
  }

  if (!isRecord(parsed)) {
    return null;
  }

  if (parsed.version !== PROTOCOL_VERSION) {
    return { kind: "ignored" };
  }

  const t = parsed.type;
  if (typeof t !== "string") {
    return null;
  }

  switch (t) {
    case "STATE_UPDATE": {
      if (!("state" in parsed) || !isRecord(parsed.state)) {
        return null;
      }
      const message: StateUpdateMessage = {
        version: PROTOCOL_VERSION,
        type: "STATE_UPDATE",
        state: parsed.state as unknown as StateUpdateMessage["state"],
      };
      if ("resolvedAction" in parsed && parsed.resolvedAction !== undefined) {
        message.resolvedAction = parsed.resolvedAction as unknown as NonNullable<
          StateUpdateMessage["resolvedAction"]
        >;
      }
      if (typeof parsed.token === "string") {
        message.token = parsed.token;
      }
      return { kind: "state_update", message };
    }
    case "ERROR": {
      if (typeof parsed.code !== "string" || typeof parsed.message !== "string") {
        return null;
      }
      const message: ServerErrorMessage = {
        version: PROTOCOL_VERSION,
        type: "ERROR",
        code: parsed.code,
        message: parsed.message,
      };
      return { kind: "error", message };
    }
    case "SYSTEM_EVENT": {
      if (parsed.event !== "SESSION_SUPERSEDED" && parsed.event !== "ROOM_CLOSING") {
        return { kind: "ignored" };
      }
      if (parsed.event === "SESSION_SUPERSEDED") {
        const message: SystemEventMessage = {
          version: PROTOCOL_VERSION,
          type: "SYSTEM_EVENT",
          event: "SESSION_SUPERSEDED",
        };
        return { kind: "system_event", message };
      }
      const reason = parsed.reason;
      if (reason !== "all_disconnected" && reason !== "idle_timeout" && reason !== "abandoned") {
        return { kind: "ignored" };
      }
      const message: SystemEventMessage = {
        version: PROTOCOL_VERSION,
        type: "SYSTEM_EVENT",
        event: "ROOM_CLOSING",
        reason,
      };
      return { kind: "system_event", message };
    }
    default:
      return { kind: "ignored" };
  }
}

export function isLobbyState(state: LobbyState | PlayerGameView): state is LobbyState {
  return state.gamePhase === "lobby";
}
