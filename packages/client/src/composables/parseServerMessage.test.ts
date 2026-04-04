import { expect, test } from "vite-plus/test";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
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

test("REACTION_BROADCAST with valid shape returns ignored (explicit for future 6A.3)", () => {
  const raw = JSON.stringify({
    version: PROTOCOL_VERSION,
    type: "REACTION_BROADCAST",
    playerId: "p1",
    playerName: "Ada",
    emoji: "👍",
    timestamp: 1,
  });
  expect(parseServerMessage(raw)?.kind).toBe("ignored");
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
