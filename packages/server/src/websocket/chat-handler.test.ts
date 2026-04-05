import { describe, expect, it, vi } from "vite-plus/test";
import { WebSocket } from "ws";
import type { FastifyBaseLogger } from "fastify";
import {
  PROTOCOL_VERSION,
  CHAT_HISTORY_CAPACITY,
  CHAT_RATE_LIMIT_WINDOW_MS,
  REACTION_RATE_LIMIT_WINDOW_MS,
} from "@mahjong-game/shared";
import type { Room, PlayerInfo, PlayerSession } from "../rooms/room";
import { createSilentTestLogger } from "../testing/silent-logger";
import { handleChatReactMessage, sanitizeChatText } from "./chat-handler";
import type { ParsedMessage } from "./message-handler";

function createMockLogger(): FastifyBaseLogger {
  return createSilentTestLogger();
}

function createMockWs(readyState: number = WebSocket.OPEN): WebSocket & { sent: string[] } {
  const sent: string[] = [];
  return {
    readyState,
    send: vi.fn((data: string) => {
      sent.push(data);
    }),
    sent,
  } as unknown as WebSocket & { sent: string[] };
}

function createPlayer(id: string, name: string): PlayerInfo {
  return {
    playerId: id,
    displayName: name,
    wind: "east",
    isHost: true,
    connected: true,
    connectedAt: Date.now(),
  };
}

function createRoomWithSessions(
  players: PlayerInfo[],
  sockets: (WebSocket & { sent: string[] })[],
): Room {
  const room: Room = {
    roomId: "room-1",
    roomCode: "TEST01",
    hostToken: "ht",
    players: new Map(),
    sessions: new Map(),
    tokenMap: new Map(),
    playerTokens: new Map(),
    graceTimers: new Map(),
    lifecycleTimers: new Map(),
    socialOverrideTimer: null,
    tableTalkReportTimer: null,
    gameState: null,
    jokerRulesMode: "standard",
    chatHistory: [],
    chatRateTimestamps: new Map(),
    reactionRateTimestamps: new Map(),
    paused: false,
    pausedAt: null,
    turnTimerConfig: { mode: "timed", durationMs: 20_000 },
    turnTimerHandle: null,
    turnTimerStage: null,
    turnTimerPlayerId: null,
    consecutiveTurnTimeouts: new Map(),
    afkVoteState: null,
    afkVoteCooldownPlayerIds: new Set(),
    deadSeatPlayerIds: new Set(),
    createdAt: Date.now(),
    logger: createMockLogger(),
  };

  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const ws = sockets[i];
    room.players.set(p.playerId, p);
    const session: PlayerSession = { player: p, roomCode: room.roomCode, ws };
    room.sessions.set(p.playerId, session);
  }

  return room;
}

describe("sanitizeChatText", () => {
  it("strips control characters and caps at 500", () => {
    expect(sanitizeChatText("hello\x00world")).toBe("helloworld");
    expect(sanitizeChatText("a".repeat(600))?.length).toBe(500);
  });

  it("returns null for whitespace-only input", () => {
    expect(sanitizeChatText("   \t  ")).toBeNull();
  });

  it("returns null when only control characters remain after strip", () => {
    expect(sanitizeChatText("\x00\x01\x7F")).toBeNull();
  });
});

describe("handleChatReactMessage", () => {
  it("broadcasts CHAT_BROADCAST with required fields to all sessions", () => {
    const wsA = createMockWs();
    const wsB = createMockWs();
    const room = createRoomWithSessions(
      [createPlayer("a", "Alice"), createPlayer("b", "Bob")],
      [wsA, wsB],
    );

    const ts = 1_712_275_200_000;
    handleChatReactMessage(
      room,
      "a",
      { version: PROTOCOL_VERSION, type: "CHAT", text: "Hello table" } as ParsedMessage,
      createMockLogger(),
      ts,
    );

    const expected = {
      version: PROTOCOL_VERSION,
      type: "CHAT_BROADCAST",
      playerId: "a",
      playerName: "Alice",
      text: "Hello table",
      timestamp: ts,
    };

    expect(wsA.sent).toHaveLength(1);
    expect(wsB.sent).toHaveLength(1);
    expect(JSON.parse(wsA.sent[0])).toEqual(expected);
    expect(JSON.parse(wsB.sent[0])).toEqual(expected);
    expect(room.chatHistory).toHaveLength(1);
    expect(room.chatHistory[0]).toEqual(expected);
  });

  it("broadcasts REACTION_BROADCAST with required fields to all sessions", () => {
    const wsA = createMockWs();
    const wsB = createMockWs();
    const room = createRoomWithSessions(
      [createPlayer("a", "Alice"), createPlayer("b", "Bob")],
      [wsA, wsB],
    );

    const ts = 1_723_000_000_000;
    handleChatReactMessage(
      room,
      "a",
      { version: PROTOCOL_VERSION, type: "REACTION", emoji: "👍" } as ParsedMessage,
      createMockLogger(),
      ts,
    );

    const expected = {
      version: PROTOCOL_VERSION,
      type: "REACTION_BROADCAST",
      playerId: "a",
      playerName: "Alice",
      emoji: "👍",
      timestamp: ts,
    };

    expect(wsA.sent).toHaveLength(1);
    expect(wsB.sent).toHaveLength(1);
    expect(JSON.parse(wsA.sent[0])).toEqual(expected);
    expect(JSON.parse(wsB.sent[0])).toEqual(expected);
    expect(room.chatHistory).toHaveLength(0);
  });

  it("drops chat when text is not a string (malformed)", () => {
    const ws = createMockWs();
    const room = createRoomWithSessions([createPlayer("a", "Alice")], [ws]);

    handleChatReactMessage(
      room,
      "a",
      { version: PROTOCOL_VERSION, type: "CHAT", text: 123 } as unknown as ParsedMessage,
      createMockLogger(),
    );

    expect(ws.sent).toHaveLength(0);
    expect(room.chatHistory).toHaveLength(0);
  });

  it("drops chat when text field is missing", () => {
    const ws = createMockWs();
    const room = createRoomWithSessions([createPlayer("a", "Alice")], [ws]);

    handleChatReactMessage(
      room,
      "a",
      { version: PROTOCOL_VERSION, type: "CHAT" } as unknown as ParsedMessage,
      createMockLogger(),
    );

    expect(ws.sent).toHaveLength(0);
    expect(room.chatHistory).toHaveLength(0);
  });

  it("drops reaction silently when emoji is not on allowlist", () => {
    const ws = createMockWs();
    const room = createRoomWithSessions([createPlayer("a", "Alice")], [ws]);

    handleChatReactMessage(
      room,
      "a",
      { version: PROTOCOL_VERSION, type: "REACTION", emoji: "💀" } as ParsedMessage,
      createMockLogger(),
    );

    expect(ws.sent).toHaveLength(0);
  });

  it("drops reaction when emoji field is wrong type or empty after trim", () => {
    const ws = createMockWs();
    const room = createRoomWithSessions([createPlayer("a", "Alice")], [ws]);

    handleChatReactMessage(
      room,
      "a",
      { version: PROTOCOL_VERSION, type: "REACTION", emoji: 1 } as unknown as ParsedMessage,
      createMockLogger(),
    );
    handleChatReactMessage(
      room,
      "a",
      { version: PROTOCOL_VERSION, type: "REACTION", emoji: "   " } as ParsedMessage,
      createMockLogger(),
    );

    expect(ws.sent).toHaveLength(0);
  });

  it("enforces chat rate limit (10 per 10s sliding window)", () => {
    const ws = createMockWs();
    const room = createRoomWithSessions([createPlayer("a", "Alice")], [ws]);
    const base = 2_000_000;

    for (let i = 0; i < 10; i++) {
      handleChatReactMessage(
        room,
        "a",
        { version: PROTOCOL_VERSION, type: "CHAT", text: `m${i}` } as ParsedMessage,
        createMockLogger(),
        base + i,
      );
    }
    expect(ws.sent).toHaveLength(10);

    handleChatReactMessage(
      room,
      "a",
      { version: PROTOCOL_VERSION, type: "CHAT", text: "blocked" } as ParsedMessage,
      createMockLogger(),
      base + 10,
    );
    expect(ws.sent).toHaveLength(10);
  });

  it("enforces reaction rate limit (5 per 5s)", () => {
    const ws = createMockWs();
    const room = createRoomWithSessions([createPlayer("a", "Alice")], [ws]);
    const base = 3_000_000;

    for (let i = 0; i < 5; i++) {
      handleChatReactMessage(
        room,
        "a",
        { version: PROTOCOL_VERSION, type: "REACTION", emoji: "👍" } as ParsedMessage,
        createMockLogger(),
        base + i,
      );
    }
    expect(ws.sent).toHaveLength(5);

    handleChatReactMessage(
      room,
      "a",
      { version: PROTOCOL_VERSION, type: "REACTION", emoji: "👍" } as ParsedMessage,
      createMockLogger(),
      base + 5,
    );
    expect(ws.sent).toHaveLength(5);
  });

  it("allows the next reaction after the sliding window has moved past old timestamps", () => {
    const ws = createMockWs();
    const room = createRoomWithSessions([createPlayer("a", "Alice")], [ws]);
    const base = 6_000_000;

    for (let i = 0; i < 5; i++) {
      handleChatReactMessage(
        room,
        "a",
        { version: PROTOCOL_VERSION, type: "REACTION", emoji: "👍" } as ParsedMessage,
        createMockLogger(),
        base + i,
      );
    }
    expect(ws.sent).toHaveLength(5);

    const afterWindow = base + REACTION_RATE_LIMIT_WINDOW_MS + 1;
    handleChatReactMessage(
      room,
      "a",
      { version: PROTOCOL_VERSION, type: "REACTION", emoji: "👍" } as ParsedMessage,
      createMockLogger(),
      afterWindow,
    );
    expect(ws.sent).toHaveLength(6);
    expect(JSON.parse(ws.sent[5]).timestamp).toBe(afterWindow);
  });

  it("retains only the last 100 chat entries in the ring buffer", () => {
    const ws = createMockWs();
    const room = createRoomWithSessions([createPlayer("a", "Alice")], [ws]);

    let t = 4_000_000;
    for (let i = 0; i < 101; i++) {
      if (i > 0 && i % 10 === 0) {
        t += 11_000;
      }
      handleChatReactMessage(
        room,
        "a",
        { version: PROTOCOL_VERSION, type: "CHAT", text: `msg${i}` } as ParsedMessage,
        createMockLogger(),
        t,
      );
      t += 1;
    }

    expect(room.chatHistory.length).toBe(CHAT_HISTORY_CAPACITY);
    expect(room.chatHistory[0]?.text).toBe("msg1");
    expect(room.chatHistory[CHAT_HISTORY_CAPACITY - 1]?.text).toBe("msg100");
  });

  it("does not store reactions in chat history", () => {
    const ws = createMockWs();
    const room = createRoomWithSessions([createPlayer("a", "Alice")], [ws]);

    handleChatReactMessage(
      room,
      "a",
      { version: PROTOCOL_VERSION, type: "REACTION", emoji: "👍" } as ParsedMessage,
      createMockLogger(),
    );

    expect(ws.sent).toHaveLength(1);
    expect(room.chatHistory).toHaveLength(0);
  });

  it("allows chat again after rate-limit state is removed for playerId (seat released / recycled id)", () => {
    const ws = createMockWs();
    const room = createRoomWithSessions([createPlayer("a", "Alice")], [ws]);
    const base = 5_500_000;

    for (let i = 0; i < 10; i++) {
      handleChatReactMessage(
        room,
        "a",
        { version: PROTOCOL_VERSION, type: "CHAT", text: `m${i}` } as ParsedMessage,
        createMockLogger(),
        base + i,
      );
    }
    expect(ws.sent).toHaveLength(10);

    handleChatReactMessage(
      room,
      "a",
      { version: PROTOCOL_VERSION, type: "CHAT", text: "blocked" } as ParsedMessage,
      createMockLogger(),
      base + 10,
    );
    expect(ws.sent).toHaveLength(10);

    room.chatRateTimestamps.delete("a");
    handleChatReactMessage(
      room,
      "a",
      { version: PROTOCOL_VERSION, type: "CHAT", text: "fresh-seat" } as ParsedMessage,
      createMockLogger(),
      base + 11,
    );
    expect(ws.sent).toHaveLength(11);
    expect(JSON.parse(ws.sent[10]).text).toBe("fresh-seat");
  });

  it("allows the next chat after the sliding window has moved past old timestamps", () => {
    const ws = createMockWs();
    const room = createRoomWithSessions([createPlayer("a", "Alice")], [ws]);
    const base = 5_000_000;

    for (let i = 0; i < 10; i++) {
      handleChatReactMessage(
        room,
        "a",
        { version: PROTOCOL_VERSION, type: "CHAT", text: `m${i}` } as ParsedMessage,
        createMockLogger(),
        base + i,
      );
    }
    expect(ws.sent).toHaveLength(10);

    const afterWindow = base + CHAT_RATE_LIMIT_WINDOW_MS + 1;
    handleChatReactMessage(
      room,
      "a",
      { version: PROTOCOL_VERSION, type: "CHAT", text: "after-window" } as ParsedMessage,
      createMockLogger(),
      afterWindow,
    );
    expect(ws.sent).toHaveLength(11);
    expect(JSON.parse(ws.sent[10]).text).toBe("after-window");
  });

  it("skips sockets that are not OPEN when broadcasting", () => {
    const openA = createMockWs();
    const closed = createMockWs(WebSocket.CLOSED);
    const openB = createMockWs();
    const room = createRoomWithSessions(
      [createPlayer("a", "A"), createPlayer("b", "B"), createPlayer("c", "C")],
      [openA, closed, openB],
    );

    handleChatReactMessage(
      room,
      "a",
      { version: PROTOCOL_VERSION, type: "CHAT", text: "hi" } as ParsedMessage,
      createMockLogger(),
    );

    expect(openA.sent).toHaveLength(1);
    expect(closed.sent).toHaveLength(0);
    expect(openB.sent).toHaveLength(1);
  });
});
