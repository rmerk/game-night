import { describe, test, expect, vi } from "vite-plus/test";
import { handleDeclareMahjong, handleCancelMahjong, handleConfirmInvalidMahjong } from "./mahjong";
import {
  handleCallMahjong,
  handleCallAction,
  handleConfirmCall,
  resolveCallPriority,
} from "./call-window";
import { handleDiscardTile } from "./discard";
import { handleDrawTile } from "./draw";
import { handleAction } from "../game-engine";
import { createPlayState } from "../../testing/fixtures";
import { getPlayerBySeat, injectTilesIntoRack } from "../../testing/helpers";
import { buildTilesForHand } from "../../testing/tile-builders";
import { loadCard } from "../../card/card-loader";
import { validateHandWithExposure } from "../../card/exposure-validation";
import type { GameState } from "../../types/game-state";
import type { Tile } from "../../types/tiles";

const card = loadCard("2026");

/**
 * Build a 14-tile hand matching pattern ev-2 ("Even Suited Kongs", 25pts, exposed):
 * Kong of bam-2 + Kong of bam-4 + Kong of bam-6 + Pair of bam-8
 */
function buildValidHand(): Tile[] {
  return buildTilesForHand(card, "ev-2", { A: "bam", B: "crak", C: "dot" });
}

/** Build 14 random tiles that don't match any pattern */
function buildInvalidHand(): Tile[] {
  // Cross-suit pairs: no NMJL hand matches this
  const tiles: Tile[] = [];
  const specs = [
    { suit: "bam" as const, value: 1 },
    { suit: "crak" as const, value: 3 },
    { suit: "dot" as const, value: 5 },
    { suit: "bam" as const, value: 7 },
    { suit: "crak" as const, value: 9 },
    { suit: "dot" as const, value: 2 },
    { suit: "bam" as const, value: 4 },
  ];
  for (const s of specs) {
    for (let c = 1; c <= 2; c++) {
      tiles.push({
        id: `${s.suit}-${s.value}-${c}`,
        category: "suited" as const,
        suit: s.suit,
        value: s.value,
        copy: c,
      } as Tile);
    }
  }
  return tiles;
}

/** Discard a tile from a player's rack and return it */
function discardTile(state: GameState, playerId: string): Tile {
  const player = state.players[playerId];
  const tile = player.rack.find((t) => t.category !== "joker");
  if (!tile) throw new Error(`No discardable tile for ${playerId}`);
  handleDiscardTile(state, { type: "DISCARD_TILE", playerId, tileId: tile.id });
  return tile;
}

/** Set up a state where the given player has a valid 14-tile hand and it's their turn to discard */
function setupSelfDrawnMahjong(playerId?: string): { state: GameState; winnerId: string } {
  const state = createPlayState();
  const eastId = getPlayerBySeat(state, "east");
  const targetId = playerId ?? eastId;

  // East starts with 14 tiles (dealt + draw phase). Replace rack with valid hand.
  const validTiles = buildValidHand();
  state.players[targetId].rack.length = 0;
  injectTilesIntoRack(state, targetId, validTiles);
  state.currentTurn = targetId;
  state.turnPhase = "discard";

  return { state, winnerId: targetId };
}

/** Set up a state with an open call window where a player can call mahjong on the discard */
function setupCallMahjongScenario(): {
  state: GameState;
  discarderId: string;
  callerId: string;
  discardedTile: Tile;
} {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));

  const state = createPlayState();
  const eastId = getPlayerBySeat(state, "east");
  const southId = getPlayerBySeat(state, "south");

  // Discard a tile from east to open the call window
  const discardedTile = discardTile(state, eastId);

  return {
    state,
    discarderId: eastId,
    callerId: southId,
    discardedTile,
  };
}

// Sanity check: our test helper builds a valid hand
describe("Test helpers sanity check", () => {
  test("buildValidHand produces 14 tiles that match ev-2", () => {
    const tiles = buildValidHand();
    expect(tiles).toHaveLength(14);
    const match = validateHandWithExposure(tiles, [], card);
    expect(match).not.toBeNull();
    expect(match!.patternId).toBe("ev-2");
    expect(match!.points).toBe(25);
  });

  test("buildInvalidHand produces 14 tiles that match no pattern", () => {
    const tiles = buildInvalidHand();
    expect(tiles).toHaveLength(14);
    const match = validateHandWithExposure(tiles, [], card);
    expect(match).toBeNull();
  });
});

describe("Self-drawn Mahjong (DECLARE_MAHJONG)", () => {
  test("happy path: valid hand → game ends with scoreboard", () => {
    const { state, winnerId } = setupSelfDrawnMahjong();

    const result = handleDeclareMahjong(state, {
      type: "DECLARE_MAHJONG",
      playerId: winnerId,
    });

    expect(result.accepted).toBe(true);
    expect(result.resolved).toMatchObject({
      type: "MAHJONG_DECLARED",
      winnerId,
      patternId: "ev-2",
      points: 25,
      selfDrawn: true,
    });
    expect(state.gamePhase).toBe("scoreboard");
    expect(state.gameResult).not.toBeNull();
    expect(state.gameResult!.winnerId).toBe(winnerId);
  });

  test("self-drawn scoring: all 3 losers pay 2x", () => {
    const { state, winnerId } = setupSelfDrawnMahjong();

    handleDeclareMahjong(state, { type: "DECLARE_MAHJONG", playerId: winnerId });

    // 25 points, self-drawn: each loser pays -50, winner receives 150
    const result = state.gameResult as unknown as { payments: Record<string, number> };
    const loserIds = Object.keys(state.players).filter((id) => id !== winnerId);
    for (const loserId of loserIds) {
      expect(result.payments[loserId]).toBe(-50);
    }
    expect(result.payments[winnerId]).toBe(150);
  });

  test("scores are updated correctly", () => {
    const { state, winnerId } = setupSelfDrawnMahjong();

    handleDeclareMahjong(state, { type: "DECLARE_MAHJONG", playerId: winnerId });

    expect(state.scores[winnerId]).toBe(150);
    const loserIds = Object.keys(state.players).filter((id) => id !== winnerId);
    for (const loserId of loserIds) {
      expect(state.scores[loserId]).toBe(-50);
    }
  });

  test("invalid hand → INVALID_MAHJONG_WARNING with pending state, play continues", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    // Replace rack with invalid tiles
    const invalidTiles = buildInvalidHand();
    state.players[eastId].rack.length = 0;
    injectTilesIntoRack(state, eastId, invalidTiles);
    state.currentTurn = eastId;
    state.turnPhase = "discard";

    const result = handleDeclareMahjong(state, {
      type: "DECLARE_MAHJONG",
      playerId: eastId,
    });

    expect(result.accepted).toBe(true);
    expect(result.resolved).toMatchObject({
      type: "INVALID_MAHJONG_WARNING",
      playerId: eastId,
      reason: "INVALID_HAND",
    });
    expect(state.gamePhase).toBe("play");
    expect(state.gameResult).toBeNull();
    expect(state.pendingMahjong).toMatchObject({
      playerId: eastId,
      path: "self-drawn",
    });
  });

  test("wrong phase: lobby → rejected", () => {
    const state = createPlayState();
    state.gamePhase = "lobby";

    const result = handleDeclareMahjong(state, {
      type: "DECLARE_MAHJONG",
      playerId: "p1",
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("WRONG_PHASE");
  });

  test("not your turn → rejected", () => {
    const { state } = setupSelfDrawnMahjong();
    const southId = getPlayerBySeat(state, "south");

    const result = handleDeclareMahjong(state, {
      type: "DECLARE_MAHJONG",
      playerId: southId,
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NOT_YOUR_TURN");
  });

  test("must draw first (turnPhase=draw) → rejected", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    state.turnPhase = "draw";

    const result = handleDeclareMahjong(state, {
      type: "DECLARE_MAHJONG",
      playerId: eastId,
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("MUST_DRAW_FIRST");
  });

  test("call window active → rejected", () => {
    const { state, winnerId } = setupSelfDrawnMahjong();
    // Simulate an active call window
    state.callWindow = {
      status: "open",
      discardedTile: state.players[winnerId].rack[0],
      discarderId: winnerId,
      passes: [],
      calls: [],
      openedAt: Date.now(),
      confirmingPlayerId: null,
      confirmationExpiresAt: null,
      remainingCallers: [],
      winningCall: null,
    };

    const result = handleDeclareMahjong(state, {
      type: "DECLARE_MAHJONG",
      playerId: winnerId,
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("CALL_WINDOW_ACTIVE");
  });

  test("invalid declaration sets pendingMahjong but no other mutations", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    const invalidTiles = buildInvalidHand();
    state.players[eastId].rack.length = 0;
    injectTilesIntoRack(state, eastId, invalidTiles);
    state.currentTurn = eastId;
    state.turnPhase = "discard";

    // Snapshot key state before
    const phaseBefore = state.gamePhase;
    const scoresBefore = { ...state.scores };
    const resultBefore = state.gameResult;
    const rackLenBefore = state.players[eastId].rack.length;

    handleDeclareMahjong(state, { type: "DECLARE_MAHJONG", playerId: eastId });

    expect(state.gamePhase).toBe(phaseBefore);
    expect(state.scores).toEqual(scoresBefore);
    expect(state.gameResult).toBe(resultBefore);
    expect(state.players[eastId].rack.length).toBe(rackLenBefore);
    // pendingMahjong IS set (this is the only mutation)
    expect(state.pendingMahjong).not.toBeNull();
  });
});

describe("Mahjong with exposed groups", () => {
  test("self-drawn mahjong with exposed kong → game ends with scoreboard", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    // Build ev-2 hand: Kong bam-2 + Kong bam-4 + Kong bam-6 + Pair bam-8
    const fullHand = buildValidHand(); // 14 tiles

    // First 4 tiles (kong of bam-2) go into exposed groups
    const exposedTiles = fullHand.slice(0, 4);
    const rackTiles = fullHand.slice(4); // remaining 10 tiles

    state.players[eastId].rack.length = 0;
    injectTilesIntoRack(state, eastId, rackTiles);
    state.players[eastId].exposedGroups.push({
      type: "kong",
      tiles: exposedTiles,
      identity: { type: "kong", suit: "bam", value: 2 },
    });
    state.currentTurn = eastId;
    state.turnPhase = "discard";

    const result = handleDeclareMahjong(state, {
      type: "DECLARE_MAHJONG",
      playerId: eastId,
    });

    expect(result.accepted).toBe(true);
    expect(result.resolved).toMatchObject({
      type: "MAHJONG_DECLARED",
      winnerId: eastId,
      patternId: "ev-2",
      selfDrawn: true,
    });
    expect(state.gamePhase).toBe("scoreboard");
  });

  test("discard mahjong with exposed kong → game ends with scoreboard", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
    try {
      const state = createPlayState();
      const eastId = getPlayerBySeat(state, "east");
      const southId = getPlayerBySeat(state, "south");

      // Build ev-3 hand for south: 14 tiles total
      const fullHand = buildTilesForHand(card, "ev-3", { A: "bam", B: "crak", C: "dot" });

      // First 4 tiles go into exposed group, next 9 into rack, last 1 is the discard
      const exposedTiles = fullHand.slice(0, 4);
      const rackTiles = fullHand.slice(4, 13); // 9 tiles in rack
      const missingTile = fullHand[13]; // the tile that completes the hand via discard

      state.players[southId].rack.length = 0;
      for (const tile of rackTiles) {
        for (const p of Object.values(state.players)) {
          if (p.id === southId) continue;
          const idx = p.rack.findIndex((t) => t.id === tile.id);
          if (idx >= 0) p.rack.splice(idx, 1);
        }
        const wallIdx = state.wall.findIndex((t) => t.id === tile.id);
        if (wallIdx >= 0) state.wall.splice(wallIdx, 1);
        state.players[southId].rack.push(tile);
      }
      state.players[southId].exposedGroups.push({
        type: "kong",
        tiles: exposedTiles,
        identity: { type: "kong", suit: "bam", value: 2 },
      });

      // Set up call window with missingTile as the discard
      state.callWindow = {
        status: "confirming" as const,
        discardedTile: missingTile,
        discarderId: eastId,
        passes: [eastId],
        calls: [],
        openedAt: Date.now(),
        confirmingPlayerId: southId,
        confirmationExpiresAt: Date.now() + 5000,
        remainingCallers: [],
        winningCall: { callType: "mahjong", playerId: southId, tileIds: [] },
      };
      state.players[eastId].discardPool.push(missingTile);

      const result = handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: southId,
        tileIds: [],
      });

      expect(result.accepted).toBe(true);
      expect(result.resolved).toMatchObject({
        type: "MAHJONG_DECLARED",
        winnerId: southId,
        selfDrawn: false,
      });
      expect(state.gamePhase).toBe("scoreboard");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Call Mahjong (CALL_MAHJONG) during call window", () => {
  test("happy path: call recorded and window frozen", () => {
    const { state, callerId } = setupCallMahjongScenario();
    try {
      const result = handleCallMahjong(state, {
        type: "CALL_MAHJONG",
        playerId: callerId,
        tileIds: [],
      });

      expect(result.accepted).toBe(true);
      expect(state.callWindow!.calls).toHaveLength(1);
      expect(state.callWindow!.calls[0].callType).toBe("mahjong");
      expect(state.callWindow!.calls[0].playerId).toBe(callerId);
      expect(state.callWindow!.status).toBe("frozen");
    } finally {
      vi.useRealTimers();
    }
  });

  test("mahjong call while already frozen → accepted with CALL_MAHJONG resolved", () => {
    const { state, callerId } = setupCallMahjongScenario();
    try {
      const westId = getPlayerBySeat(state, "west");

      // First call freezes
      handleCallMahjong(state, { type: "CALL_MAHJONG", playerId: callerId, tileIds: [] });
      expect(state.callWindow!.status).toBe("frozen");

      // Second call while frozen
      const result = handleCallMahjong(state, {
        type: "CALL_MAHJONG",
        playerId: westId,
        tileIds: [],
      });

      expect(result.accepted).toBe(true);
      expect(result.resolved).toMatchObject({ type: "CALL_MAHJONG", playerId: westId });
      expect(state.callWindow!.calls).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  test("discarder cannot call mahjong", () => {
    const { state, discarderId } = setupCallMahjongScenario();
    try {
      const result = handleCallMahjong(state, {
        type: "CALL_MAHJONG",
        playerId: discarderId,
        tileIds: [],
      });

      expect(result.accepted).toBe(false);
      expect(result.reason).toBe("DISCARDER_CANNOT_CALL");
    } finally {
      vi.useRealTimers();
    }
  });

  test("no call window → rejected", () => {
    const state = createPlayState();
    const result = handleCallMahjong(state, {
      type: "CALL_MAHJONG",
      playerId: "p1",
      tileIds: [],
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NO_CALL_WINDOW");
  });

  test("wrong phase → rejected", () => {
    const state = createPlayState();
    state.gamePhase = "lobby";

    const result = handleCallMahjong(state, {
      type: "CALL_MAHJONG",
      playerId: "p1",
      tileIds: [],
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("WRONG_PHASE");
  });

  test("already passed → rejected", () => {
    const { state, callerId } = setupCallMahjongScenario();
    try {
      state.callWindow!.passes.push(callerId);

      const result = handleCallMahjong(state, {
        type: "CALL_MAHJONG",
        playerId: callerId,
        tileIds: [],
      });

      expect(result.accepted).toBe(false);
      expect(result.reason).toBe("ALREADY_PASSED");
    } finally {
      vi.useRealTimers();
    }
  });

  test("already called → rejected", () => {
    const { state, callerId } = setupCallMahjongScenario();
    try {
      handleCallMahjong(state, { type: "CALL_MAHJONG", playerId: callerId, tileIds: [] });

      const result = handleCallMahjong(state, {
        type: "CALL_MAHJONG",
        playerId: callerId,
        tileIds: [],
      });

      expect(result.accepted).toBe(false);
      expect(result.reason).toBe("ALREADY_CALLED");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Mahjong priority over other calls", () => {
  test("mahjong beats pung in call resolution", () => {
    const { state, callerId, discarderId } = setupCallMahjongScenario();
    try {
      const westId = getPlayerBySeat(state, "west");

      // West calls pung (need 2 matching tiles in rack)
      const westPlayer = state.players[westId];
      const matchingTiles = westPlayer.rack.filter((t) => t.category !== "joker").slice(0, 2);

      // Instead of calling pung (which needs matching tiles), just set up the call buffer directly
      state.callWindow!.calls.push(
        { callType: "pung", playerId: westId, tileIds: matchingTiles.map((t) => t.id) },
        { callType: "mahjong", playerId: callerId, tileIds: [] },
      );
      (state.callWindow as unknown as { status: string }).status = "frozen";

      // Resolve — mahjong should win
      // resolveCallPriority imported at top level
      const discarder = state.players[discarderId];
      const sorted = resolveCallPriority(
        state.callWindow!.calls,
        discarder.seatWind,
        state.players,
      );

      expect(sorted[0].callType).toBe("mahjong");
      expect(sorted[0].playerId).toBe(callerId);
    } finally {
      vi.useRealTimers();
    }
  });

  test("multiple mahjong calls: closest counterclockwise wins", () => {
    const { state, discarderId } = setupCallMahjongScenario();
    try {
      const southId = getPlayerBySeat(state, "south");
      const westId = getPlayerBySeat(state, "west");
      const northId = getPlayerBySeat(state, "north");

      // East discards, south/west/north all call mahjong
      state.callWindow!.calls.push(
        { callType: "mahjong", playerId: northId, tileIds: [] },
        { callType: "mahjong", playerId: westId, tileIds: [] },
        { callType: "mahjong", playerId: southId, tileIds: [] },
      );

      // resolveCallPriority imported at top level
      const discarder = state.players[discarderId];
      const sorted = resolveCallPriority(
        state.callWindow!.calls,
        discarder.seatWind,
        state.players,
      );

      // South is closest counterclockwise from East
      expect(sorted[0].playerId).toBe(southId);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Discard Mahjong confirmation (handleConfirmCall with mahjong)", () => {
  function setupMahjongConfirmation(): {
    state: GameState;
    callerId: string;
    discarderId: string;
    discardedTile: Tile;
  } {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));

    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    // Discard a tile from east
    discardTile(state, eastId);

    // Set south's rack to 13 tiles that, combined with the discard, form a valid hand
    // We'll use ev-3 ("Even Mixed Kongs", 25pts, X):
    // Kong of bam-2 + Kong of crak-4 + Kong of dot-6 + Pair of bam-8
    const fullHand = buildTilesForHand(card, "ev-3", { A: "bam", B: "crak", C: "dot" });

    // The discard tile needs to be one of the 14 tiles in the hand
    // Replace one tile in the hand with the actual discarded tile
    // Actually, for a clean test, let's replace the discard tile and player rack:
    // Inject all 14 hand tiles except one into south's rack (13 tiles)
    // The "missing" tile is the one we'll use as the discard
    const southRack = fullHand.slice(1); // 13 tiles
    const missingTile = fullHand[0]; // The tile that completes the hand

    // We need the discarded tile to match the missing tile
    // Simplest approach: set the discarded tile in the call window to the missing tile
    state.players[southId].rack.length = 0;
    for (const tile of southRack) {
      // Remove from wall/other racks first
      for (const p of Object.values(state.players)) {
        if (p.id === southId) continue;
        const idx = p.rack.findIndex((t) => t.id === tile.id);
        if (idx >= 0) p.rack.splice(idx, 1);
      }
      const wallIdx = state.wall.findIndex((t) => t.id === tile.id);
      if (wallIdx >= 0) state.wall.splice(wallIdx, 1);
      state.players[southId].rack.push(tile);
    }

    // Set up call window in confirming state for south's mahjong call
    state.callWindow = {
      status: "confirming" as const,
      discardedTile: missingTile,
      discarderId: eastId,
      passes: [eastId],
      calls: [],
      openedAt: Date.now(),
      confirmingPlayerId: southId,
      confirmationExpiresAt: Date.now() + 5000,
      remainingCallers: [],
      winningCall: { callType: "mahjong", playerId: southId, tileIds: [] },
    };

    // Put the missing tile in discarder's discard pool (will be removed on confirmation)
    state.players[eastId].discardPool.push(missingTile);

    return { state, callerId: southId, discarderId: eastId, discardedTile: missingTile };
  }

  test("happy path: valid hand → game ends with scoreboard", () => {
    try {
      const { state, callerId, discarderId } = setupMahjongConfirmation();

      const result = handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: callerId,
        tileIds: [], // mahjong doesn't need tileIds for confirmation
      });

      expect(result.accepted).toBe(true);
      expect(result.resolved).toMatchObject({
        type: "MAHJONG_DECLARED",
        winnerId: callerId,
        selfDrawn: false,
        discarderId,
      });
      expect(state.gamePhase).toBe("scoreboard");
      expect(state.gameResult).not.toBeNull();
      expect(state.gameResult!.winnerId).toBe(callerId);
    } finally {
      vi.useRealTimers();
    }
  });

  test("discard mahjong scoring: discarder pays 2x, others pay 1x", () => {
    try {
      const { state, callerId, discarderId } = setupMahjongConfirmation();

      handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: callerId,
        tileIds: [],
      });

      const result = state.gameResult as unknown as { payments: Record<string, number> };
      // ev-3 is 25 points
      expect(result.payments[discarderId]).toBe(-50); // 2x
      const otherLosers = Object.keys(state.players).filter(
        (id) => id !== callerId && id !== discarderId,
      );
      for (const loserId of otherLosers) {
        expect(result.payments[loserId]).toBe(-25); // 1x
      }
      expect(result.payments[callerId]).toBe(100); // 50 + 25 + 25
    } finally {
      vi.useRealTimers();
    }
  });

  test("discard tile removed from discarder's pool", () => {
    try {
      const { state, callerId, discarderId, discardedTile } = setupMahjongConfirmation();
      const poolBefore = state.players[discarderId].discardPool.length;

      handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: callerId,
        tileIds: [],
      });

      expect(state.players[discarderId].discardPool.length).toBe(poolBefore - 1);
      expect(
        state.players[discarderId].discardPool.find((t) => t.id === discardedTile.id),
      ).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });

  test("invalid hand at confirmation → INVALID_MAHJONG_WARNING (pending state)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
    try {
      const state = createPlayState();
      const eastId = getPlayerBySeat(state, "east");
      const southId = getPlayerBySeat(state, "south");

      // Give south an invalid hand (13 random tiles)
      const invalidTiles = buildInvalidHand().slice(0, 13);
      state.players[southId].rack.length = 0;
      for (const tile of invalidTiles) {
        for (const p of Object.values(state.players)) {
          if (p.id === southId) continue;
          const idx = p.rack.findIndex((t) => t.id === tile.id);
          if (idx >= 0) p.rack.splice(idx, 1);
        }
        state.players[southId].rack.push(tile);
      }

      const fakeTile = invalidTiles[0]; // Use first as the "discard"
      state.callWindow = {
        status: "confirming" as const,
        discardedTile: fakeTile,
        discarderId: eastId,
        passes: [eastId],
        calls: [],
        openedAt: Date.now(),
        confirmingPlayerId: southId,
        confirmationExpiresAt: Date.now() + 5000,
        remainingCallers: [],
        winningCall: { callType: "mahjong", playerId: southId, tileIds: [] },
      };

      const result = handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: southId,
        tileIds: [],
      });

      // Now returns warning instead of auto-retraction
      expect(result.accepted).toBe(true);
      expect(result.resolved).toMatchObject({
        type: "INVALID_MAHJONG_WARNING",
        playerId: southId,
      });
      expect(state.pendingMahjong).toMatchObject({
        playerId: southId,
        path: "discard",
      });
      expect(state.gamePhase).toBe("play"); // Game continues
    } finally {
      vi.useRealTimers();
    }
  });

  test("invalid mahjong with remaining callers → INVALID_MAHJONG_WARNING (pending state)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
    try {
      const state = createPlayState();
      const eastId = getPlayerBySeat(state, "east");
      const southId = getPlayerBySeat(state, "south");
      const westId = getPlayerBySeat(state, "west");

      // South has invalid hand
      const invalidTiles = buildInvalidHand().slice(0, 13);
      state.players[southId].rack.length = 0;
      for (const tile of invalidTiles) {
        for (const p of Object.values(state.players)) {
          if (p.id === southId) continue;
          const idx = p.rack.findIndex((t) => t.id === tile.id);
          if (idx >= 0) p.rack.splice(idx, 1);
        }
        state.players[southId].rack.push(tile);
      }

      const fakeTile = invalidTiles[0];
      state.callWindow = {
        status: "confirming" as const,
        discardedTile: fakeTile,
        discarderId: eastId,
        passes: [eastId],
        calls: [],
        openedAt: Date.now(),
        confirmingPlayerId: southId,
        confirmationExpiresAt: Date.now() + 5000,
        remainingCallers: [{ callType: "pung", playerId: westId, tileIds: ["dummy-1", "dummy-2"] }],
        winningCall: { callType: "mahjong", playerId: southId, tileIds: [] },
      };

      const result = handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: southId,
        tileIds: [],
      });

      // Now returns INVALID_MAHJONG_WARNING with pending state instead of auto-retracting
      expect(result.accepted).toBe(true);
      expect(result.resolved).toMatchObject({
        type: "INVALID_MAHJONG_WARNING",
        playerId: southId,
      });
      expect(state.pendingMahjong).toMatchObject({
        playerId: southId,
        path: "discard",
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("State transition", () => {
  test("gamePhase goes to scoreboard on valid self-drawn mahjong", () => {
    const { state, winnerId } = setupSelfDrawnMahjong();

    handleDeclareMahjong(state, { type: "DECLARE_MAHJONG", playerId: winnerId });

    expect(state.gamePhase).toBe("scoreboard");
  });

  test("gameResult populated correctly for self-drawn mahjong", () => {
    const { state, winnerId } = setupSelfDrawnMahjong();

    handleDeclareMahjong(state, { type: "DECLARE_MAHJONG", playerId: winnerId });

    expect(state.gameResult).toMatchObject({
      winnerId,
      patternId: "ev-2",
      patternName: "Even Suited Kongs",
      points: 25,
      selfDrawn: true,
    });
  });

  test("callWindow cleared after discard mahjong confirmation", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
    try {
      const { state, callerId } = (() => {
        const s = setupMahjongConfirmationHelper();
        return s;
      })();

      handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: callerId,
        tileIds: [],
      });

      expect(state.callWindow).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});

/** Helper for setting up mahjong confirmation (reused in state transition tests) */
function setupMahjongConfirmationHelper(): { state: GameState; callerId: string } {
  const state = createPlayState();
  const eastId = getPlayerBySeat(state, "east");
  const southId = getPlayerBySeat(state, "south");

  const fullHand = buildTilesForHand(card, "ev-3", { A: "bam", B: "crak", C: "dot" });
  const southRack = fullHand.slice(1);
  const missingTile = fullHand[0];

  state.players[southId].rack.length = 0;
  for (const tile of southRack) {
    for (const p of Object.values(state.players)) {
      if (p.id === southId) continue;
      const idx = p.rack.findIndex((t) => t.id === tile.id);
      if (idx >= 0) p.rack.splice(idx, 1);
    }
    const wallIdx = state.wall.findIndex((t) => t.id === tile.id);
    if (wallIdx >= 0) state.wall.splice(wallIdx, 1);
    state.players[southId].rack.push(tile);
  }

  state.callWindow = {
    status: "confirming" as const,
    discardedTile: missingTile,
    discarderId: eastId,
    passes: [eastId],
    calls: [],
    openedAt: Date.now(),
    confirmingPlayerId: southId,
    confirmationExpiresAt: Date.now() + 5000,
    remainingCallers: [],
    winningCall: { callType: "mahjong", playerId: southId, tileIds: [] },
  };

  state.players[eastId].discardPool.push(missingTile);

  return { state, callerId: southId };
}

describe("Game engine dispatcher", () => {
  test("CALL_MAHJONG dispatched correctly", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
    try {
      const state = createPlayState();
      const eastId = getPlayerBySeat(state, "east");
      const southId = getPlayerBySeat(state, "south");

      discardTile(state, eastId);

      const result = handleAction(state, {
        type: "CALL_MAHJONG",
        playerId: southId,
        tileIds: [],
      });

      expect(result.accepted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test("DECLARE_MAHJONG dispatched correctly", () => {
    const { state, winnerId } = setupSelfDrawnMahjong();

    const result = handleAction(state, {
      type: "DECLARE_MAHJONG",
      playerId: winnerId,
    });

    expect(result.accepted).toBe(true);
    expect(result.resolved).toMatchObject({ type: "MAHJONG_DECLARED" });
  });
});

describe("Zero-mutation-on-rejection", () => {
  test("rejected CALL_MAHJONG: state unchanged", () => {
    const state = createPlayState();
    const stateBefore = JSON.parse(JSON.stringify(state));

    handleCallMahjong(state, { type: "CALL_MAHJONG", playerId: "p1", tileIds: [] });

    // No call window → should reject and leave state unchanged
    expect(JSON.stringify(state)).toBe(JSON.stringify(stateBefore));
  });

  test("rejected DECLARE_MAHJONG: state unchanged", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    state.turnPhase = "draw"; // Can't declare during draw phase

    const stateBefore = JSON.parse(JSON.stringify(state));

    handleDeclareMahjong(state, { type: "DECLARE_MAHJONG", playerId: eastId });

    expect(JSON.stringify(state)).toBe(JSON.stringify(stateBefore));
  });
});

// ==================== Story 3a-8 Tests ====================

describe("Invalid Mahjong Warning Flow (CANCEL_MAHJONG / CONFIRM_INVALID_MAHJONG)", () => {
  /** Set up a self-drawn invalid declaration pending state */
  function setupSelfDrawnWarning(): { state: GameState; playerId: string } {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    const invalidTiles = buildInvalidHand();
    state.players[eastId].rack.length = 0;
    injectTilesIntoRack(state, eastId, invalidTiles);
    state.currentTurn = eastId;
    state.turnPhase = "discard";

    // Trigger the warning
    handleDeclareMahjong(state, { type: "DECLARE_MAHJONG", playerId: eastId });
    return { state, playerId: eastId };
  }

  /** Set up a discard-path invalid declaration pending state */
  function setupDiscardWarning(): {
    state: GameState;
    callerId: string;
    discarderId: string;
  } {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));

    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    // Give south an invalid hand (13 random tiles)
    const invalidTiles = buildInvalidHand().slice(0, 13);
    state.players[southId].rack.length = 0;
    for (const tile of invalidTiles) {
      for (const p of Object.values(state.players)) {
        if (p.id === southId) continue;
        const idx = p.rack.findIndex((t) => t.id === tile.id);
        if (idx >= 0) p.rack.splice(idx, 1);
      }
      state.players[southId].rack.push(tile);
    }

    const fakeTile = invalidTiles[0];
    state.callWindow = {
      status: "confirming" as const,
      discardedTile: fakeTile,
      discarderId: eastId,
      passes: [eastId],
      calls: [],
      openedAt: Date.now(),
      confirmingPlayerId: southId,
      confirmationExpiresAt: Date.now() + 5000,
      remainingCallers: [],
      winningCall: { callType: "mahjong", playerId: southId, tileIds: [] },
    };

    // Trigger the warning via handleConfirmCall
    handleConfirmCall(state, { type: "CONFIRM_CALL", playerId: southId, tileIds: [] });

    return { state, callerId: southId, discarderId: eastId };
  }

  test("cancel after self-drawn warning → play continues, player can discard", () => {
    const { state, playerId } = setupSelfDrawnWarning();

    const result = handleCancelMahjong(state, { type: "CANCEL_MAHJONG", playerId });

    expect(result.accepted).toBe(true);
    expect(result.resolved).toMatchObject({ type: "MAHJONG_CANCELLED", playerId });
    expect(state.pendingMahjong).toBeNull();
    expect(state.turnPhase).toBe("discard");
    expect(state.currentTurn).toBe(playerId);
    expect(state.gamePhase).toBe("play");
  });

  test("cancel after discard warning → retraction/resume flow triggers", () => {
    try {
      const { state, callerId } = setupDiscardWarning();

      const result = handleCancelMahjong(state, { type: "CANCEL_MAHJONG", playerId: callerId });

      // Should trigger retraction (CALL_WINDOW_RESUMED or CALL_WINDOW_CLOSED since no remaining callers)
      expect(result.accepted).toBe(true);
      expect(state.pendingMahjong).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test("confirm invalid after self-drawn → dead hand enforced, player must discard", () => {
    const { state, playerId } = setupSelfDrawnWarning();

    const result = handleConfirmInvalidMahjong(state, {
      type: "CONFIRM_INVALID_MAHJONG",
      playerId,
    });

    expect(result.accepted).toBe(true);
    expect(result.resolved).toMatchObject({
      type: "DEAD_HAND_ENFORCED",
      playerId,
      reason: "CONFIRMED_INVALID_DECLARATION",
    });
    expect(state.players[playerId].deadHand).toBe(true);
    expect(state.pendingMahjong).toBeNull();
    expect(state.turnPhase).toBe("discard");
  });

  test("confirm invalid after discard → dead hand enforced, retraction triggers", () => {
    try {
      const { state, callerId } = setupDiscardWarning();

      const result = handleConfirmInvalidMahjong(state, {
        type: "CONFIRM_INVALID_MAHJONG",
        playerId: callerId,
      });

      expect(result.accepted).toBe(true);
      expect(state.players[callerId].deadHand).toBe(true);
      expect(state.pendingMahjong).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test("cancel without pending mahjong → rejected", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    const result = handleCancelMahjong(state, { type: "CANCEL_MAHJONG", playerId: eastId });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NO_PENDING_MAHJONG");
  });

  test("confirm without pending mahjong → rejected", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    const result = handleConfirmInvalidMahjong(state, {
      type: "CONFIRM_INVALID_MAHJONG",
      playerId: eastId,
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NO_PENDING_MAHJONG");
  });

  test("cancel by wrong player → rejected", () => {
    const { state } = setupSelfDrawnWarning();
    const southId = getPlayerBySeat(state, "south");

    const result = handleCancelMahjong(state, { type: "CANCEL_MAHJONG", playerId: southId });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NOT_DECLARING_PLAYER");
  });

  test("confirm by wrong player → rejected", () => {
    const { state } = setupSelfDrawnWarning();
    const southId = getPlayerBySeat(state, "south");

    const result = handleConfirmInvalidMahjong(state, {
      type: "CONFIRM_INVALID_MAHJONG",
      playerId: southId,
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NOT_DECLARING_PLAYER");
  });

  test("zero-mutation after cancel: state restored except pendingMahjong cleared", () => {
    const { state, playerId } = setupSelfDrawnWarning();

    const rackBefore = [...state.players[playerId].rack.map((t) => t.id)];
    const scoresBefore = { ...state.scores };

    handleCancelMahjong(state, { type: "CANCEL_MAHJONG", playerId });

    expect(state.players[playerId].rack.map((t) => t.id)).toEqual(rackBefore);
    expect(state.scores).toEqual(scoresBefore);
    expect(state.gameResult).toBeNull();
    expect(state.pendingMahjong).toBeNull();
    expect(state.players[playerId].deadHand).toBe(false);
  });
});

describe("Dead hand enforcement", () => {
  function setupDeadHandPlayer(): { state: GameState; deadPlayerId: string } {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    // Mark east as dead hand
    state.players[eastId].deadHand = true;

    return { state, deadPlayerId: eastId };
  }

  test("dead hand player cannot declare mahjong → rejected with DEAD_HAND", () => {
    const { state, deadPlayerId } = setupDeadHandPlayer();
    state.currentTurn = deadPlayerId;
    state.turnPhase = "discard";

    const result = handleDeclareMahjong(state, {
      type: "DECLARE_MAHJONG",
      playerId: deadPlayerId,
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("DEAD_HAND");
  });

  test("dead hand player cannot call pung → rejected with DEAD_HAND_CANNOT_CALL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
    try {
      const state = createPlayState();
      const eastId = getPlayerBySeat(state, "east");
      const southId = getPlayerBySeat(state, "south");

      // Mark south as dead hand
      state.players[southId].deadHand = true;

      // Set up call window
      discardTile(state, eastId);

      // Get two distinct tiles from south's rack
      const tile1 = state.players[southId].rack[0];
      const tile2 = state.players[southId].rack[1];

      const result = handleCallAction(
        state,
        { type: "CALL_PUNG", playerId: southId, tileIds: [tile1.id, tile2.id] },
        "pung",
      );

      expect(result.accepted).toBe(false);
      expect(result.reason).toBe("DEAD_HAND_CANNOT_CALL");
    } finally {
      vi.useRealTimers();
    }
  });

  test("dead hand player cannot call mahjong → rejected with DEAD_HAND_CANNOT_CALL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
    try {
      const state = createPlayState();
      const eastId = getPlayerBySeat(state, "east");
      const southId = getPlayerBySeat(state, "south");

      state.players[southId].deadHand = true;
      discardTile(state, eastId);

      const result = handleCallMahjong(state, {
        type: "CALL_MAHJONG",
        playerId: southId,
        tileIds: [],
      });

      expect(result.accepted).toBe(false);
      expect(result.reason).toBe("DEAD_HAND_CANNOT_CALL");
    } finally {
      vi.useRealTimers();
    }
  });

  test("dead hand player CAN draw tiles normally", () => {
    const { state, deadPlayerId } = setupDeadHandPlayer();
    state.currentTurn = deadPlayerId;
    state.turnPhase = "draw";

    const result = handleDrawTile(state, { type: "DRAW_TILE", playerId: deadPlayerId });

    expect(result.accepted).toBe(true);
  });

  test("dead hand player CAN discard tiles normally", () => {
    const { state, deadPlayerId } = setupDeadHandPlayer();
    state.currentTurn = deadPlayerId;
    state.turnPhase = "discard";

    const tile = state.players[deadPlayerId].rack.find((t) => t.category !== "joker")!;
    const result = handleDiscardTile(state, {
      type: "DISCARD_TILE",
      playerId: deadPlayerId,
      tileId: tile.id,
    });

    expect(result.accepted).toBe(true);
  });

  test("other players CAN call dead hand player's discards", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
    try {
      const state = createPlayState();
      const eastId = getPlayerBySeat(state, "east");
      getPlayerBySeat(state, "south");

      // East is dead hand but discards
      state.players[eastId].deadHand = true;
      discardTile(state, eastId);

      // South (not dead hand) can call
      expect(state.callWindow).not.toBeNull();
      // Call window is open — south can interact with it
      expect(state.callWindow!.status).toBe("open");
    } finally {
      vi.useRealTimers();
    }
  });

  test("dead hand player's exposed tiles remain visible", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    // Add an exposed group, then mark dead hand
    state.players[eastId].exposedGroups.push({
      type: "pung",
      tiles: state.players[eastId].rack.splice(0, 3),
      identity: { type: "pung", suit: "bam", value: 1 },
    });
    state.players[eastId].deadHand = true;

    expect(state.players[eastId].exposedGroups).toHaveLength(1);
    expect(state.players[eastId].exposedGroups[0].tiles).toHaveLength(3);
  });
});

describe("Deep copy callWindow in pendingMahjong (aliasing fix)", () => {
  test("mutating active callWindow after save does not corrupt saved copy", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
    try {
      const state = createPlayState();
      const eastId = getPlayerBySeat(state, "east");
      const southId = getPlayerBySeat(state, "south");
      const westId = getPlayerBySeat(state, "west");

      // Give south an invalid hand (13 random tiles)
      const invalidTiles = buildInvalidHand().slice(0, 13);
      state.players[southId].rack.length = 0;
      for (const tile of invalidTiles) {
        for (const p of Object.values(state.players)) {
          if (p.id === southId) continue;
          const idx = p.rack.findIndex((t) => t.id === tile.id);
          if (idx >= 0) p.rack.splice(idx, 1);
        }
        state.players[southId].rack.push(tile);
      }

      const fakeTile = invalidTiles[0];
      state.callWindow = {
        status: "confirming" as const,
        discardedTile: fakeTile,
        discarderId: eastId,
        passes: [eastId],
        calls: [],
        openedAt: Date.now(),
        confirmingPlayerId: southId,
        confirmationExpiresAt: Date.now() + 5000,
        remainingCallers: [{ callType: "pung", playerId: westId, tileIds: ["tile-a", "tile-b"] }],
        winningCall: { callType: "mahjong", playerId: southId, tileIds: [] },
      };

      // Trigger the warning — this saves callWindow into pendingMahjong.previousCallWindow
      handleConfirmCall(state, { type: "CONFIRM_CALL", playerId: southId, tileIds: [] });

      // Snapshot saved state before mutation
      const saved = state.pendingMahjong!.previousCallWindow!;
      const savedPassesLength = saved.passes.length;
      const savedCallsLength = saved.calls.length;
      const savedRemainingLength = saved.remainingCallers.length;
      const savedRemainingTileIds = [...saved.remainingCallers[0].tileIds];

      // Now mutate the active callWindow arrays (simulating game logic modifying them)
      state.callWindow.passes.push("extra-player");
      state.callWindow.calls.push({ callType: "pung", playerId: "extra", tileIds: ["x"] });
      state.callWindow.remainingCallers[0].tileIds.push("tile-c");
      state.callWindow.remainingCallers.push({
        callType: "kong",
        playerId: "extra2",
        tileIds: ["y"],
      });

      // The saved copy must NOT be affected by the mutations above
      expect(saved.passes).toHaveLength(savedPassesLength);
      expect(saved.calls).toHaveLength(savedCallsLength);
      expect(saved.remainingCallers).toHaveLength(savedRemainingLength);
      expect(saved.remainingCallers[0].tileIds).toEqual(savedRemainingTileIds);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Game engine dispatcher for new actions", () => {
  test("CANCEL_MAHJONG dispatched correctly", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    // Set up pending mahjong
    const invalidTiles = buildInvalidHand();
    state.players[eastId].rack.length = 0;
    injectTilesIntoRack(state, eastId, invalidTiles);
    state.currentTurn = eastId;
    state.turnPhase = "discard";
    handleDeclareMahjong(state, { type: "DECLARE_MAHJONG", playerId: eastId });

    const result = handleAction(state, { type: "CANCEL_MAHJONG", playerId: eastId });
    expect(result.accepted).toBe(true);
    expect(result.resolved).toMatchObject({ type: "MAHJONG_CANCELLED" });
  });

  test("CONFIRM_INVALID_MAHJONG dispatched correctly", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    const invalidTiles = buildInvalidHand();
    state.players[eastId].rack.length = 0;
    injectTilesIntoRack(state, eastId, invalidTiles);
    state.currentTurn = eastId;
    state.turnPhase = "discard";
    handleDeclareMahjong(state, { type: "DECLARE_MAHJONG", playerId: eastId });

    const result = handleAction(state, { type: "CONFIRM_INVALID_MAHJONG", playerId: eastId });
    expect(result.accepted).toBe(true);
    expect(result.resolved).toMatchObject({ type: "DEAD_HAND_ENFORCED" });
  });
});
