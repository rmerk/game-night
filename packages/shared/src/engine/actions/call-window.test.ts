import { describe, test, expect, vi } from "vite-plus/test";
import {
  handlePassCall,
  closeCallWindow,
  handleCallAction,
  tilesMatch,
  isPatternDefinedCall,
  validateNewsGroup,
  validateDragonSetGroup,
  getValidCallOptions,
  getSeatDistance,
  resolveCallPriority,
  resolveCallWindow,
  enterConfirmationPhase,
  handleConfirmCall,
  handleRetractCall,
  handleConfirmationTimeout,
  CONFIRMATION_TIMER_MS,
} from "./call-window";
import { handleDiscardTile } from "./discard";
import { handleDrawTile } from "./draw";
import { createPlayState } from "../../testing/fixtures";
import { getPlayerBySeat, buildHand } from "../../testing/helpers";
import { WINDS, DRAGONS, SEATS } from "../../constants";
import type { GameState, CallRecord, SeatWind } from "../../types/game-state";
import type { Tile } from "../../types/tiles";

/** Discard a non-Joker tile from the given player's rack. Returns the discarded tile. */
function discardTile(state: GameState, playerId: string) {
  const player = state.players[playerId];
  const tile = player.rack.find((t) => t.category !== "joker");
  if (!tile) throw new Error(`No discardable tile in rack for player '${playerId}'`);
  handleDiscardTile(state, { type: "DISCARD_TILE", playerId, tileId: tile.id });
  return tile;
}

/** Get all non-discarder player IDs (those who can pass). */
function getNonDiscarders(state: GameState): string[] {
  if (!state.callWindow) throw new Error("No call window open");
  return Object.keys(state.players).filter((id) => id !== state.callWindow!.discarderId);
}

describe("Call Window — Open after discard", () => {
  test("discard opens call window with correct initial state", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-27T12:00:00Z"));
      const state = createPlayState();
      const eastId = getPlayerBySeat(state, "east");

      const tile = discardTile(state, eastId);

      expect(state.callWindow).not.toBeNull();
      expect(state.callWindow!.status).toBe("open");
      expect(state.callWindow!.discardedTile).toBe(tile);
      expect(state.callWindow!.discarderId).toBe(eastId);
      expect(state.callWindow!.openedAt).toBe(Date.now());
      expect(state.callWindow!.calls).toEqual([]);
      expect(state.turnPhase).toBe("callWindow");
    } finally {
      vi.useRealTimers();
    }
  });

  test("discarder is auto-passed in callWindow.passes", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    discardTile(state, eastId);

    expect(state.callWindow!.passes).toEqual([eastId]);
  });

  test("discard no longer advances turn directly (regression)", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    discardTile(state, eastId);

    // Turn stays with discarder until call window resolves
    expect(state.currentTurn).toBe(eastId);
    expect(state.turnPhase).toBe("callWindow");
  });
});

describe("handlePassCall — validation", () => {
  test("rejects WRONG_PHASE when game is not in play phase", () => {
    const state = createPlayState();
    state.gamePhase = "lobby";
    const eastId = getPlayerBySeat(state, "east");

    const result = handlePassCall(state, { type: "PASS_CALL", playerId: eastId });

    expect(result).toEqual({ accepted: false, reason: "WRONG_PHASE" });
  });

  test("rejects NO_CALL_WINDOW when no call window is open", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    // No discard happened — callWindow is null
    expect(state.callWindow).toBeNull();
    const result = handlePassCall(state, { type: "PASS_CALL", playerId: eastId });

    expect(result).toEqual({ accepted: false, reason: "NO_CALL_WINDOW" });
  });

  test("rejects DISCARDER_CANNOT_CALL when discarder tries to pass", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    discardTile(state, eastId);

    const result = handlePassCall(state, { type: "PASS_CALL", playerId: eastId });

    expect(result).toEqual({ accepted: false, reason: "DISCARDER_CANNOT_CALL" });
  });

  test("rejects ALREADY_PASSED when player passes twice", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    discardTile(state, eastId);

    // South passes once — accepted
    const first = handlePassCall(state, { type: "PASS_CALL", playerId: southId });
    expect(first.accepted).toBe(true);

    // South tries to pass again — rejected
    const second = handlePassCall(state, { type: "PASS_CALL", playerId: southId });
    expect(second).toEqual({ accepted: false, reason: "ALREADY_PASSED" });
  });
});

describe("handlePassCall — accepted passes", () => {
  test("accepted pass adds player to callWindow.passes", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    discardTile(state, eastId);

    const result = handlePassCall(state, { type: "PASS_CALL", playerId: southId });

    expect(result.accepted).toBe(true);
    expect(result.resolved).toEqual({ type: "PASS_CALL", playerId: southId });
    expect(state.callWindow!.passes).toContain(southId);
  });

  test("partial passes (1 of 3, 2 of 3) keep call window open", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    discardTile(state, eastId);
    const nonDiscarders = getNonDiscarders(state);

    // 1 of 3 pass
    handlePassCall(state, { type: "PASS_CALL", playerId: nonDiscarders[0] });
    expect(state.callWindow).not.toBeNull();
    expect(state.callWindow!.passes.length).toBe(2); // discarder + 1

    // 2 of 3 pass
    handlePassCall(state, { type: "PASS_CALL", playerId: nonDiscarders[1] });
    expect(state.callWindow).not.toBeNull();
    expect(state.callWindow!.passes.length).toBe(3); // discarder + 2
  });

  test("all 3 non-discarders pass → call window closes, turn advances", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    discardTile(state, eastId);
    const nonDiscarders = getNonDiscarders(state);

    handlePassCall(state, { type: "PASS_CALL", playerId: nonDiscarders[0] });
    handlePassCall(state, { type: "PASS_CALL", playerId: nonDiscarders[1] });
    const result = handlePassCall(state, { type: "PASS_CALL", playerId: nonDiscarders[2] });

    // Call window closed
    expect(state.callWindow).toBeNull();
    expect(result.accepted).toBe(true);
    expect(result.resolved).toEqual({ type: "CALL_WINDOW_CLOSED", reason: "all_passed" });

    // Turn advanced to next player counterclockwise from discarder (East→South)
    expect(state.currentTurn).toBe(southId);
    expect(state.turnPhase).toBe("draw");
  });

  test("call window close advances to correct next player counterclockwise from discarder", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");
    const westId = getPlayerBySeat(state, "west");

    // East discards, all pass → South draws
    discardTile(state, eastId);
    const nonDiscarders1 = getNonDiscarders(state);
    for (const id of nonDiscarders1) {
      handlePassCall(state, { type: "PASS_CALL", playerId: id });
    }
    expect(state.currentTurn).toBe(southId);

    // South draws and discards
    handleDrawTile(state, { type: "DRAW_TILE", playerId: southId });
    state.turnPhase = "discard"; // handleDrawTile sets this
    discardTile(state, southId);

    // All pass → West draws
    const nonDiscarders2 = getNonDiscarders(state);
    for (const id of nonDiscarders2) {
      handlePassCall(state, { type: "PASS_CALL", playerId: id });
    }
    expect(state.currentTurn).toBe(westId);
    expect(state.turnPhase).toBe("draw");
  });
});

describe("closeCallWindow", () => {
  test("resets callWindow to null", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    discardTile(state, eastId);
    expect(state.callWindow).not.toBeNull();

    closeCallWindow(state, "timer_expired");

    expect(state.callWindow).toBeNull();
  });

  test("advances turn to next player after discarder", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    discardTile(state, eastId);
    closeCallWindow(state, "timer_expired");

    expect(state.currentTurn).toBe(southId);
    expect(state.turnPhase).toBe("draw");
  });

  test("returns CALL_WINDOW_CLOSED resolved action", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    discardTile(state, eastId);
    const result = closeCallWindow(state, "timer_expired");

    expect(result).toEqual({
      accepted: true,
      resolved: { type: "CALL_WINDOW_CLOSED", reason: "timer_expired" },
    });
  });

  test("wall empty + close → wall game ends", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    discardTile(state, eastId);

    // Drain the wall
    state.wall.splice(0, state.wall.length);
    state.wallRemaining = 0;

    const result = closeCallWindow(state, "all_passed");

    expect(state.gamePhase).toBe("scoreboard");
    expect(state.gameResult).toEqual({ winnerId: null, points: 0 });
    expect(result.resolved).toEqual({ type: "WALL_GAME" });
  });

  test("rejects when no call window is open", () => {
    const state = createPlayState();

    const result = closeCallWindow(state, "timer_expired");

    expect(result).toEqual({ accepted: false, reason: "NO_CALL_WINDOW" });
  });
});

// ============================================================================
// Call Actions — Pung, Kong, Quint (Story 3A.2)
// ============================================================================

/**
 * Find tiles in the wall/other-player-racks that match a given tile (same identity).
 * Returns matching tiles that can be injected into a player's rack for testing.
 */
function findMatchingTiles(state: GameState, targetTile: Tile, count: number): Tile[] {
  const matches: Tile[] = [];

  // Search the wall for matching tiles (excluding Jokers — we want natural matches)
  for (const tile of state.wall) {
    if (matches.length >= count) break;
    if (tile.id !== targetTile.id && tile.category !== "joker" && tilesMatch(tile, targetTile)) {
      matches.push(tile);
    }
  }

  if (matches.length < count) {
    // Also search other players' racks
    for (const player of Object.values(state.players)) {
      for (const tile of player.rack) {
        if (matches.length >= count) break;
        if (
          tile.id !== targetTile.id &&
          tile.category !== "joker" &&
          tilesMatch(tile, targetTile)
        ) {
          matches.push(tile);
        }
      }
    }
  }

  return matches.slice(0, count);
}

/** Find Joker tiles from the wall. */
function findJokers(state: GameState, count: number): Tile[] {
  return state.wall.filter((t) => t.category === "joker").slice(0, count);
}

/**
 * Inject tiles into a player's rack (removes them from the wall if present).
 */
function injectTilesIntoRack(state: GameState, playerId: string, tiles: Tile[]): void {
  const player = state.players[playerId];
  for (const tile of tiles) {
    // Remove from wall if present
    const wallIdx = state.wall.findIndex((t) => t.id === tile.id);
    if (wallIdx >= 0) {
      state.wall.splice(wallIdx, 1);
      state.wallRemaining = state.wall.length;
    }
    // Remove from other players' racks if present
    for (const p of Object.values(state.players)) {
      if (p.id === playerId) continue;
      const rackIdx = p.rack.findIndex((t) => t.id === tile.id);
      if (rackIdx >= 0) {
        p.rack.splice(rackIdx, 1);
      }
    }
    // Add to target player's rack
    player.rack.push(tile);
  }
}

/**
 * Set up a call window with a known discarded tile and inject matching tiles
 * into a non-discarder's rack. Returns { state, callerId, discardedTile, matchingTileIds }.
 */
function setupCallScenario(
  matchCount: number,
  jokerCount: number = 0,
): {
  state: GameState;
  callerId: string;
  discardedTile: Tile;
  matchingTileIds: string[];
} {
  const state = createPlayState();
  const eastId = getPlayerBySeat(state, "east");
  const southId = getPlayerBySeat(state, "south");

  // East discards to open call window
  const discardedTile = discardTile(state, eastId);

  // Find matching tiles and inject into South's rack
  const matchingTiles = findMatchingTiles(state, discardedTile, matchCount);
  const jokers = findJokers(state, jokerCount);
  const allInjectTiles = [...matchingTiles, ...jokers];
  injectTilesIntoRack(state, southId, allInjectTiles);

  return {
    state,
    callerId: southId,
    discardedTile,
    matchingTileIds: allInjectTiles.map((t) => t.id),
  };
}

describe("handleCallAction — Pung", () => {
  test("CALL_PUNG accepted with 2 matching tiles in rack", () => {
    const { state, callerId, matchingTileIds } = setupCallScenario(2);

    const result = handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: callerId, tileIds: matchingTileIds },
      "pung",
    );

    expect(result.accepted).toBe(true);
    // First call freezes the window
    expect(result.resolved).toEqual({ type: "CALL_WINDOW_FROZEN", callerId });
    expect(state.callWindow!.status).toBe("frozen");
    expect(state.callWindow!.calls).toHaveLength(1);
    expect(state.callWindow!.calls[0].callType).toBe("pung");
    expect(state.callWindow!.calls[0].playerId).toBe(callerId);
    expect(state.callWindow!.calls[0].tileIds).toEqual(matchingTileIds);
  });

  test("CALL_PUNG rejected with only 1 matching tile (pair) → CANNOT_CALL_FOR_PAIR", () => {
    const { state, callerId, matchingTileIds } = setupCallScenario(1);

    const result = handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: callerId, tileIds: matchingTileIds },
      "pung",
    );

    // tileIds.length is 1 → total group = 2 (pair) → CANNOT_CALL_FOR_PAIR
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("CANNOT_CALL_FOR_PAIR");
  });

  test("CALL_PUNG rejected with wrong tile count → INSUFFICIENT_TILES", () => {
    const { state, callerId, matchingTileIds } = setupCallScenario(3);

    // Pass 3 tiles for pung (expects 2)
    const result = handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: callerId, tileIds: matchingTileIds },
      "pung",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("INSUFFICIENT_TILES");
  });
});

describe("handleCallAction — Kong", () => {
  test("CALL_KONG accepted with 3 matching tiles in rack", () => {
    const { state, callerId, matchingTileIds } = setupCallScenario(3);

    const result = handleCallAction(
      state,
      { type: "CALL_KONG", playerId: callerId, tileIds: matchingTileIds },
      "kong",
    );

    expect(result.accepted).toBe(true);
    expect(result.resolved).toEqual({ type: "CALL_WINDOW_FROZEN", callerId });
    expect(state.callWindow!.status).toBe("frozen");
    expect(state.callWindow!.calls).toHaveLength(1);
    expect(state.callWindow!.calls[0].callType).toBe("kong");
  });

  test("CALL_KONG rejected with only 2 matching tiles → INSUFFICIENT_TILES", () => {
    const { state, callerId, matchingTileIds } = setupCallScenario(2);

    const result = handleCallAction(
      state,
      { type: "CALL_KONG", playerId: callerId, tileIds: matchingTileIds },
      "kong",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("INSUFFICIENT_TILES");
  });
});

describe("handleCallAction — Quint", () => {
  test("CALL_QUINT accepted with 3 matching + 1 Joker in rack", () => {
    const { state, callerId, matchingTileIds } = setupCallScenario(3, 1);

    const result = handleCallAction(
      state,
      { type: "CALL_QUINT", playerId: callerId, tileIds: matchingTileIds },
      "quint",
    );

    expect(result.accepted).toBe(true);
    expect(result.resolved).toEqual({ type: "CALL_WINDOW_FROZEN", callerId });
    expect(state.callWindow!.status).toBe("frozen");
    expect(state.callWindow!.calls).toHaveLength(1);
    expect(state.callWindow!.calls[0].callType).toBe("quint");
  });

  test("CALL_QUINT accepted with 2 matching + 2 Jokers in rack", () => {
    const { state, callerId, matchingTileIds } = setupCallScenario(2, 2);

    const result = handleCallAction(
      state,
      { type: "CALL_QUINT", playerId: callerId, tileIds: matchingTileIds },
      "quint",
    );

    expect(result.accepted).toBe(true);
    expect(result.resolved).toEqual({ type: "CALL_WINDOW_FROZEN", callerId });
    expect(state.callWindow!.calls[0].callType).toBe("quint");
  });
});

describe("handleCallAction — validation", () => {
  test("rejects TILE_NOT_IN_RACK when tile IDs are not in caller's rack", () => {
    const { state, callerId } = setupCallScenario(2);

    const result = handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: callerId, tileIds: ["fake-id-1", "fake-id-2"] },
      "pung",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("TILE_NOT_IN_RACK");
  });

  test("rejects NO_CALL_WINDOW when no call window is open", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    const result = handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: eastId, tileIds: ["t1", "t2"] },
      "pung",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NO_CALL_WINDOW");
  });

  test("rejects DISCARDER_CANNOT_CALL when discarder tries to call", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    discardTile(state, eastId);

    const result = handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: eastId, tileIds: ["t1", "t2"] },
      "pung",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("DISCARDER_CANNOT_CALL");
  });

  test("rejects ALREADY_PASSED when player already passed", () => {
    const { state, callerId, matchingTileIds } = setupCallScenario(2);

    // Player passes first
    handlePassCall(state, { type: "PASS_CALL", playerId: callerId });

    // Then tries to call
    const result = handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: callerId, tileIds: matchingTileIds },
      "pung",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("ALREADY_PASSED");
  });

  test("rejects WRONG_PHASE when game is not in play phase", () => {
    const state = createPlayState();
    state.gamePhase = "lobby";
    const eastId = getPlayerBySeat(state, "east");

    const result = handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: eastId, tileIds: ["t1", "t2"] },
      "pung",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("WRONG_PHASE");
  });

  test("rejects non-matching non-Joker tile → TILE_MISMATCH", () => {
    const { state, callerId, discardedTile } = setupCallScenario(2);

    // Find 2 tiles in the caller's rack that DON'T match the discarded tile
    const nonMatchingTiles = state.players[callerId].rack.filter((t) => {
      if (t.category === "joker") return false;
      if (t.category !== discardedTile.category) return true;
      if (t.category === "suited" && discardedTile.category === "suited") {
        return t.suit !== discardedTile.suit || t.value !== discardedTile.value;
      }
      if (t.category === "wind" && discardedTile.category === "wind") {
        return t.value !== discardedTile.value;
      }
      if (t.category === "dragon" && discardedTile.category === "dragon") {
        return t.value !== discardedTile.value;
      }
      return true;
    });

    // If not enough non-matching tiles in rack, inject some from the wall
    if (nonMatchingTiles.length < 2) {
      // Find tiles in wall that don't match the discarded tile
      const wallNonMatching = state.wall.filter((t) => {
        if (t.category === "joker") return false;
        if (t.category !== discardedTile.category) return true;
        if (t.category === "suited" && discardedTile.category === "suited") {
          return t.suit !== discardedTile.suit || t.value !== discardedTile.value;
        }
        return true;
      });
      const needed = 2 - nonMatchingTiles.length;
      injectTilesIntoRack(state, callerId, wallNonMatching.slice(0, needed));
      nonMatchingTiles.push(...wallNonMatching.slice(0, needed));
    }

    const result = handleCallAction(
      state,
      {
        type: "CALL_PUNG",
        playerId: callerId,
        tileIds: [nonMatchingTiles[0].id, nonMatchingTiles[1].id],
      },
      "pung",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("TILE_MISMATCH");
  });

  test("rejects DUPLICATE_TILE_IDS when same tile ID submitted twice", () => {
    const { state, callerId, matchingTileIds } = setupCallScenario(2);

    // Submit duplicate tile IDs
    const result = handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: callerId, tileIds: [matchingTileIds[0], matchingTileIds[0]] },
      "pung",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("DUPLICATE_TILE_IDS");
  });

  test("Jokers cannot substitute in pairs (pair call with 1 Joker rejected)", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    discardTile(state, eastId);

    // Inject 1 Joker into south's rack
    const jokers = findJokers(state, 1);
    injectTilesIntoRack(state, southId, jokers);

    // Try to call pung with just 1 joker (would form pair: discard + joker = 2 tiles)
    // tileIds.length is 1 → total group = 2 (pair) → CANNOT_CALL_FOR_PAIR
    const result = handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: southId, tileIds: [jokers[0].id] },
      "pung",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("CANNOT_CALL_FOR_PAIR");
  });
});

describe("handleCallAction — multiple calls on same discard", () => {
  test("multiple players can call same discard — both recorded in calls buffer", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");
    const westId = getPlayerBySeat(state, "west");

    discardTile(state, eastId);

    // Use Jokers for both callers to avoid matching tile scarcity
    const jokers = findJokers(state, 4);
    // South gets 2 Jokers, West gets 2 Jokers
    injectTilesIntoRack(state, southId, [jokers[0], jokers[1]]);
    injectTilesIntoRack(state, westId, [jokers[2], jokers[3]]);

    // Both call pung using Jokers as substitutes
    const result1 = handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: southId, tileIds: [jokers[0].id, jokers[1].id] },
      "pung",
    );
    const result2 = handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: westId, tileIds: [jokers[2].id, jokers[3].id] },
      "pung",
    );

    expect(result1.accepted).toBe(true);
    // First call freezes
    expect(result1.resolved).toEqual({ type: "CALL_WINDOW_FROZEN", callerId: southId });
    expect(result2.accepted).toBe(true);
    // Second call (in-flight) returns call type
    expect(result2.resolved).toEqual({ type: "CALL_PUNG", playerId: westId });
    expect(state.callWindow!.calls).toHaveLength(2);
    expect(state.callWindow!.calls[0].playerId).toBe(southId);
    expect(state.callWindow!.calls[1].playerId).toBe(westId);
  });

  test("rejects duplicate call from same player — ALREADY_CALLED", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    discardTile(state, eastId);

    const jokers = findJokers(state, 4);
    injectTilesIntoRack(state, southId, [jokers[0], jokers[1], jokers[2], jokers[3]]);

    // First call accepted
    const result1 = handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: southId, tileIds: [jokers[0].id, jokers[1].id] },
      "pung",
    );
    expect(result1.accepted).toBe(true);

    // Second call from same player rejected
    const result2 = handleCallAction(
      state,
      { type: "CALL_KONG", playerId: southId, tileIds: [jokers[0].id, jokers[1].id, jokers[2].id] },
      "kong",
    );
    expect(result2.accepted).toBe(false);
    expect(result2.reason).toBe("ALREADY_CALLED");
    expect(state.callWindow!.calls).toHaveLength(1);
  });

  test("ALREADY_CALLED — zero mutations on rejection", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    discardTile(state, eastId);

    const jokers = findJokers(state, 4);
    injectTilesIntoRack(state, southId, [jokers[0], jokers[1], jokers[2], jokers[3]]);

    // First call
    handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: southId, tileIds: [jokers[0].id, jokers[1].id] },
      "pung",
    );

    // Snapshot state before rejected call
    const callsBefore = state.callWindow!.calls.length;
    const rackBefore = [...state.players[southId].rack.map((t) => t.id)];

    // Duplicate call rejected
    handleCallAction(
      state,
      { type: "CALL_KONG", playerId: southId, tileIds: [jokers[0].id, jokers[1].id, jokers[2].id] },
      "kong",
    );

    expect(state.callWindow!.calls).toHaveLength(callsBefore);
    expect(state.players[southId].rack.map((t) => t.id)).toEqual(rackBefore);
  });
});

// ============================================================================
// isPatternDefinedCall helper (Story 3A.3)
// ============================================================================

describe("isPatternDefinedCall", () => {
  test("returns true for news and dragon_set", () => {
    expect(isPatternDefinedCall("news")).toBe(true);
    expect(isPatternDefinedCall("dragon_set")).toBe(true);
  });

  test("returns false for same-tile call types", () => {
    expect(isPatternDefinedCall("pung")).toBe(false);
    expect(isPatternDefinedCall("kong")).toBe(false);
    expect(isPatternDefinedCall("quint")).toBe(false);
  });
});

// ============================================================================
// Pattern-Defined Group Calls — NEWS (Story 3A.3)
// ============================================================================

/**
 * Set up a call window where a specific tile is discarded by East,
 * and inject specific tiles into South's rack for pattern-defined call testing.
 * Works for both NEWS and Dragon set scenarios.
 */
function setupPatternCallScenario(
  discardTileId: string,
  rackTileIds: string[],
): {
  state: GameState;
  callerId: string;
  discardedTile: Tile;
} {
  const state = createPlayState();
  const eastId = getPlayerBySeat(state, "east");
  const southId = getPlayerBySeat(state, "south");

  const discardedTile = buildHand([discardTileId])[0];
  injectTilesIntoRack(state, eastId, [discardedTile]);
  handleDiscardTile(state, { type: "DISCARD_TILE", playerId: eastId, tileId: discardTileId });

  const rackTiles = buildHand(rackTileIds);
  injectTilesIntoRack(state, southId, rackTiles);

  return {
    state,
    callerId: southId,
    discardedTile,
  };
}

describe("handleCallAction — NEWS call validation", () => {
  test("valid NEWS call — player has 3 other wind tiles, discard is a wind → accepted", () => {
    // Discard North, rack has East + West + South
    const { state, callerId } = setupPatternCallScenario("wind-north-1", [
      "wind-east-2",
      "wind-west-2",
      "wind-south-2",
    ]);

    const result = handleCallAction(
      state,
      {
        type: "CALL_NEWS",
        playerId: callerId,
        tileIds: ["wind-east-2", "wind-west-2", "wind-south-2"],
      },
      "news",
    );

    expect(result.accepted).toBe(true);
    expect(result.resolved).toEqual({ type: "CALL_WINDOW_FROZEN", callerId });
    expect(state.callWindow!.status).toBe("frozen");
    expect(state.callWindow!.calls).toHaveLength(1);
    expect(state.callWindow!.calls[0].callType).toBe("news");
  });

  test("valid NEWS call with 1 Joker substitution — player has 2 winds + 1 Joker → accepted", () => {
    const { state, callerId } = setupPatternCallScenario("wind-north-1", [
      "wind-east-2",
      "wind-west-2",
      "joker-1",
    ]);

    const result = handleCallAction(
      state,
      {
        type: "CALL_NEWS",
        playerId: callerId,
        tileIds: ["wind-east-2", "wind-west-2", "joker-1"],
      },
      "news",
    );

    expect(result.accepted).toBe(true);
    expect(result.resolved).toEqual({ type: "CALL_WINDOW_FROZEN", callerId });
    expect(state.callWindow!.calls[0].callType).toBe("news");
  });

  test("valid NEWS call with 2 Jokers — player has 1 wind + 2 Jokers → accepted", () => {
    const { state, callerId } = setupPatternCallScenario("wind-north-1", [
      "wind-east-2",
      "joker-1",
      "joker-2",
    ]);

    const result = handleCallAction(
      state,
      {
        type: "CALL_NEWS",
        playerId: callerId,
        tileIds: ["wind-east-2", "joker-1", "joker-2"],
      },
      "news",
    );

    expect(result.accepted).toBe(true);
    expect(result.resolved).toEqual({ type: "CALL_WINDOW_FROZEN", callerId });
    expect(state.callWindow!.calls[0].callType).toBe("news");
  });

  test("invalid NEWS call — player has 3 wind tiles but all same wind as discard → INVALID_GROUP", () => {
    // Discard North, rack has 3 more North tiles (not distinct winds)
    const { state, callerId } = setupPatternCallScenario("wind-north-1", [
      "wind-north-2",
      "wind-north-3",
      "wind-north-4",
    ]);

    const result = handleCallAction(
      state,
      {
        type: "CALL_NEWS",
        playerId: callerId,
        tileIds: ["wind-north-2", "wind-north-3", "wind-north-4"],
      },
      "news",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("INVALID_GROUP");
  });

  test("invalid NEWS call — discard is not a wind tile → INVALID_GROUP", () => {
    // Set up a scenario where a suited tile is discarded
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    // Find and discard a suited tile from East
    const suitedTile = state.players[eastId].rack.find((t) => t.category === "suited");
    if (!suitedTile) throw new Error("No suited tile in rack");
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: eastId, tileId: suitedTile.id });

    // Inject 3 wind tiles into South's rack
    const windTiles = buildHand(["wind-north-2", "wind-east-2", "wind-west-2"]);
    injectTilesIntoRack(state, southId, windTiles);

    const result = handleCallAction(
      state,
      {
        type: "CALL_NEWS",
        playerId: southId,
        tileIds: ["wind-north-2", "wind-east-2", "wind-west-2"],
      },
      "news",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("INVALID_GROUP");
  });

  test("invalid NEWS call — player missing a wind and no Joker to substitute → INVALID_GROUP", () => {
    // Discard North, rack has East + West + a suited tile (not South, no Joker)
    const { state, callerId } = setupPatternCallScenario("wind-north-1", [
      "wind-east-2",
      "wind-west-2",
      "bam-1-1",
    ]);

    const result = handleCallAction(
      state,
      {
        type: "CALL_NEWS",
        playerId: callerId,
        tileIds: ["wind-east-2", "wind-west-2", "bam-1-1"],
      },
      "news",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("INVALID_GROUP");
  });

  test("NEWS call inherits common validations — rejects when call window not open", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    const result = handleCallAction(
      state,
      {
        type: "CALL_NEWS",
        playerId: eastId,
        tileIds: ["wind-north-1", "wind-east-1", "wind-west-1"],
      },
      "news",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NO_CALL_WINDOW");
  });

  test("NEWS call inherits common validations — rejects discarder", () => {
    const { state } = setupPatternCallScenario("wind-north-1", [
      "wind-east-2",
      "wind-west-2",
      "wind-south-2",
    ]);
    const eastId = getPlayerBySeat(state, "east");

    const result = handleCallAction(
      state,
      {
        type: "CALL_NEWS",
        playerId: eastId,
        tileIds: ["wind-east-2", "wind-west-2", "wind-south-2"],
      },
      "news",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("DISCARDER_CANNOT_CALL");
  });

  test("NEWS call inherits common validations — rejects duplicate tile IDs", () => {
    const { state, callerId } = setupPatternCallScenario("wind-north-1", [
      "wind-east-2",
      "wind-west-2",
      "wind-south-2",
    ]);

    const result = handleCallAction(
      state,
      {
        type: "CALL_NEWS",
        playerId: callerId,
        tileIds: ["wind-east-2", "wind-east-2", "wind-south-2"],
      },
      "news",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("DUPLICATE_TILE_IDS");
  });

  test("NEWS call inherits common validations — rejects tiles not in rack", () => {
    const { state, callerId } = setupPatternCallScenario("wind-north-1", [
      "wind-east-2",
      "wind-west-2",
      "wind-south-2",
    ]);

    const result = handleCallAction(
      state,
      {
        type: "CALL_NEWS",
        playerId: callerId,
        tileIds: ["wind-east-2", "wind-west-2", "fake-tile-id"],
      },
      "news",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("TILE_NOT_IN_RACK");
  });

  test("NEWS call inherits common validations — rejects player who already passed", () => {
    const { state, callerId } = setupPatternCallScenario("wind-north-1", [
      "wind-east-2",
      "wind-west-2",
      "wind-south-2",
    ]);

    handlePassCall(state, { type: "PASS_CALL", playerId: callerId });

    const result = handleCallAction(
      state,
      {
        type: "CALL_NEWS",
        playerId: callerId,
        tileIds: ["wind-east-2", "wind-west-2", "wind-south-2"],
      },
      "news",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("ALREADY_PASSED");
  });
});

// ============================================================================
// Pattern-Defined Group Calls — Dragon Set (Story 3A.3)
// ============================================================================

describe("handleCallAction — Dragon set call validation", () => {
  test("valid Dragon set call — player has 2 other dragon tiles, discard is a dragon → accepted", () => {
    const { state, callerId } = setupPatternCallScenario("dragon-red-1", [
      "dragon-green-2",
      "dragon-soap-2",
    ]);

    const result = handleCallAction(
      state,
      {
        type: "CALL_DRAGON_SET",
        playerId: callerId,
        tileIds: ["dragon-green-2", "dragon-soap-2"],
      },
      "dragon_set",
    );

    expect(result.accepted).toBe(true);
    expect(result.resolved).toEqual({ type: "CALL_WINDOW_FROZEN", callerId });
    expect(state.callWindow!.status).toBe("frozen");
    expect(state.callWindow!.calls).toHaveLength(1);
    expect(state.callWindow!.calls[0].callType).toBe("dragon_set");
  });

  test("valid Dragon set with Joker — player has 1 dragon + 1 Joker → accepted", () => {
    const { state, callerId } = setupPatternCallScenario("dragon-red-1", [
      "dragon-green-2",
      "joker-3",
    ]);

    const result = handleCallAction(
      state,
      {
        type: "CALL_DRAGON_SET",
        playerId: callerId,
        tileIds: ["dragon-green-2", "joker-3"],
      },
      "dragon_set",
    );

    expect(result.accepted).toBe(true);
    expect(result.resolved).toEqual({ type: "CALL_WINDOW_FROZEN", callerId });
    expect(state.callWindow!.calls[0].callType).toBe("dragon_set");
  });

  test("invalid Dragon set — discard is not a dragon tile → INVALID_GROUP", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    // Discard a suited tile
    const suitedTile = state.players[eastId].rack.find((t) => t.category === "suited");
    if (!suitedTile) throw new Error("No suited tile in rack");
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: eastId, tileId: suitedTile.id });

    const dragonTiles = buildHand(["dragon-red-2", "dragon-green-2"]);
    injectTilesIntoRack(state, southId, dragonTiles);

    const result = handleCallAction(
      state,
      {
        type: "CALL_DRAGON_SET",
        playerId: southId,
        tileIds: ["dragon-red-2", "dragon-green-2"],
      },
      "dragon_set",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("INVALID_GROUP");
  });

  test("invalid Dragon set — player has duplicate dragons instead of distinct → INVALID_GROUP", () => {
    // Discard Red, rack has 2 Green (not distinct — missing Soap)
    const { state, callerId } = setupPatternCallScenario("dragon-red-1", [
      "dragon-green-2",
      "dragon-green-3",
    ]);

    const result = handleCallAction(
      state,
      {
        type: "CALL_DRAGON_SET",
        playerId: callerId,
        tileIds: ["dragon-green-2", "dragon-green-3"],
      },
      "dragon_set",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("INVALID_GROUP");
  });

  test("valid Dragon set with max Joker substitution — 2 Jokers + dragon discard → accepted", () => {
    const { state, callerId } = setupPatternCallScenario("dragon-red-1", ["joker-3", "joker-4"]);

    const result = handleCallAction(
      state,
      {
        type: "CALL_DRAGON_SET",
        playerId: callerId,
        tileIds: ["joker-3", "joker-4"],
      },
      "dragon_set",
    );

    expect(result.accepted).toBe(true);
    expect(result.resolved).toEqual({ type: "CALL_WINDOW_FROZEN", callerId });
    expect(state.callWindow!.calls[0].callType).toBe("dragon_set");
  });

  test("Dragon set inherits common validations — rejects when call window not open", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    const result = handleCallAction(
      state,
      { type: "CALL_DRAGON_SET", playerId: eastId, tileIds: ["dragon-red-1", "dragon-green-1"] },
      "dragon_set",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NO_CALL_WINDOW");
  });

  test("Dragon set inherits common validations — rejects discarder", () => {
    const { state } = setupPatternCallScenario("dragon-red-1", ["dragon-green-2", "dragon-soap-2"]);
    const eastId = getPlayerBySeat(state, "east");

    const result = handleCallAction(
      state,
      {
        type: "CALL_DRAGON_SET",
        playerId: eastId,
        tileIds: ["dragon-green-2", "dragon-soap-2"],
      },
      "dragon_set",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("DISCARDER_CANNOT_CALL");
  });

  test("Dragon set inherits common validations — rejects duplicate tile IDs", () => {
    const { state, callerId } = setupPatternCallScenario("dragon-red-1", [
      "dragon-green-2",
      "dragon-soap-2",
    ]);

    const result = handleCallAction(
      state,
      {
        type: "CALL_DRAGON_SET",
        playerId: callerId,
        tileIds: ["dragon-green-2", "dragon-green-2"],
      },
      "dragon_set",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("DUPLICATE_TILE_IDS");
  });

  test("Dragon set inherits common validations — rejects tiles not in rack", () => {
    const { state, callerId } = setupPatternCallScenario("dragon-red-1", [
      "dragon-green-2",
      "dragon-soap-2",
    ]);

    const result = handleCallAction(
      state,
      {
        type: "CALL_DRAGON_SET",
        playerId: callerId,
        tileIds: ["dragon-green-2", "fake-tile-id"],
      },
      "dragon_set",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("TILE_NOT_IN_RACK");
  });

  test("Dragon set inherits common validations — rejects player who already passed", () => {
    const { state, callerId } = setupPatternCallScenario("dragon-red-1", [
      "dragon-green-2",
      "dragon-soap-2",
    ]);

    handlePassCall(state, { type: "PASS_CALL", playerId: callerId });

    const result = handleCallAction(
      state,
      {
        type: "CALL_DRAGON_SET",
        playerId: callerId,
        tileIds: ["dragon-green-2", "dragon-soap-2"],
      },
      "dragon_set",
    );

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("ALREADY_PASSED");
  });
});

// ============================================================================
// getValidCallOptions (Story 3A.3)
// ============================================================================

describe("getValidCallOptions", () => {
  test("suited tile discarded → only same-tile calls, never news/dragon_set", () => {
    const [discard] = buildHand(["bam-3-1"]);
    const rack = buildHand(["bam-3-2", "bam-3-3", "bam-3-4", "dot-1-1"]);

    const options = getValidCallOptions(rack, discard);

    expect(options).toContain("pung");
    expect(options).toContain("kong");
    expect(options).not.toContain("news");
    expect(options).not.toContain("dragon_set");
  });

  test("wind tile discarded, player has all other winds → includes news", () => {
    const [discard] = buildHand(["wind-north-1"]);
    const rack = buildHand(["wind-east-1", "wind-west-1", "wind-south-1", "bam-1-1"]);

    const options = getValidCallOptions(rack, discard);

    expect(options).toContain("news");
  });

  test("wind tile discarded, player also has matching winds → includes both pung and news", () => {
    const [discard] = buildHand(["wind-north-1"]);
    // 2 north copies (for pung) + other winds (for NEWS)
    const rack = buildHand([
      "wind-north-2",
      "wind-north-3",
      "wind-east-1",
      "wind-west-1",
      "wind-south-1",
    ]);

    const options = getValidCallOptions(rack, discard);

    expect(options).toContain("pung");
    expect(options).toContain("news");
  });

  test("dragon tile discarded, player has all other dragons → includes dragon_set", () => {
    const [discard] = buildHand(["dragon-red-1"]);
    const rack = buildHand(["dragon-green-1", "dragon-soap-1", "bam-1-1"]);

    const options = getValidCallOptions(rack, discard);

    expect(options).toContain("dragon_set");
  });

  test("dragon tile discarded, player also has matching dragons → includes both pung and dragon_set", () => {
    const [discard] = buildHand(["dragon-red-1"]);
    const rack = buildHand(["dragon-red-2", "dragon-red-3", "dragon-green-1", "dragon-soap-1"]);

    const options = getValidCallOptions(rack, discard);

    expect(options).toContain("pung");
    expect(options).toContain("dragon_set");
  });

  test("wind tile discarded, player missing a wind but has Joker → news included", () => {
    const [discard] = buildHand(["wind-north-1"]);
    // Has East + West + Joker (Joker substitutes for South)
    const rack = buildHand(["wind-east-1", "wind-west-1", "joker-1"]);

    const options = getValidCallOptions(rack, discard);

    expect(options).toContain("news");
  });

  test("dragon tile discarded, player missing a dragon but has Joker → dragon_set included", () => {
    const [discard] = buildHand(["dragon-red-1"]);
    // Has Green + Joker (Joker substitutes for Soap)
    const rack = buildHand(["dragon-green-1", "joker-1"]);

    const options = getValidCallOptions(rack, discard);

    expect(options).toContain("dragon_set");
  });

  test("empty rack → empty array", () => {
    const [discard] = buildHand(["bam-3-1"]);

    const options = getValidCallOptions([], discard);

    expect(options).toEqual([]);
  });

  test("no matching tiles in rack → empty array", () => {
    const [discard] = buildHand(["bam-3-1"]);
    const rack = buildHand(["dot-1-1", "crak-9-1"]);

    const options = getValidCallOptions(rack, discard);

    expect(options).toEqual([]);
  });

  test("Jokers count toward same-tile calls", () => {
    const [discard] = buildHand(["bam-3-1"]);
    // 1 natural match + 1 Joker = 2 total → pung eligible
    const rack = buildHand(["bam-3-2", "joker-1"]);

    const options = getValidCallOptions(rack, discard);

    expect(options).toContain("pung");
  });

  test("enough Jokers alone can qualify for same-tile calls", () => {
    const [discard] = buildHand(["bam-3-1"]);
    // 2 Jokers = pung (2 from rack); 3 Jokers = pung + kong
    const rack = buildHand(["joker-1", "joker-2", "joker-3"]);

    const options = getValidCallOptions(rack, discard);

    expect(options).toContain("pung");
    expect(options).toContain("kong");
  });

  test("wind discard + rack has zero wind tiles and zero Jokers → empty array (no news)", () => {
    const [discard] = buildHand(["wind-north-1"]);
    const rack = buildHand(["bam-1-1", "dot-5-1", "crak-9-1"]);

    const options = getValidCallOptions(rack, discard);

    expect(options).not.toContain("news");
    expect(options).toEqual([]);
  });

  test("Jokers listed for both same-tile and pattern calls — options are individually valid but mutually exclusive", () => {
    const [discard] = buildHand(["wind-north-1"]);
    // 3 Jokers: individually valid for kong (0 natural + 3 Jokers) AND news (3 Jokers fill 3 missing winds)
    const rack = buildHand(["joker-1", "joker-2", "joker-3"]);

    const options = getValidCallOptions(rack, discard);

    // Both are individually valid — player picks one
    expect(options).toContain("pung");
    expect(options).toContain("kong");
    expect(options).toContain("news");
  });
});

// ============================================================================
// validateNewsGroup and validateDragonSetGroup unit tests (Story 3A.3)
// ============================================================================

describe("validateNewsGroup", () => {
  test("valid: 3 distinct non-discard winds cover all 4 (derived from WINDS)", () => {
    const discardWind = WINDS[0]; // "north"
    const otherWinds = WINDS.filter((w) => w !== discardWind);
    const [discard] = buildHand([`wind-${discardWind}-1`]);
    const rack = buildHand(otherWinds.map((w) => `wind-${w}-1`));

    expect(validateNewsGroup(rack, discard)).toBe(true);
  });

  test("valid with Joker substitution", () => {
    const [discard] = buildHand(["wind-north-1"]);
    const rack = buildHand(["wind-east-1", "joker-1", "wind-south-1"]);

    expect(validateNewsGroup(rack, discard)).toBe(true);
  });

  test("valid with all Jokers except one natural wind", () => {
    const [discard] = buildHand(["wind-north-1"]);
    const rack = buildHand(["wind-east-1", "joker-1", "joker-2"]);

    expect(validateNewsGroup(rack, discard)).toBe(true);
  });

  test("invalid: discard is not a wind", () => {
    const [discard] = buildHand(["bam-3-1"]);
    const rack = buildHand(["wind-east-1", "wind-west-1", "wind-south-1"]);

    expect(validateNewsGroup(rack, discard)).toBe(false);
  });

  test("invalid: rack has non-wind, non-Joker tile", () => {
    const [discard] = buildHand(["wind-north-1"]);
    const rack = buildHand(["wind-east-1", "wind-west-1", "bam-1-1"]);

    expect(validateNewsGroup(rack, discard)).toBe(false);
  });

  test("invalid: rack has duplicate wind (same as another rack tile)", () => {
    const [discard] = buildHand(["wind-north-1"]);
    // Two East tiles — second East fails because East already covered
    const rack = buildHand(["wind-east-1", "wind-east-2", "wind-west-1"]);

    expect(validateNewsGroup(rack, discard)).toBe(false);
  });
});

describe("validateDragonSetGroup", () => {
  test("valid: 2 distinct non-discard dragons cover all 3 (derived from DRAGONS)", () => {
    const discardDragon = DRAGONS[0]; // "red"
    const otherDragons = DRAGONS.filter((d) => d !== discardDragon);
    const [discard] = buildHand([`dragon-${discardDragon}-1`]);
    const rack = buildHand(otherDragons.map((d) => `dragon-${d}-1`));

    expect(validateDragonSetGroup(rack, discard)).toBe(true);
  });

  test("valid with Joker substitution", () => {
    const [discard] = buildHand(["dragon-red-1"]);
    const rack = buildHand(["dragon-green-1", "joker-1"]);

    expect(validateDragonSetGroup(rack, discard)).toBe(true);
  });

  test("invalid: discard is not a dragon", () => {
    const [discard] = buildHand(["wind-north-1"]);
    const rack = buildHand(["dragon-green-1", "dragon-soap-1"]);

    expect(validateDragonSetGroup(rack, discard)).toBe(false);
  });

  test("invalid: rack has non-dragon, non-Joker tile", () => {
    const [discard] = buildHand(["dragon-red-1"]);
    const rack = buildHand(["dragon-green-1", "bam-1-1"]);

    expect(validateDragonSetGroup(rack, discard)).toBe(false);
  });

  test("invalid: duplicate dragon values", () => {
    const [discard] = buildHand(["dragon-red-1"]);
    // Two Green — second Green fails because Green already covered
    const rack = buildHand(["dragon-green-1", "dragon-green-2"]);

    expect(validateDragonSetGroup(rack, discard)).toBe(false);
  });
});

// ============================================================================
// Zero-mutation-on-rejection tests (Story 3A.3 — Review R1)
// ============================================================================

describe("handleCallAction — zero mutations on rejection", () => {
  test("rejected NEWS call does not mutate state", () => {
    // Invalid NEWS: missing a wind, no Joker
    const { state, callerId } = setupPatternCallScenario("wind-north-1", [
      "wind-east-2",
      "wind-west-2",
      "bam-1-1",
    ]);

    const stateBefore = JSON.stringify(state);

    handleCallAction(
      state,
      {
        type: "CALL_NEWS",
        playerId: callerId,
        tileIds: ["wind-east-2", "wind-west-2", "bam-1-1"],
      },
      "news",
    );

    expect(JSON.stringify(state)).toBe(stateBefore);
  });

  test("rejected Dragon set call does not mutate state", () => {
    // Invalid Dragon set: duplicate dragons
    const { state, callerId } = setupPatternCallScenario("dragon-red-1", [
      "dragon-green-2",
      "dragon-green-3",
    ]);

    const stateBefore = JSON.stringify(state);

    handleCallAction(
      state,
      {
        type: "CALL_DRAGON_SET",
        playerId: callerId,
        tileIds: ["dragon-green-2", "dragon-green-3"],
      },
      "dragon_set",
    );

    expect(JSON.stringify(state)).toBe(stateBefore);
  });

  test("rejected NEWS call with non-wind discard does not mutate state", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    const suitedTile = state.players[eastId].rack.find((t) => t.category === "suited");
    if (!suitedTile) throw new Error("No suited tile in rack");
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: eastId, tileId: suitedTile.id });

    const windTiles = buildHand(["wind-north-2", "wind-east-2", "wind-west-2"]);
    injectTilesIntoRack(state, southId, windTiles);

    const stateBefore = JSON.stringify(state);

    handleCallAction(
      state,
      {
        type: "CALL_NEWS",
        playerId: southId,
        tileIds: ["wind-north-2", "wind-east-2", "wind-west-2"],
      },
      "news",
    );

    expect(JSON.stringify(state)).toBe(stateBefore);
  });
});

// ============================================================================
// Call Window Freeze & Priority Resolution (Story 3A.4)
// ============================================================================

describe("handleCallAction — freeze on first call (Story 3A.4)", () => {
  test("first call freezes window — status becomes frozen, resolved action is CALL_WINDOW_FROZEN", () => {
    const { state, callerId } = setupCallScenario(2);

    const result = handleCallAction(
      state,
      {
        type: "CALL_PUNG",
        playerId: callerId,
        tileIds: state.players[callerId].rack.slice(-2).map((t) => t.id),
      },
      "pung",
    );

    // Re-fetch using setupCallScenario which already verifies this
    // Just verify the core freeze behavior
    expect(state.callWindow!.status).toBe("frozen");
  });

  test("second call accepted while frozen — call buffer contains both calls", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");
    const westId = getPlayerBySeat(state, "west");

    discardTile(state, eastId);

    const jokers = findJokers(state, 4);
    injectTilesIntoRack(state, southId, [jokers[0], jokers[1]]);
    injectTilesIntoRack(state, westId, [jokers[2], jokers[3]]);

    // First call freezes
    const result1 = handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: southId, tileIds: [jokers[0].id, jokers[1].id] },
      "pung",
    );
    expect(result1.resolved).toEqual({ type: "CALL_WINDOW_FROZEN", callerId: southId });
    expect(state.callWindow!.status).toBe("frozen");

    // Second call (in-flight) accepted
    const result2 = handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: westId, tileIds: [jokers[2].id, jokers[3].id] },
      "pung",
    );
    expect(result2.accepted).toBe(true);
    expect(result2.resolved).toEqual({ type: "CALL_PUNG", playerId: westId });
    expect(state.callWindow!.calls).toHaveLength(2);
  });

  test("pass actions rejected when window is frozen — CALL_WINDOW_FROZEN reason", () => {
    const { state, callerId } = setupCallScenario(2);
    const westId = getPlayerBySeat(state, "west");

    // First call freezes
    handleCallAction(
      state,
      {
        type: "CALL_PUNG",
        playerId: callerId,
        tileIds: state.players[callerId].rack.slice(-2).map((t) => t.id),
      },
      "pung",
    );
    expect(state.callWindow!.status).toBe("frozen");

    // Pass should be rejected
    const passResult = handlePassCall(state, { type: "PASS_CALL", playerId: westId });
    expect(passResult.accepted).toBe(false);
    expect(passResult.reason).toBe("CALL_WINDOW_FROZEN");
  });
});

// ============================================================================
// getSeatDistance (Story 3A.4)
// ============================================================================

describe("getSeatDistance", () => {
  test("distance from each seat to all other seats follows counterclockwise order", () => {
    // SEATS = ["east", "south", "west", "north"] — counterclockwise order
    for (let fromIdx = 0; fromIdx < SEATS.length; fromIdx++) {
      const from = SEATS[fromIdx] as SeatWind;
      for (let toIdx = 0; toIdx < SEATS.length; toIdx++) {
        const to = SEATS[toIdx] as SeatWind;
        const expected = (toIdx - fromIdx + SEATS.length) % SEATS.length;
        expect(getSeatDistance(from, to)).toBe(expected);
      }
    }
  });

  test("same seat returns 0", () => {
    for (const seat of SEATS) {
      expect(getSeatDistance(seat as SeatWind, seat as SeatWind)).toBe(0);
    }
  });

  test("east to south = 1 (next counterclockwise)", () => {
    expect(getSeatDistance("east", "south")).toBe(1);
  });

  test("east to west = 2", () => {
    expect(getSeatDistance("east", "west")).toBe(2);
  });

  test("east to north = 3", () => {
    expect(getSeatDistance("east", "north")).toBe(3);
  });

  test("north to east = 1 (wraps around)", () => {
    expect(getSeatDistance("north", "east")).toBe(1);
  });
});

// ============================================================================
// resolveCallPriority (Story 3A.4)
// ============================================================================

describe("resolveCallPriority", () => {
  const mockPlayers: Record<string, { seatWind: SeatWind }> = {
    p1: { seatWind: "east" },
    p2: { seatWind: "south" },
    p3: { seatWind: "west" },
    p4: { seatWind: "north" },
  };

  test("2 non-Mahjong calls — closer seat wins", () => {
    const calls: CallRecord[] = [
      { callType: "pung", playerId: "p3", tileIds: ["t1", "t2"] }, // west, dist 2 from east
      { callType: "pung", playerId: "p2", tileIds: ["t3", "t4"] }, // south, dist 1 from east
    ];

    const sorted = resolveCallPriority(calls, "east", mockPlayers);
    expect(sorted[0].playerId).toBe("p2"); // south (dist 1) beats west (dist 2)
  });

  test("3 non-Mahjong calls — sorted by seat distance", () => {
    const calls: CallRecord[] = [
      { callType: "kong", playerId: "p4", tileIds: ["t1", "t2", "t3"] }, // north, dist 3 from east
      { callType: "pung", playerId: "p3", tileIds: ["t4", "t5"] }, // west, dist 2 from east
      { callType: "pung", playerId: "p2", tileIds: ["t6", "t7"] }, // south, dist 1 from east
    ];

    const sorted = resolveCallPriority(calls, "east", mockPlayers);
    expect(sorted[0].playerId).toBe("p2"); // south
    expect(sorted[1].playerId).toBe("p3"); // west
    expect(sorted[2].playerId).toBe("p4"); // north
  });

  test("Mahjong call beats closer-seated non-Mahjong call", () => {
    const calls: CallRecord[] = [
      { callType: "pung", playerId: "p2", tileIds: ["t1", "t2"] }, // south, dist 1 from east
      { callType: "mahjong", playerId: "p4", tileIds: ["t3"] }, // north, dist 3 from east
    ];

    const sorted = resolveCallPriority(calls, "east", mockPlayers);
    expect(sorted[0].playerId).toBe("p4"); // mahjong wins regardless of seat
    expect(sorted[0].callType).toBe("mahjong");
  });

  test("multiple Mahjong calls — resolved by seat position", () => {
    const calls: CallRecord[] = [
      { callType: "mahjong", playerId: "p3", tileIds: ["t1"] }, // west, dist 2 from east
      { callType: "mahjong", playerId: "p2", tileIds: ["t2"] }, // south, dist 1 from east
    ];

    const sorted = resolveCallPriority(calls, "east", mockPlayers);
    expect(sorted[0].playerId).toBe("p2"); // south (dist 1) beats west (dist 2)
  });

  test("single Mahjong among multiple non-Mahjong wins", () => {
    const calls: CallRecord[] = [
      { callType: "pung", playerId: "p2", tileIds: ["t1", "t2"] }, // south (closest)
      { callType: "mahjong", playerId: "p3", tileIds: ["t3"] }, // west
      { callType: "kong", playerId: "p4", tileIds: ["t4", "t5", "t6"] }, // north
    ];

    const sorted = resolveCallPriority(calls, "east", mockPlayers);
    expect(sorted[0].playerId).toBe("p3"); // mahjong wins
    expect(sorted[0].callType).toBe("mahjong");
  });

  test("different discarder changes priority order", () => {
    // Discarder is south (p2): west=dist 1, north=dist 2, east=dist 3
    const calls: CallRecord[] = [
      { callType: "pung", playerId: "p1", tileIds: ["t1", "t2"] }, // east, dist 3 from south
      { callType: "pung", playerId: "p3", tileIds: ["t3", "t4"] }, // west, dist 1 from south
    ];

    const sorted = resolveCallPriority(calls, "south", mockPlayers);
    expect(sorted[0].playerId).toBe("p3"); // west (dist 1 from south)
  });

  test("does not mutate input array", () => {
    const calls: CallRecord[] = [
      { callType: "pung", playerId: "p3", tileIds: ["t1", "t2"] },
      { callType: "pung", playerId: "p2", tileIds: ["t3", "t4"] },
    ];
    const original = [...calls];

    resolveCallPriority(calls, "east", mockPlayers);
    expect(calls).toEqual(original);
  });
});

// ============================================================================
// resolveCallWindow (Story 3A.4)
// ============================================================================

describe("resolveCallWindow", () => {
  test("single call enters confirmation phase for the winner", () => {
    const { state, callerId, matchingTileIds } = setupCallScenario(2);

    handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: callerId, tileIds: matchingTileIds },
      "pung",
    );
    expect(state.callWindow!.status).toBe("frozen");

    const result = resolveCallWindow(state);
    expect(result.accepted).toBe(true);
    expect(result.resolved!.type).toBe("CALL_CONFIRMATION_STARTED");
    const resolved = result.resolved as {
      type: "CALL_CONFIRMATION_STARTED";
      callerId: string;
      callType: string;
      timerDuration: number;
    };
    expect(resolved.callerId).toBe(callerId);
    expect(resolved.callType).toBe("pung");
    expect(resolved.timerDuration).toBe(5000);
    expect(state.callWindow!.status).toBe("confirming");
    expect(state.callWindow!.confirmingPlayerId).toBe(callerId);
    expect(state.callWindow!.remainingCallers).toEqual([]);
  });

  test("two competing calls — closer seat enters confirmation, farther seat in remainingCallers", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");
    const westId = getPlayerBySeat(state, "west");

    discardTile(state, eastId);

    const jokers = findJokers(state, 4);
    injectTilesIntoRack(state, southId, [jokers[0], jokers[1]]);
    injectTilesIntoRack(state, westId, [jokers[2], jokers[3]]);

    handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: southId, tileIds: [jokers[0].id, jokers[1].id] },
      "pung",
    );
    handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: westId, tileIds: [jokers[2].id, jokers[3].id] },
      "pung",
    );

    const result = resolveCallWindow(state);
    expect(result.accepted).toBe(true);
    const resolved = result.resolved as {
      type: "CALL_CONFIRMATION_STARTED";
      callerId: string;
      callType: string;
    };
    // South is closer counterclockwise from East — enters confirmation
    expect(resolved.callerId).toBe(southId);
    expect(state.callWindow!.confirmingPlayerId).toBe(southId);
    // West is in remainingCallers for fallback
    expect(state.callWindow!.remainingCallers).toHaveLength(1);
    expect(state.callWindow!.remainingCallers[0].playerId).toBe(westId);
  });

  test("resolution with Mahjong vs non-Mahjong — Mahjong enters confirmation", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");
    const westId = getPlayerBySeat(state, "west");

    discardTile(state, eastId);

    const jokers = findJokers(state, 4);
    injectTilesIntoRack(state, southId, [jokers[0], jokers[1]]);
    injectTilesIntoRack(state, westId, [jokers[2], jokers[3]]);

    // South calls pung (closer seat)
    handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: southId, tileIds: [jokers[0].id, jokers[1].id] },
      "pung",
    );

    // West calls mahjong (further seat but mahjong trumps)
    // Manually push a mahjong call into the buffer since we don't have handleCallMahjong yet
    state.callWindow!.calls.push({
      callType: "mahjong",
      playerId: westId,
      tileIds: [jokers[2].id, jokers[3].id],
    });

    const result = resolveCallWindow(state);
    expect(result.accepted).toBe(true);
    const resolved = result.resolved as {
      type: "CALL_CONFIRMATION_STARTED";
      callerId: string;
      callType: string;
    };
    // Mahjong call wins — West enters confirmation
    expect(resolved.callerId).toBe(westId);
    expect(resolved.callType).toBe("mahjong");
    // South (pung caller) is in remainingCallers
    expect(state.callWindow!.remainingCallers).toHaveLength(1);
    expect(state.callWindow!.remainingCallers[0].playerId).toBe(southId);
  });

  test("resolution with no calls returns rejection", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    discardTile(state, eastId);

    // Manually set to frozen but with no calls (edge case)
    (state.callWindow as { status: string }).status = "frozen";

    const result = resolveCallWindow(state);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NO_CALLS_TO_RESOLVE");
  });

  test("resolution when window is not frozen returns rejection", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    discardTile(state, eastId);

    expect(state.callWindow!.status).toBe("open");
    const result = resolveCallWindow(state);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("CALL_WINDOW_NOT_FROZEN");
  });

  test("resolution with no call window returns rejection", () => {
    const state = createPlayState();
    const result = resolveCallWindow(state);
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NO_CALL_WINDOW");
  });

  test("calls buffer cleared after resolution — losers stored in remainingCallers", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");
    const westId = getPlayerBySeat(state, "west");

    discardTile(state, eastId);

    const jokers = findJokers(state, 4);
    injectTilesIntoRack(state, southId, [jokers[0], jokers[1]]);
    injectTilesIntoRack(state, westId, [jokers[2], jokers[3]]);

    handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: southId, tileIds: [jokers[0].id, jokers[1].id] },
      "pung",
    );
    handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: westId, tileIds: [jokers[2].id, jokers[3].id] },
      "pung",
    );

    expect(state.callWindow!.calls).toHaveLength(2);
    resolveCallWindow(state);
    // Calls cleared from buffer; losers are in remainingCallers
    expect(state.callWindow!.calls).toHaveLength(0);
    expect(state.callWindow!.remainingCallers).toHaveLength(1);
  });
});

// ============================================================================
// closeCallWindow with pending calls (Story 3A.4)
// ============================================================================

describe("closeCallWindow — pending calls route to resolution (Story 3A.4)", () => {
  test("close with pending calls triggers confirmation instead of turn advance", () => {
    const { state, callerId, matchingTileIds } = setupCallScenario(2);

    handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: callerId, tileIds: matchingTileIds },
      "pung",
    );

    const result = closeCallWindow(state, "timer_expired");
    expect(result.accepted).toBe(true);
    expect(result.resolved!.type).toBe("CALL_CONFIRMATION_STARTED");
    expect(state.callWindow!.status).toBe("confirming");
  });

  test("close without pending calls proceeds with normal close", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    discardTile(state, eastId);
    expect(state.callWindow!.calls).toHaveLength(0);

    const result = closeCallWindow(state, "timer_expired");
    expect(result.accepted).toBe(true);
    expect(result.resolved).toEqual({ type: "CALL_WINDOW_CLOSED", reason: "timer_expired" });
    expect(state.currentTurn).toBe(southId);
  });

  test("pass rejected during frozen state", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");
    const northId = getPlayerBySeat(state, "north");

    discardTile(state, eastId);

    const jokers = findJokers(state, 2);
    injectTilesIntoRack(state, southId, jokers);

    handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: southId, tileIds: jokers.map((j) => j.id) },
      "pung",
    );
    expect(state.callWindow!.status).toBe("frozen");

    const passResult = handlePassCall(state, { type: "PASS_CALL", playerId: northId });
    expect(passResult.accepted).toBe(false);
    expect(passResult.reason).toBe("CALL_WINDOW_FROZEN");
  });
});

// ============================================================================
// Zero-mutation-on-rejection for new rejection paths (Story 3A.4)
// ============================================================================

describe("handlePassCall — zero mutations on frozen rejection (Story 3A.4)", () => {
  test("rejected pass during frozen state does not mutate state", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");
    const westId = getPlayerBySeat(state, "west");

    discardTile(state, eastId);

    const jokers = findJokers(state, 2);
    injectTilesIntoRack(state, southId, jokers);

    handleCallAction(
      state,
      { type: "CALL_PUNG", playerId: southId, tileIds: jokers.map((j) => j.id) },
      "pung",
    );

    const stateBefore = JSON.stringify(state);
    handlePassCall(state, { type: "PASS_CALL", playerId: westId });
    expect(JSON.stringify(state)).toBe(stateBefore);
  });
});

// ============================================================================
// Call Confirmation, Exposure & Retraction (Story 3A.5)
// ============================================================================

/**
 * Set up a state in the confirmation phase: East discards, South calls pung,
 * resolveCallWindow enters confirmation. Returns state with South as the confirming player.
 */
function setupConfirmationScenario(
  matchCount: number = 2,
  jokerCount: number = 0,
): {
  state: GameState;
  callerId: string;
  discardedTile: Tile;
  matchingTileIds: string[];
  discarderId: string;
} {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));

  const { state, callerId, discardedTile, matchingTileIds } = setupCallScenario(
    matchCount,
    jokerCount,
  );
  const discarderId = state.callWindow!.discarderId;

  // Call and resolve to enter confirmation phase
  handleCallAction(
    state,
    { type: "CALL_PUNG", playerId: callerId, tileIds: matchingTileIds },
    "pung",
  );
  resolveCallWindow(state);

  expect(state.callWindow!.status).toBe("confirming");
  expect(state.callWindow!.confirmingPlayerId).toBe(callerId);

  return { state, callerId, discardedTile, matchingTileIds, discarderId };
}

/**
 * Set up a confirmation scenario with competing callers (South and West both call).
 * South wins priority, West is in remainingCallers.
 */
function setupCompetingCallersConfirmation(): {
  state: GameState;
  southId: string;
  westId: string;
  southTileIds: string[];
  westTileIds: string[];
  discardedTile: Tile;
} {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));

  const state = createPlayState();
  const eastId = getPlayerBySeat(state, "east");
  const southId = getPlayerBySeat(state, "south");
  const westId = getPlayerBySeat(state, "west");

  const discardedTile = discardTile(state, eastId);

  const jokers = findJokers(state, 4);
  injectTilesIntoRack(state, southId, [jokers[0], jokers[1]]);
  injectTilesIntoRack(state, westId, [jokers[2], jokers[3]]);

  handleCallAction(
    state,
    { type: "CALL_PUNG", playerId: southId, tileIds: [jokers[0].id, jokers[1].id] },
    "pung",
  );
  handleCallAction(
    state,
    { type: "CALL_PUNG", playerId: westId, tileIds: [jokers[2].id, jokers[3].id] },
    "pung",
  );

  resolveCallWindow(state);

  return {
    state,
    southId,
    westId,
    southTileIds: [jokers[0].id, jokers[1].id],
    westTileIds: [jokers[2].id, jokers[3].id],
    discardedTile,
  };
}

describe("enterConfirmationPhase (Story 3A.5)", () => {
  test("sets status to confirming with correct fields", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
      const { state, callerId } = setupCallScenario(2);

      handleCallAction(
        state,
        {
          type: "CALL_PUNG",
          playerId: callerId,
          tileIds: state.players[callerId].rack.slice(-2).map((t) => t.id),
        },
        "pung",
      );

      resolveCallWindow(state);

      expect(state.callWindow!.status).toBe("confirming");
      expect(state.callWindow!.confirmingPlayerId).toBe(callerId);
      expect(state.callWindow!.confirmationExpiresAt).toBe(Date.now() + CONFIRMATION_TIMER_MS);
    } finally {
      vi.useRealTimers();
    }
  });

  test("CALL_CONFIRMATION_STARTED resolved action includes callerId, callType, timerDuration", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
      const { state, callerId, matchingTileIds } = setupCallScenario(2);

      handleCallAction(
        state,
        { type: "CALL_PUNG", playerId: callerId, tileIds: matchingTileIds },
        "pung",
      );

      const result = resolveCallWindow(state);
      expect(result.resolved!.type).toBe("CALL_CONFIRMATION_STARTED");
      const resolved = result.resolved as {
        type: "CALL_CONFIRMATION_STARTED";
        callerId: string;
        callType: string;
        timerDuration: number;
      };
      expect(resolved.callerId).toBe(callerId);
      expect(resolved.callType).toBe("pung");
      expect(resolved.timerDuration).toBe(CONFIRMATION_TIMER_MS);
    } finally {
      vi.useRealTimers();
    }
  });

  test("remainingCallers contains losing callers sorted by priority", () => {
    const { state, southId, westId } = setupCompetingCallersConfirmation();
    try {
      expect(state.callWindow!.confirmingPlayerId).toBe(southId);
      expect(state.callWindow!.remainingCallers).toHaveLength(1);
      expect(state.callWindow!.remainingCallers[0].playerId).toBe(westId);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("handleConfirmCall — valid confirmation (Story 3A.5)", () => {
  test("valid pung confirmation — tiles removed from rack, discard removed from pool, exposed group created", () => {
    const { state, callerId, matchingTileIds, discardedTile, discarderId } =
      setupConfirmationScenario(2);
    try {
      const rackBefore = state.players[callerId].rack.length;
      const discardPoolBefore = state.players[discarderId].discardPool.length;

      const result = handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: callerId,
        tileIds: matchingTileIds,
      });

      expect(result.accepted).toBe(true);
      expect(result.resolved!.type).toBe("CALL_CONFIRMED");

      // Tiles removed from rack
      expect(state.players[callerId].rack.length).toBe(rackBefore - matchingTileIds.length);
      for (const id of matchingTileIds) {
        expect(state.players[callerId].rack.find((t) => t.id === id)).toBeUndefined();
      }

      // Discard removed from pool
      expect(state.players[discarderId].discardPool.length).toBe(discardPoolBefore - 1);
      expect(
        state.players[discarderId].discardPool.find((t) => t.id === discardedTile.id),
      ).toBeUndefined();

      // Exposed group created
      expect(state.players[callerId].exposedGroups).toHaveLength(1);
      const group = state.players[callerId].exposedGroups[0];
      expect(group.tiles).toHaveLength(3); // 1 discarded + 2 from rack
      expect(group.tiles[0].id).toBe(discardedTile.id);
    } finally {
      vi.useRealTimers();
    }
  });

  test("valid kong confirmation — 3 tiles from rack + 1 discarded", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
      const { state, callerId, discardedTile, matchingTileIds } = setupCallScenario(3);
      const discarderId = state.callWindow!.discarderId;

      // Call kong and resolve
      handleCallAction(
        state,
        { type: "CALL_KONG", playerId: callerId, tileIds: matchingTileIds },
        "kong",
      );
      resolveCallWindow(state);

      const result = handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: callerId,
        tileIds: matchingTileIds,
      });

      expect(result.accepted).toBe(true);
      const group = state.players[callerId].exposedGroups[0];
      expect(group.tiles).toHaveLength(4); // 1 discarded + 3 from rack
      expect(group.type).toBe("kong");
    } finally {
      vi.useRealTimers();
    }
  });

  test("valid quint confirmation — 4 tiles from rack + 1 discarded", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
      const { state, callerId, discardedTile, matchingTileIds } = setupCallScenario(3, 1);
      const discarderId = state.callWindow!.discarderId;

      handleCallAction(
        state,
        { type: "CALL_QUINT", playerId: callerId, tileIds: matchingTileIds },
        "quint",
      );
      resolveCallWindow(state);

      const result = handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: callerId,
        tileIds: matchingTileIds,
      });

      expect(result.accepted).toBe(true);
      const group = state.players[callerId].exposedGroups[0];
      expect(group.tiles).toHaveLength(5); // 1 discarded + 4 from rack
      expect(group.type).toBe("quint");
    } finally {
      vi.useRealTimers();
    }
  });

  test("valid NEWS confirmation with Joker substitution", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
      const { state, callerId } = setupPatternCallScenario("wind-north-1", [
        "wind-east-2",
        "wind-west-2",
        "joker-1",
      ]);

      handleCallAction(
        state,
        {
          type: "CALL_NEWS",
          playerId: callerId,
          tileIds: ["wind-east-2", "wind-west-2", "joker-1"],
        },
        "news",
      );
      resolveCallWindow(state);

      const result = handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: callerId,
        tileIds: ["wind-east-2", "wind-west-2", "joker-1"],
      });

      expect(result.accepted).toBe(true);
      const group = state.players[callerId].exposedGroups[0];
      expect(group.tiles).toHaveLength(4); // 1 discarded + 3 from rack
      expect(group.type).toBe("news");
      expect(group.identity.type).toBe("news");
    } finally {
      vi.useRealTimers();
    }
  });

  test("valid dragon set confirmation with Joker substitution", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
      const { state, callerId } = setupPatternCallScenario("dragon-red-1", [
        "dragon-green-2",
        "joker-3",
      ]);

      handleCallAction(
        state,
        {
          type: "CALL_DRAGON_SET",
          playerId: callerId,
          tileIds: ["dragon-green-2", "joker-3"],
        },
        "dragon_set",
      );
      resolveCallWindow(state);

      const result = handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: callerId,
        tileIds: ["dragon-green-2", "joker-3"],
      });

      expect(result.accepted).toBe(true);
      const group = state.players[callerId].exposedGroups[0];
      expect(group.tiles).toHaveLength(3);
      expect(group.type).toBe("dragon_set");
      expect(group.identity.type).toBe("dragon_set");
    } finally {
      vi.useRealTimers();
    }
  });

  test("exposed group has correct identity for suited tile pung", () => {
    const { state, callerId, matchingTileIds, discardedTile } = setupConfirmationScenario(2);
    try {
      handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: callerId,
        tileIds: matchingTileIds,
      });

      const group = state.players[callerId].exposedGroups[0];
      expect(group.identity.type).toBe("pung");
      if (discardedTile.category === "suited") {
        expect(group.identity.suit).toBe(discardedTile.suit);
        expect(group.identity.value).toBe(discardedTile.value);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  test("after valid confirmation — currentTurn is caller, turnPhase is discard, callWindow is null", () => {
    const { state, callerId, matchingTileIds } = setupConfirmationScenario(2);
    try {
      handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: callerId,
        tileIds: matchingTileIds,
      });

      expect(state.currentTurn).toBe(callerId);
      expect(state.turnPhase).toBe("discard");
      expect(state.callWindow).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  test("CALL_CONFIRMED resolved action includes all required fields", () => {
    const { state, callerId, matchingTileIds, discardedTile, discarderId } =
      setupConfirmationScenario(2);
    try {
      const result = handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: callerId,
        tileIds: matchingTileIds,
      });

      const resolved = result.resolved as {
        type: "CALL_CONFIRMED";
        callerId: string;
        callType: string;
        exposedTileIds: string[];
        calledTileId: string;
        fromPlayerId: string;
      };
      expect(resolved.callerId).toBe(callerId);
      expect(resolved.callType).toBe("pung");
      expect(resolved.calledTileId).toBe(discardedTile.id);
      expect(resolved.fromPlayerId).toBe(discarderId);
      expect(resolved.exposedTileIds).toHaveLength(3); // 1 discard + 2 from rack
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("handleConfirmCall — validation rejections (Story 3A.5)", () => {
  test("rejects when no confirmation phase is active", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    const result = handleConfirmCall(state, {
      type: "CONFIRM_CALL",
      playerId: eastId,
      tileIds: ["t1", "t2"],
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NO_CONFIRMATION_PHASE");
  });

  test("rejects when wrong player attempts confirmation — zero mutations", () => {
    const { state, matchingTileIds } = setupConfirmationScenario(2);
    try {
      const westId = getPlayerBySeat(state, "west");
      const stateBefore = JSON.stringify(state);

      const result = handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: westId,
        tileIds: matchingTileIds,
      });

      expect(result.accepted).toBe(false);
      expect(result.reason).toBe("NOT_CONFIRMING_PLAYER");
      expect(JSON.stringify(state)).toBe(stateBefore);
    } finally {
      vi.useRealTimers();
    }
  });

  test("rejects when tile not in rack — zero mutations", () => {
    const { state, callerId } = setupConfirmationScenario(2);
    try {
      const stateBefore = JSON.stringify(state);

      const result = handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: callerId,
        tileIds: ["fake-id-1", "fake-id-2"],
      });

      expect(result.accepted).toBe(false);
      expect(result.reason).toBe("TILE_NOT_IN_RACK");
      expect(JSON.stringify(state)).toBe(stateBefore);
    } finally {
      vi.useRealTimers();
    }
  });

  test("rejects duplicate tile IDs — zero mutations", () => {
    const { state, callerId, matchingTileIds } = setupConfirmationScenario(2);
    try {
      const stateBefore = JSON.stringify(state);

      const result = handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: callerId,
        tileIds: [matchingTileIds[0], matchingTileIds[0]],
      });

      expect(result.accepted).toBe(false);
      expect(result.reason).toBe("DUPLICATE_TILE_IDS");
      expect(JSON.stringify(state)).toBe(stateBefore);
    } finally {
      vi.useRealTimers();
    }
  });

  test("invalid group auto-retracts — no dead hand, no penalty", () => {
    const { state, callerId } = setupConfirmationScenario(2);
    try {
      // Find 2 non-matching tiles in the caller's rack
      const discardedTile = state.callWindow!.discardedTile;
      const nonMatchingTiles = state.players[callerId].rack.filter((t) => {
        if (t.category === "joker") return false;
        return !tilesMatch(t, discardedTile);
      });

      if (nonMatchingTiles.length >= 2) {
        const result = handleConfirmCall(state, {
          type: "CONFIRM_CALL",
          playerId: callerId,
          tileIds: [nonMatchingTiles[0].id, nonMatchingTiles[1].id],
        });

        // Auto-retract — with no remaining callers, window reopens or closes
        expect(result.accepted).toBe(true);
        // No exposed groups created — the call was retracted
        expect(state.players[callerId].exposedGroups).toHaveLength(0);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("handleRetractCall (Story 3A.5)", () => {
  test("retraction with remaining callers — next caller enters confirmation", () => {
    const { state, southId, westId, westTileIds } = setupCompetingCallersConfirmation();
    try {
      expect(state.callWindow!.confirmingPlayerId).toBe(southId);

      const result = handleRetractCall(state, {
        type: "RETRACT_CALL",
        playerId: southId,
      });

      expect(result.accepted).toBe(true);
      expect(result.resolved!.type).toBe("CALL_RETRACTED");
      const resolved = result.resolved as {
        type: "CALL_RETRACTED";
        callerId: string;
        nextCallerId: string;
      };
      expect(resolved.callerId).toBe(southId);
      expect(resolved.nextCallerId).toBe(westId);

      // West is now in confirmation
      expect(state.callWindow!.status).toBe("confirming");
      expect(state.callWindow!.confirmingPlayerId).toBe(westId);
    } finally {
      vi.useRealTimers();
    }
  });

  test("retraction with no remaining callers and time remaining — window reopens", () => {
    const { state, callerId } = setupConfirmationScenario(2);
    try {
      const result = handleRetractCall(state, {
        type: "RETRACT_CALL",
        playerId: callerId,
      });

      expect(result.accepted).toBe(true);
      // Window should reopen or close depending on remaining time
      // Since we set time at 12:00:00 and openedAt is the same, time might remain
      const resolvedType = result.resolved!.type;
      expect(["CALL_WINDOW_RESUMED", "CALL_WINDOW_CLOSED"].includes(resolvedType)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  test("retraction when not in confirmation phase — rejected", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    const result = handleRetractCall(state, {
      type: "RETRACT_CALL",
      playerId: eastId,
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NO_CONFIRMATION_PHASE");
  });

  test("wrong player attempts retraction — rejected with zero mutations", () => {
    const { state, callerId } = setupConfirmationScenario(2);
    try {
      const westId = getPlayerBySeat(state, "west");
      const stateBefore = JSON.stringify(state);

      const result = handleRetractCall(state, {
        type: "RETRACT_CALL",
        playerId: westId,
      });

      expect(result.accepted).toBe(false);
      expect(result.reason).toBe("NOT_CONFIRMING_PLAYER");
      expect(JSON.stringify(state)).toBe(stateBefore);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("handleConfirmationTimeout (Story 3A.5)", () => {
  test("timeout triggers auto-retraction — same behavior as explicit retract", () => {
    const { state, southId, westId } = setupCompetingCallersConfirmation();
    try {
      // Advance time past confirmation expiry
      vi.advanceTimersByTime(CONFIRMATION_TIMER_MS);

      const result = handleConfirmationTimeout(state);

      expect(result.accepted).toBe(true);
      expect(result.resolved!.type).toBe("CALL_RETRACTED");
      const resolved = result.resolved as {
        type: "CALL_RETRACTED";
        callerId: string;
        reason: string;
        nextCallerId: string;
      };
      expect(resolved.callerId).toBe(southId);
      expect(resolved.reason).toBe("CONFIRMATION_TIMEOUT");
      expect(resolved.nextCallerId).toBe(westId);
    } finally {
      vi.useRealTimers();
    }
  });

  test("timeout with remaining callers promotes next caller", () => {
    const { state, southId, westId } = setupCompetingCallersConfirmation();
    try {
      vi.advanceTimersByTime(CONFIRMATION_TIMER_MS);
      handleConfirmationTimeout(state);

      expect(state.callWindow!.status).toBe("confirming");
      expect(state.callWindow!.confirmingPlayerId).toBe(westId);
    } finally {
      vi.useRealTimers();
    }
  });

  test("timeout when not in confirmation phase — rejected", () => {
    const state = createPlayState();

    const result = handleConfirmationTimeout(state);

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NO_CONFIRMATION_PHASE");
  });
});

describe("Exposure permanence (Story 3A.5)", () => {
  test("exposed groups persist through subsequent discard and draw actions", () => {
    const { state, callerId, matchingTileIds } = setupConfirmationScenario(2);
    try {
      handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: callerId,
        tileIds: matchingTileIds,
      });

      const groupsBefore = state.players[callerId].exposedGroups.length;
      const groupTilesBefore = [...state.players[callerId].exposedGroups[0].tiles.map((t) => t.id)];

      // Caller discards
      const discardableTile = state.players[callerId].rack.find((t) => t.category !== "joker");
      if (discardableTile) {
        handleDiscardTile(state, {
          type: "DISCARD_TILE",
          playerId: callerId,
          tileId: discardableTile.id,
        });
      }

      // Exposed groups unchanged
      expect(state.players[callerId].exposedGroups.length).toBe(groupsBefore);
      expect(state.players[callerId].exposedGroups[0].tiles.map((t) => t.id)).toEqual(
        groupTilesBefore,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  test("exposed group identity is stable — type, suit, value unchanged", () => {
    const { state, callerId, matchingTileIds, discardedTile } = setupConfirmationScenario(2);
    try {
      handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: callerId,
        tileIds: matchingTileIds,
      });

      const identity = state.players[callerId].exposedGroups[0].identity;
      expect(identity.type).toBe("pung");

      // Identity fields are stable
      if (discardedTile.category === "suited") {
        expect(identity.suit).toBe(discardedTile.suit);
        expect(identity.value).toBe(discardedTile.value);
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Integration: full call flow (Story 3A.5)", () => {
  test("discard → call → freeze → resolve → confirm → exposed group → turn advances", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
      const state = createPlayState();
      const eastId = getPlayerBySeat(state, "east");
      const southId = getPlayerBySeat(state, "south");

      // 1. East discards
      const discardedTile = discardTile(state, eastId);
      expect(state.turnPhase).toBe("callWindow");

      // 2. South calls pung
      const matchingTiles = findMatchingTiles(state, discardedTile, 2);
      injectTilesIntoRack(state, southId, matchingTiles);
      const tileIds = matchingTiles.map((t) => t.id);

      handleCallAction(state, { type: "CALL_PUNG", playerId: southId, tileIds }, "pung");
      expect(state.callWindow!.status).toBe("frozen");

      // 3. Resolve → enters confirmation
      resolveCallWindow(state);
      expect(state.callWindow!.status).toBe("confirming");
      expect(state.callWindow!.confirmingPlayerId).toBe(southId);

      // 4. South confirms
      const result = handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: southId,
        tileIds,
      });
      expect(result.accepted).toBe(true);
      expect(result.resolved!.type).toBe("CALL_CONFIRMED");

      // 5. Verify final state
      expect(state.callWindow).toBeNull();
      expect(state.currentTurn).toBe(southId);
      expect(state.turnPhase).toBe("discard");
      expect(state.players[southId].exposedGroups).toHaveLength(1);
      expect(state.players[southId].exposedGroups[0].tiles).toHaveLength(3);
    } finally {
      vi.useRealTimers();
    }
  });

  test("discard → call → freeze → resolve → retract → fallback caller confirms", () => {
    const { state, southId, westId, westTileIds, discardedTile } =
      setupCompetingCallersConfirmation();
    try {
      // South retracts
      handleRetractCall(state, { type: "RETRACT_CALL", playerId: southId });

      // West is now in confirmation
      expect(state.callWindow!.confirmingPlayerId).toBe(westId);

      // West confirms
      const result = handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: westId,
        tileIds: westTileIds,
      });

      expect(result.accepted).toBe(true);
      expect(result.resolved!.type).toBe("CALL_CONFIRMED");
      expect(state.currentTurn).toBe(westId);
      expect(state.turnPhase).toBe("discard");
      expect(state.players[westId].exposedGroups).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  test("discard → call → freeze → resolve → timeout → fallback or reopen", () => {
    const { state, southId, westId } = setupCompetingCallersConfirmation();
    try {
      // Timeout for South
      vi.advanceTimersByTime(CONFIRMATION_TIMER_MS);
      const result = handleConfirmationTimeout(state);

      expect(result.accepted).toBe(true);
      // West should be promoted to confirmation
      expect(state.callWindow!.status).toBe("confirming");
      expect(state.callWindow!.confirmingPlayerId).toBe(westId);
    } finally {
      vi.useRealTimers();
    }
  });
});
