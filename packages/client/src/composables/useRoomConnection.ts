import { onBeforeUnmount, ref, shallowRef } from "vue";
import type {
  GameAction,
  JokerRulesMode,
  LobbyState,
  PlayerGameView,
  ResolvedAction,
} from "@mahjong-game/shared";
import { isAllowedReactionEmoji, MAX_CHAT_LENGTH, PROTOCOL_VERSION } from "@mahjong-game/shared";
import { parseServerMessage, isLobbyState } from "./parseServerMessage";
import { getWebSocketUrl } from "./wsUrl";
import { clearSessionToken, readSessionToken, writeSessionToken } from "./sessionTokenStorage";
import { useChatStore } from "../stores/chat";
import { useReactionsStore } from "../stores/reactions";
import { useSlideInPanelStore } from "../stores/slideInPanel";

export type RoomConnectionStatus = "idle" | "connecting" | "open" | "closed";

export function useRoomConnection() {
  const status = ref<RoomConnectionStatus>("idle");
  const lastErrorMessage = ref<string | null>(null);
  const lobbyState = shallowRef<LobbyState | null>(null);
  const playerGameView = shallowRef<PlayerGameView | null>(null);
  const resolvedAction = shallowRef<ResolvedAction | undefined>(undefined);
  const systemNotice = ref<"session_superseded" | "room_closing" | null>(null);

  let ws: WebSocket | null = null;

  function resetSocialUiForSession(): void {
    useChatStore().clear();
    useReactionsStore().resetForRoomLeave();
    useSlideInPanelStore().resetForRoomLeave();
  }

  function applyStateUpdate(
    state: LobbyState | PlayerGameView,
    ra: ResolvedAction | undefined,
    token: string | undefined,
    roomCode: string,
  ): void {
    resolvedAction.value = ra;
    if (token) {
      writeSessionToken(roomCode, token);
    }
    if (isLobbyState(state)) {
      lobbyState.value = state;
      playerGameView.value = null;
    } else {
      lobbyState.value = null;
      playerGameView.value = state;
    }
  }

  function handleMessage(data: string, roomCode: string): void {
    const parsed = parseServerMessage(data);
    if (parsed === null) {
      return;
    }
    if (parsed.kind === "ignored") {
      return;
    }
    if (parsed.kind === "error") {
      lastErrorMessage.value = `${parsed.message.code}: ${parsed.message.message}`;
      return;
    }
    if (parsed.kind === "system_event") {
      if (parsed.message.event === "SESSION_SUPERSEDED") {
        systemNotice.value = "session_superseded";
      } else if (parsed.message.event === "ROOM_CLOSING") {
        systemNotice.value = "room_closing";
      }
      return;
    }
    if (parsed.kind === "state_update") {
      lastErrorMessage.value = null;
      const msg = parsed.message;
      applyStateUpdate(msg.state, msg.resolvedAction, msg.token, roomCode);
      return;
    }
    if (parsed.kind === "chat_history") {
      useChatStore().setMessages([...parsed.message.messages]);
      return;
    }
    if (parsed.kind === "chat_broadcast") {
      useChatStore().appendBroadcast(parsed.message);
      return;
    }
    if (parsed.kind === "reaction_broadcast") {
      useReactionsStore().pushBroadcast(parsed.message);
      return;
    }
  }

  function disconnect(): void {
    if (ws) {
      ws.close();
      ws = null;
    }
    status.value = "closed";
    resetSocialUiForSession();
  }

  function connect(roomCode: string, displayName: string): void {
    disconnect();
    lastErrorMessage.value = null;
    systemNotice.value = null;
    lobbyState.value = null;
    playerGameView.value = null;
    resolvedAction.value = undefined;

    const code = roomCode.trim().toUpperCase();
    status.value = "connecting";

    const url = getWebSocketUrl();
    const socket = new WebSocket(url);
    ws = socket;

    socket.addEventListener("open", () => {
      status.value = "open";
      const token = readSessionToken(code);
      const joinMsg = {
        version: PROTOCOL_VERSION,
        type: "JOIN_ROOM" as const,
        roomCode: code,
        displayName: displayName.trim(),
        ...(token ? { token } : {}),
      };
      socket.send(JSON.stringify(joinMsg));
    });

    socket.addEventListener("message", (ev) => {
      if (typeof ev.data !== "string") {
        return;
      }
      handleMessage(ev.data, code);
    });

    socket.addEventListener("close", () => {
      if (ws === socket) {
        ws = null;
        status.value = "closed";
        resetSocialUiForSession();
      }
    });

    socket.addEventListener("error", () => {
      lastErrorMessage.value = "WebSocket connection error";
    });
  }

  function sendRaw(payload: Record<string, unknown>): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    ws.send(JSON.stringify({ version: PROTOCOL_VERSION, ...payload }));
  }

  function sendGameAction(action: GameAction): void {
    sendRaw({ type: "ACTION", action });
  }

  function sendStartGame(): void {
    sendRaw({ type: "ACTION", action: { type: "START_GAME", playerIds: [] } });
  }

  function sendSetJokerRules(jokerRulesMode: JokerRulesMode): void {
    sendRaw({ type: "SET_JOKER_RULES", jokerRulesMode });
  }

  function requestState(): void {
    sendRaw({ type: "REQUEST_STATE" });
  }

  function sendChat(text: string): void {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return;
    }
    const payload = trimmed.length > MAX_CHAT_LENGTH ? trimmed.slice(0, MAX_CHAT_LENGTH) : trimmed;
    sendRaw({ type: "CHAT", text: payload });
  }

  function sendReaction(emoji: string): void {
    if (!isAllowedReactionEmoji(emoji)) {
      return;
    }
    sendRaw({ type: "REACTION", emoji });
  }

  function sendAfkVote(targetPlayerId: string, vote: "approve" | "deny"): void {
    sendRaw({ type: "AFK_VOTE_CAST", targetPlayerId, vote });
  }

  function clearLastError(): void {
    lastErrorMessage.value = null;
  }

  onBeforeUnmount(() => {
    disconnect();
  });

  return {
    status,
    lastErrorMessage,
    lobbyState,
    playerGameView,
    resolvedAction,
    systemNotice,
    connect,
    disconnect,
    sendGameAction,
    sendStartGame,
    sendSetJokerRules,
    requestState,
    sendChat,
    sendReaction,
    sendAfkVote,
    clearLastError,
    /** Clear persisted token for this room (e.g. user leaves intentionally). */
    clearTokenForRoom: (roomCode: string) => {
      clearSessionToken(roomCode.trim().toUpperCase());
    },
  };
}
