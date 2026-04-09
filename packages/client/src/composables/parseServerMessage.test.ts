import { expect, test } from "vite-plus/test";
import { DEFAULT_ROOM_SETTINGS, PROTOCOL_VERSION } from "@mahjong-game/shared";
import { parseServerMessage } from "./parseServerMessage";

test("parses STATE_UPDATE JSON into state_update with state and optional token", () => {
  const raw = JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "STATE_UPDATE",
    state: {
      roomId: "rid",
      roomCode: "ABC12D",
      gamePhase: "lobby",
      players: [],
      myPlayerId: "p1",
      jokerRulesMode: "standard",
      settings: DEFAULT_ROOM_SETTINGS,
    },
    token: "tok-123",
  });
  const p = parseServerMessage(raw);
  expect(p?.kind).toBe("state_update");
  if (p?.kind !== "state_update") {
    return;
  }
  expect(p.message.type).toBe("STATE_UPDATE");
  expect(p.message.token).toBe("tok-123");
  expect(p.message.state.gamePhase).toBe("lobby");
});

test("returns ignored for wrong protocol version", () => {
  const raw = JSON.stringify({
    version: 999,
    type: "STATE_UPDATE",
    state: {},
  });
  expect(parseServerMessage(raw)?.kind).toBe("ignored");
});

// CHAT_BROADCAST contract: require string playerId, playerName, non-empty text, finite numeric timestamp; else null.
test("parses valid CHAT_BROADCAST", () => {
  const raw = JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "CHAT_BROADCAST",
    playerId: "p1",
    playerName: "Ada",
    text: "hi",
    timestamp: 1_700_000_000_000,
  });
  const p = parseServerMessage(raw);
  expect(p?.kind).toBe("chat_broadcast");
  if (p?.kind !== "chat_broadcast") return;
  expect(p.message.playerId).toBe("p1");
  expect(p.message.playerName).toBe("Ada");
  expect(p.message.text).toBe("hi");
  expect(p.message.timestamp).toBe(1_700_000_000_000);
});

test("CHAT_BROADCAST returns null when timestamp is not a finite number", () => {
  const raw = JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "CHAT_BROADCAST",
    playerId: "p1",
    playerName: "Ada",
    text: "hi",
    timestamp: "1700000000000",
  });
  expect(parseServerMessage(raw)).toBeNull();
});

test("CHAT_BROADCAST returns null when playerName missing", () => {
  const raw = JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "CHAT_BROADCAST",
    playerId: "p1",
    text: "hi",
    timestamp: 1,
  });
  expect(parseServerMessage(raw)).toBeNull();
});

test("CHAT_BROADCAST returns null when text empty", () => {
  const raw = JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "CHAT_BROADCAST",
    playerId: "p1",
    playerName: "Ada",
    text: "",
    timestamp: 1,
  });
  expect(parseServerMessage(raw)).toBeNull();
});

test("parses valid REACTION_BROADCAST into reaction_broadcast", () => {
  const raw = JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "REACTION_BROADCAST",
    playerId: "p1",
    playerName: "Ada",
    emoji: "👍",
    timestamp: 1,
  });
  const p = parseServerMessage(raw);
  expect(p?.kind).toBe("reaction_broadcast");
  if (p?.kind !== "reaction_broadcast") return;
  expect(p.message.type).toBe("REACTION_BROADCAST");
  expect(p.message.playerId).toBe("p1");
  expect(p.message.playerName).toBe("Ada");
  expect(p.message.emoji).toBe("👍");
  expect(p.message.timestamp).toBe(1);
});

test("REACTION_BROADCAST returns null when emoji is not on allowlist", () => {
  const raw = JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "REACTION_BROADCAST",
    playerId: "p1",
    playerName: "Ada",
    emoji: "💀",
    timestamp: 1,
  });
  expect(parseServerMessage(raw)).toBeNull();
});

test("REACTION_BROADCAST invalid shape returns null", () => {
  const raw = JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "REACTION_BROADCAST",
    playerId: "p1",
    playerName: "Ada",
    emoji: "",
    timestamp: 1,
  });
  expect(parseServerMessage(raw)).toBeNull();
});

test("parses valid CHAT_HISTORY with empty messages", () => {
  const raw = JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "CHAT_HISTORY",
    messages: [],
  });
  const p = parseServerMessage(raw);
  expect(p?.kind).toBe("chat_history");
  if (p?.kind !== "chat_history") return;
  expect(p.message.type).toBe("CHAT_HISTORY");
  expect(p.message.messages).toEqual([]);
});

test("parses valid CHAT_HISTORY with chronological lines", () => {
  const raw = JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "CHAT_HISTORY",
    messages: [
      {
        version: PROTOCOL_VERSION,
        type: "CHAT_BROADCAST",
        playerId: "p0",
        playerName: "A",
        text: "old",
        timestamp: 1,
      },
      {
        version: PROTOCOL_VERSION,
        type: "CHAT_BROADCAST",
        playerId: "p1",
        playerName: "B",
        text: "new",
        timestamp: 2,
      },
    ],
  });
  const p = parseServerMessage(raw);
  expect(p?.kind).toBe("chat_history");
  if (p?.kind !== "chat_history") return;
  expect(p.message.messages).toHaveLength(2);
  expect(p.message.messages[0]?.text).toBe("old");
  expect(p.message.messages[1]?.text).toBe("new");
});

test("CHAT_HISTORY returns null when messages is not an array", () => {
  const raw = JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "CHAT_HISTORY",
    messages: { not: "array" },
  });
  expect(parseServerMessage(raw)).toBeNull();
});

test("CHAT_HISTORY returns null when an element has wrong type field", () => {
  const raw = JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "CHAT_HISTORY",
    messages: [
      {
        version: PROTOCOL_VERSION,
        type: "WRONG",
        playerId: "p0",
        playerName: "A",
        text: "x",
        timestamp: 1,
      },
    ],
  });
  expect(parseServerMessage(raw)).toBeNull();
});

test("CHAT_HISTORY returns null when an element fails CHAT_BROADCAST contract", () => {
  const raw = JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "CHAT_HISTORY",
    messages: [
      {
        version: PROTOCOL_VERSION,
        type: "CHAT_BROADCAST",
        playerId: "p0",
        playerName: "A",
        text: "ok",
        timestamp: 1,
      },
      {
        version: PROTOCOL_VERSION,
        type: "CHAT_BROADCAST",
        playerId: "p1",
        playerName: "B",
        text: "",
        timestamp: 2,
      },
    ],
  });
  expect(parseServerMessage(raw)).toBeNull();
});

test("parses valid LIVEKIT_TOKEN into livekit_token", () => {
  const raw = JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "LIVEKIT_TOKEN",
    token: "jwt-here",
    url: "wss://example.livekit.cloud",
  });
  const p = parseServerMessage(raw);
  expect(p?.kind).toBe("livekit_token");
  if (p?.kind !== "livekit_token") {
    return;
  }
  expect(p.message.type).toBe("LIVEKIT_TOKEN");
  expect(p.message.token).toBe("jwt-here");
  expect(p.message.url).toBe("wss://example.livekit.cloud");
});

test("LIVEKIT_TOKEN returns null when token or url is missing or wrong type", () => {
  expect(
    parseServerMessage(
      JSON.stringify({
        version: PROTOCOL_VERSION,
        type: "LIVEKIT_TOKEN",
        url: "wss://x",
      }),
    ),
  ).toBeNull();
  expect(
    parseServerMessage(
      JSON.stringify({
        version: PROTOCOL_VERSION,
        type: "LIVEKIT_TOKEN",
        token: "t",
      }),
    ),
  ).toBeNull();
  expect(
    parseServerMessage(
      JSON.stringify({
        version: PROTOCOL_VERSION,
        type: "LIVEKIT_TOKEN",
        token: 1,
        url: "wss://x",
      }),
    ),
  ).toBeNull();
});
