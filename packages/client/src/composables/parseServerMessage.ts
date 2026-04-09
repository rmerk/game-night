import {
  PROTOCOL_VERSION,
  isAllowedReactionEmoji,
  type ChatBroadcast,
  type ChatHistoryMessage,
  type LobbyState,
  type PlayerGameView,
  type ReactionBroadcast,
  type LiveKitTokenMessage,
  type ResolvedAction,
  type ServerErrorMessage,
  type StateUpdateMessage,
  type SystemEventMessage,
} from "@mahjong-game/shared";

export type ParsedServerMessage =
  | { kind: "state_update"; message: StateUpdateMessage }
  | { kind: "error"; message: ServerErrorMessage }
  | { kind: "system_event"; message: SystemEventMessage }
  | { kind: "chat_broadcast"; message: ChatBroadcast }
  | { kind: "chat_history"; message: ChatHistoryMessage }
  | { kind: "reaction_broadcast"; message: ReactionBroadcast }
  | { kind: "livekit_token"; message: LiveKitTokenMessage }
  | { kind: "ignored" };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Minimal wire-shape check so JSON state can be typed without unsafe assertions. */
function isWireGameState(u: unknown): u is LobbyState | PlayerGameView {
  if (!isRecord(u)) return false;
  if (typeof u.gamePhase !== "string") return false;
  if (typeof u.roomId !== "string" || typeof u.roomCode !== "string") return false;
  if (!Array.isArray(u.players)) return false;
  if (typeof u.myPlayerId !== "string") return false;
  if (u.gamePhase === "lobby") {
    return "settings" in u && isRecord(u.settings);
  }
  return Array.isArray(u.myRack) && "exposedGroups" in u && isRecord(u.exposedGroups);
}

function isWireResolvedAction(u: unknown): u is ResolvedAction {
  return isRecord(u) && typeof u.type === "string";
}

/** Same field contract as CHAT_BROADCAST wire parsing (shared with CHAT_HISTORY entries). */
export function parseChatBroadcastFields(parsed: Record<string, unknown>): ChatBroadcast | null {
  if (
    typeof parsed.playerId !== "string" ||
    typeof parsed.playerName !== "string" ||
    typeof parsed.text !== "string" ||
    parsed.text.length === 0 ||
    typeof parsed.timestamp !== "number" ||
    !Number.isFinite(parsed.timestamp)
  ) {
    return null;
  }
  return {
    version: PROTOCOL_VERSION,
    type: "CHAT_BROADCAST",
    playerId: parsed.playerId,
    playerName: parsed.playerName,
    text: parsed.text,
    timestamp: parsed.timestamp,
  };
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
      if (!("state" in parsed) || !isWireGameState(parsed.state)) {
        return null;
      }
      const message: StateUpdateMessage = {
        version: PROTOCOL_VERSION,
        type: "STATE_UPDATE",
        state: parsed.state,
      };
      if ("resolvedAction" in parsed && parsed.resolvedAction !== undefined) {
        const ra = parsed.resolvedAction;
        if (isWireResolvedAction(ra)) {
          message.resolvedAction = ra;
        }
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
    case "CHAT_BROADCAST": {
      const broadcast = parseChatBroadcastFields(parsed);
      if (!broadcast) {
        return null;
      }
      return { kind: "chat_broadcast", message: broadcast };
    }
    case "CHAT_HISTORY": {
      if (!Array.isArray(parsed.messages)) {
        return null;
      }
      const messages: ChatBroadcast[] = [];
      for (const el of parsed.messages) {
        if (!isRecord(el)) {
          return null;
        }
        if (el.type !== "CHAT_BROADCAST") {
          return null;
        }
        const line = parseChatBroadcastFields(el);
        if (!line) {
          return null;
        }
        messages.push(line);
      }
      const message: ChatHistoryMessage = {
        version: PROTOCOL_VERSION,
        type: "CHAT_HISTORY",
        messages,
      };
      return { kind: "chat_history", message };
    }
    case "REACTION_BROADCAST": {
      if (
        typeof parsed.playerId !== "string" ||
        typeof parsed.playerName !== "string" ||
        typeof parsed.emoji !== "string" ||
        parsed.emoji.length === 0 ||
        typeof parsed.timestamp !== "number" ||
        !Number.isFinite(parsed.timestamp)
      ) {
        return null;
      }
      if (!isAllowedReactionEmoji(parsed.emoji)) {
        return null;
      }
      const message: ReactionBroadcast = {
        version: PROTOCOL_VERSION,
        type: "REACTION_BROADCAST",
        playerId: parsed.playerId,
        playerName: parsed.playerName,
        emoji: parsed.emoji,
        timestamp: parsed.timestamp,
      };
      return { kind: "reaction_broadcast", message };
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
    case "LIVEKIT_TOKEN": {
      if (typeof parsed.token !== "string" || typeof parsed.url !== "string") {
        return null;
      }
      const message: LiveKitTokenMessage = {
        version: PROTOCOL_VERSION,
        type: "LIVEKIT_TOKEN",
        token: parsed.token,
        url: parsed.url,
      };
      return { kind: "livekit_token", message };
    }
    default:
      return { kind: "ignored" };
  }
}

export function isLobbyState(state: LobbyState | PlayerGameView): state is LobbyState {
  return state.gamePhase === "lobby";
}
