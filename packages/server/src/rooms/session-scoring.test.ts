import { describe, expect, it } from "vite-plus/test";
import { createGame, DEFAULT_ROOM_SETTINGS } from "@mahjong-game/shared";
import type { Room } from "./room";
import { mergeCompletedGameIntoSession, rotateDealerPlayerIdsForRematch } from "./session-scoring";
import { createTestRoom } from "../testing";

function minimalRoom(): Room {
  return createTestRoom({
    roomId: "r",
    roomCode: "T",
    hostToken: "h",
    createdAt: 0,
    settings: { ...DEFAULT_ROOM_SETTINGS },
    turnTimer: { config: { mode: "none", durationMs: 25_000 } },
  });
}

describe("rotateDealerPlayerIdsForRematch", () => {
  it("rotates so previous South becomes East (first in playerIds)", () => {
    const gs = createGame(["pa", "pb", "pc", "pd"], 99);
    const next = rotateDealerPlayerIdsForRematch(gs);
    expect(next).toEqual(["pb", "pc", "pd", "pa"]);
  });
});

describe("mergeCompletedGameIntoSession", () => {
  it("accumulates scores and appends history", () => {
    const room = minimalRoom();
    const gs = createGame(["pa", "pb", "pc", "pd"], 1);
    gs.gamePhase = "scoreboard";
    gs.scores = { pa: 10, pb: -10, pc: -10, pd: 10 };
    gs.gameResult = { winnerId: null, points: 0 };

    mergeCompletedGameIntoSession(room, gs);

    expect(room.sessionHistory.scoresFromPriorGames.pa).toBe(10);
    expect(room.sessionHistory.gameHistory).toHaveLength(1);
    expect(room.sessionHistory.gameHistory[0]?.gameNumber).toBe(1);
  });
});
