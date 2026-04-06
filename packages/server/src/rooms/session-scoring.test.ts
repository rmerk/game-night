import { describe, expect, it } from "vite-plus/test";
import { createGame, DEFAULT_ROOM_SETTINGS } from "@mahjong-game/shared";
import type { Room } from "./room";
import { mergeCompletedGameIntoSession, rotateDealerPlayerIdsForRematch } from "./session-scoring";
import { createSilentTestLogger } from "../testing/silent-logger";

function minimalRoom(): Room {
  return {
    roomId: "r",
    roomCode: "T",
    hostToken: "h",
    players: new Map(),
    sessions: new Map(),
    tokenMap: new Map(),
    playerTokens: new Map(),
    graceTimers: new Map(),
    lifecycleTimers: new Map(),
    socialOverrideTimer: null,
    tableTalkReportTimer: null,
    gameState: null,
    settings: { ...DEFAULT_ROOM_SETTINGS },
    jokerRulesMode: "standard",
    chatHistory: [],
    chatRateTimestamps: new Map(),
    reactionRateTimestamps: new Map(),
    paused: false,
    pausedAt: null,
    turnTimerConfig: { mode: "none", durationMs: 25_000 },
    turnTimerHandle: null,
    turnTimerStage: null,
    turnTimerPlayerId: null,
    consecutiveTurnTimeouts: new Map(),
    afkVoteState: null,
    afkVoteCooldownPlayerIds: new Set(),
    deadSeatPlayerIds: new Set(),
    departedPlayerIds: new Set(),
    departureVoteState: null,
    createdAt: 0,
    logger: createSilentTestLogger(),
    sessionScoresFromPriorGames: {},
    sessionGameHistory: [],
  };
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

    expect(room.sessionScoresFromPriorGames.pa).toBe(10);
    expect(room.sessionGameHistory).toHaveLength(1);
    expect(room.sessionGameHistory[0]?.gameNumber).toBe(1);
  });
});
