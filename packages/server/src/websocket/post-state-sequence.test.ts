import { describe, expect, it, vi } from "vite-plus/test";
import { WebSocket } from "ws";
import type { FastifyBaseLogger } from "fastify";
import { DEFAULT_ROOM_SETTINGS, PROTOCOL_VERSION } from "@mahjong-game/shared";
import type { StateUpdateMessage } from "@mahjong-game/shared";
import type { Room } from "../rooms/room";
import { sendPostStateSequence } from "./post-state-sequence";
import * as chatHistory from "./chat-history";

function mockLogger(): FastifyBaseLogger {
  return {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    child: vi.fn(() => mockLogger()),
  } as unknown as FastifyBaseLogger;
}

function minimalRoom(): Room {
  return {
    roomCode: "TEST",
    chatHistory: [],
  } as unknown as Room;
}

describe("sendPostStateSequence", () => {
  it("sends STATE_UPDATE before CHAT_HISTORY", () => {
    const sendOrder: string[] = [];
    const ws = {
      readyState: WebSocket.OPEN,
      send: vi.fn((payload: string) => {
        const parsed = JSON.parse(payload) as { type: string };
        sendOrder.push(parsed.type);
      }),
    } as unknown as WebSocket;

    const spy = vi.spyOn(chatHistory, "sendChatHistoryAfterStateUpdate").mockImplementation(() => {
      sendOrder.push("CHAT_HISTORY");
    });

    const stateMessage: StateUpdateMessage = {
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state: {
        roomId: "r",
        roomCode: "TEST",
        gamePhase: "lobby",
        players: [],
        myPlayerId: "player-0",
        jokerRulesMode: "standard",
        settings: DEFAULT_ROOM_SETTINGS,
      },
    };

    sendPostStateSequence(ws, stateMessage, minimalRoom(), mockLogger(), "test");

    expect(sendOrder).toEqual(["STATE_UPDATE", "CHAT_HISTORY"]);
    spy.mockRestore();
  });

  it("does not send CHAT_HISTORY when STATE_UPDATE send throws", () => {
    const ws = {
      readyState: WebSocket.OPEN,
      send: vi.fn(() => {
        throw new Error("boom");
      }),
    } as unknown as WebSocket;

    const spy = vi.spyOn(chatHistory, "sendChatHistoryAfterStateUpdate");

    const stateMessage: StateUpdateMessage = {
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state: {
        roomId: "r",
        roomCode: "TEST",
        gamePhase: "lobby",
        players: [],
        myPlayerId: "player-0",
        jokerRulesMode: "standard",
        settings: DEFAULT_ROOM_SETTINGS,
      },
    };

    sendPostStateSequence(ws, stateMessage, minimalRoom(), mockLogger(), "test");

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns early without sends when socket is not OPEN", () => {
    const send = vi.fn();
    const ws = {
      readyState: WebSocket.CLOSED,
      send,
    } as unknown as WebSocket;

    const spy = vi.spyOn(chatHistory, "sendChatHistoryAfterStateUpdate");

    const stateMessage: StateUpdateMessage = {
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state: {
        roomId: "r",
        roomCode: "TEST",
        gamePhase: "lobby",
        players: [],
        myPlayerId: "player-0",
        jokerRulesMode: "standard",
        settings: DEFAULT_ROOM_SETTINGS,
      },
    };

    sendPostStateSequence(ws, stateMessage, minimalRoom(), mockLogger(), "test");

    expect(send).not.toHaveBeenCalled();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("still invokes sendChatHistoryAfterStateUpdate when chat history is empty", () => {
    const ws = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    } as unknown as WebSocket;

    const spy = vi.spyOn(chatHistory, "sendChatHistoryAfterStateUpdate");

    const stateMessage: StateUpdateMessage = {
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state: {
        roomId: "r",
        roomCode: "TEST",
        gamePhase: "lobby",
        players: [],
        myPlayerId: "player-0",
        jokerRulesMode: "standard",
        settings: DEFAULT_ROOM_SETTINGS,
      },
    };

    sendPostStateSequence(ws, stateMessage, minimalRoom(), mockLogger(), "test");

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
