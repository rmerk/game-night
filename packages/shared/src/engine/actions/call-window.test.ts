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
} from "./call-window";
import { handleDiscardTile } from "./discard";
import { handleDrawTile } from "./draw";
import { createPlayState } from "../../testing/fixtures";
import { getPlayerBySeat, buildHand } from "../../testing/helpers";
import { WINDS, DRAGONS } from "../../constants";
import type { GameState } from "../../types/game-state";
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
    expect(result.resolved).toEqual({ type: "CALL_PUNG", playerId: callerId });
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
    expect(result.resolved).toEqual({ type: "CALL_KONG", playerId: callerId });
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
    expect(result.resolved).toEqual({ type: "CALL_QUINT", playerId: callerId });
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
    expect(result2.accepted).toBe(true);
    expect(state.callWindow!.calls).toHaveLength(2);
    expect(state.callWindow!.calls[0].playerId).toBe(southId);
    expect(state.callWindow!.calls[1].playerId).toBe(westId);
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
 * Set up a call window where a specific wind tile is discarded by East,
 * and inject specific tiles into South's rack for NEWS call testing.
 */
function setupNewsScenario(
  discardWindValue: string,
  rackTileIds: string[],
): {
  state: GameState;
  callerId: string;
  discardedTile: Tile;
} {
  const state = createPlayState();
  const eastId = getPlayerBySeat(state, "east");
  const southId = getPlayerBySeat(state, "south");

  // Find a wind tile of the desired value in East's rack or inject one
  const windTileId = `wind-${discardWindValue}-1`;
  const windTile = buildHand([windTileId])[0];

  // Inject the wind tile into East's rack and discard it
  injectTilesIntoRack(state, eastId, [windTile]);
  handleDiscardTile(state, { type: "DISCARD_TILE", playerId: eastId, tileId: windTileId });

  // Inject the specified tiles into South's rack
  const rackTiles = buildHand(rackTileIds);
  injectTilesIntoRack(state, southId, rackTiles);

  return {
    state,
    callerId: southId,
    discardedTile: windTile,
  };
}

describe("handleCallAction — NEWS call validation", () => {
  test("valid NEWS call — player has 3 other wind tiles, discard is a wind → accepted", () => {
    // Discard North, rack has East + West + South
    const { state, callerId } = setupNewsScenario("north", [
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
    expect(result.resolved).toEqual({ type: "CALL_NEWS", playerId: callerId });
    expect(state.callWindow!.calls).toHaveLength(1);
    expect(state.callWindow!.calls[0].callType).toBe("news");
  });

  test("valid NEWS call with 1 Joker substitution — player has 2 winds + 1 Joker → accepted", () => {
    const { state, callerId } = setupNewsScenario("north", [
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
    expect(state.callWindow!.calls[0].callType).toBe("news");
  });

  test("valid NEWS call with 2 Jokers — player has 1 wind + 2 Jokers → accepted", () => {
    const { state, callerId } = setupNewsScenario("north", ["wind-east-2", "joker-1", "joker-2"]);

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
    expect(state.callWindow!.calls[0].callType).toBe("news");
  });

  test("invalid NEWS call — player has 3 wind tiles but all same wind as discard → INVALID_GROUP", () => {
    // Discard North, rack has 3 more North tiles (not distinct winds)
    const { state, callerId } = setupNewsScenario("north", [
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
    const { state, callerId } = setupNewsScenario("north", [
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
    const { state } = setupNewsScenario("north", ["wind-east-2", "wind-west-2", "wind-south-2"]);
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
    const { state, callerId } = setupNewsScenario("north", [
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
    const { state, callerId } = setupNewsScenario("north", [
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
    const { state, callerId } = setupNewsScenario("north", [
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

function setupDragonScenario(
  discardDragonValue: string,
  rackTileIds: string[],
): {
  state: GameState;
  callerId: string;
  discardedTile: Tile;
} {
  const state = createPlayState();
  const eastId = getPlayerBySeat(state, "east");
  const southId = getPlayerBySeat(state, "south");

  const dragonTileId = `dragon-${discardDragonValue}-1`;
  const dragonTile = buildHand([dragonTileId])[0];

  injectTilesIntoRack(state, eastId, [dragonTile]);
  handleDiscardTile(state, { type: "DISCARD_TILE", playerId: eastId, tileId: dragonTileId });

  const rackTiles = buildHand(rackTileIds);
  injectTilesIntoRack(state, southId, rackTiles);

  return {
    state,
    callerId: southId,
    discardedTile: dragonTile,
  };
}

describe("handleCallAction — Dragon set call validation", () => {
  test("valid Dragon set call — player has 2 other dragon tiles, discard is a dragon → accepted", () => {
    const { state, callerId } = setupDragonScenario("red", ["dragon-green-2", "dragon-soap-2"]);

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
    expect(result.resolved).toEqual({ type: "CALL_DRAGON_SET", playerId: callerId });
    expect(state.callWindow!.calls).toHaveLength(1);
    expect(state.callWindow!.calls[0].callType).toBe("dragon_set");
  });

  test("valid Dragon set with Joker — player has 1 dragon + 1 Joker → accepted", () => {
    const { state, callerId } = setupDragonScenario("red", ["dragon-green-2", "joker-3"]);

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
    const { state, callerId } = setupDragonScenario("red", ["dragon-green-2", "dragon-green-3"]);

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
});

// ============================================================================
// validateNewsGroup and validateDragonSetGroup unit tests (Story 3A.3)
// ============================================================================

describe("validateNewsGroup", () => {
  test("valid: 3 distinct non-discard winds cover all 4", () => {
    const [discard] = buildHand(["wind-north-1"]);
    const rack = buildHand(["wind-east-1", "wind-west-1", "wind-south-1"]);

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
  test("valid: 2 distinct non-discard dragons cover all 3", () => {
    const [discard] = buildHand(["dragon-red-1"]);
    const rack = buildHand(["dragon-green-1", "dragon-soap-1"]);

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
