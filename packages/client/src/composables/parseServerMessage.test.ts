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
