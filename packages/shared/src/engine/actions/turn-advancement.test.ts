import { describe, test, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import {
  handlePassCall,
  handleCallAction,
  resolveCallWindow,
  handleConfirmCall,
  handleRetractCall,
  tilesMatch,
} from "./call-window";
import { handleDiscardTile } from "./discard";
import { handleDrawTile } from "./draw";
import { createPlayState } from "../../testing/fixtures";
import { getPlayerBySeat, getNonDiscarders, injectTilesIntoRack } from "../../testing/helpers";
import type { GameState, SeatWind } from "../../types/game-state";
import type { Tile } from "../../types/tiles";

// ============================================================================
// Test Helpers
// ============================================================================

/** Discard a non-Joker tile from the given player's rack. Returns the discarded tile. */
function discardTile(state: GameState, playerId: string): Tile {
  const player = state.players[playerId];
  const tile = player.rack.find((t) => t.category !== "joker");
  if (!tile) throw new Error(`No discardable tile in rack for player '${playerId}'`);
  handleDiscardTile(state, { type: "DISCARD_TILE", playerId, tileId: tile.id });
  return tile;
}

/** Have all non-discarders pass, closing the call window. */
function passAllNonDiscarders(state: GameState): void {
  const nonDiscarders = getNonDiscarders(state);
  for (const id of nonDiscarders) {
    handlePassCall(state, { type: "PASS_CALL", playerId: id });
  }
}

/** Find tiles in the wall that match a given tile (same identity, not Jokers). */
function findMatchingTiles(state: GameState, targetTile: Tile, count: number): Tile[] {
  const matches: Tile[] = [];
  for (const tile of state.wall) {
    if (matches.length >= count) break;
    if (tile.id !== targetTile.id && tile.category !== "joker" && tilesMatch(tile, targetTile)) {
      matches.push(tile);
    }
  }
  // Also search other players' racks
  for (const player of Object.values(state.players)) {
    for (const tile of player.rack) {
      if (matches.length >= count) break;
      if (tile.id !== targetTile.id && tile.category !== "joker" && tilesMatch(tile, targetTile)) {
        matches.push(tile);
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
 * Execute a full call flow: discarder discards, caller calls pung, confirms, and gets turn.
 * Returns the caller's ID and the discarded tile.
 */
function executeCallFlow(
  state: GameState,
  discarderId: string,
  callerSeat: SeatWind,
): { callerId: string; discardedTile: Tile } {
  // 1. Discarder discards
  const discardedTile = discardTile(state, discarderId);

  // 2. Find matching tiles for the caller
  const callerId = getPlayerBySeat(state, callerSeat);
  let matchingTiles = findMatchingTiles(state, discardedTile, 2);

  // If not enough matching tiles, use Jokers
  if (matchingTiles.length < 2) {
    const jokersNeeded = 2 - matchingTiles.length;
    const jokers = findJokers(state, jokersNeeded);
    matchingTiles = [...matchingTiles, ...jokers];
  }

  injectTilesIntoRack(state, callerId, matchingTiles);
  const tileIds = matchingTiles.map((t) => t.id);

  // 3. Call pung
  handleCallAction(state, { type: "CALL_PUNG", playerId: callerId, tileIds }, "pung");

  // 4. Resolve
  resolveCallWindow(state);

  // 5. Confirm
  const result = handleConfirmCall(state, {
    type: "CONFIRM_CALL",
    playerId: callerId,
    tileIds,
  });
  expect(result.accepted).toBe(true);
  expect(state.currentTurn).toBe(callerId);
  expect(state.turnPhase).toBe("discard");

  return { callerId, discardedTile };
}

// ============================================================================
// Task 2: Turn advancement after caller's discard (AC: 2, 3, 4)
// ============================================================================

describe("Turn advancement after caller's discard (Story 3A.6)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("AC3: East discards, West calls → West discards → North draws (South skipped)", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");
    const westId = getPlayerBySeat(state, "west");
    const northId = getPlayerBySeat(state, "north");

    // East discards, West calls pung
    executeCallFlow(state, eastId, "west");
    expect(state.currentTurn).toBe(westId);
    expect(state.turnPhase).toBe("discard");

    // West discards → new call window opens with West as discarder
    discardTile(state, westId);
    expect(state.callWindow).not.toBeNull();
    expect(state.callWindow!.discarderId).toBe(westId);

    // All pass → turn advances to next counterclockwise from West = North
    passAllNonDiscarders(state);
    expect(state.callWindow).toBeNull();
    expect(state.currentTurn).toBe(northId);
    expect(state.turnPhase).toBe("draw");

    // Verify South was skipped — South is NOT the current turn
    expect(state.currentTurn).not.toBe(southId);
  });

  test("AC4: East discards, South calls → South discards → West draws (no skip)", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");
    const westId = getPlayerBySeat(state, "west");

    // East discards, South calls pung (South is next in order — no skip)
    executeCallFlow(state, eastId, "south");
    expect(state.currentTurn).toBe(southId);

    // South discards → new call window
    discardTile(state, southId);
    expect(state.callWindow!.discarderId).toBe(southId);

    // All pass → West draws (normal counterclockwise progression)
    passAllNonDiscarders(state);
    expect(state.currentTurn).toBe(westId);
    expect(state.turnPhase).toBe("draw");
  });

  test("AC2: East discards, North calls → North discards → East draws (wraps, skips South+West)", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");
    const westId = getPlayerBySeat(state, "west");
    const northId = getPlayerBySeat(state, "north");

    // East discards, North calls pung
    executeCallFlow(state, eastId, "north");
    expect(state.currentTurn).toBe(northId);

    // North discards → new call window
    discardTile(state, northId);
    expect(state.callWindow!.discarderId).toBe(northId);

    // All pass → turn advances from North → East (wraps around)
    passAllNonDiscarders(state);
    expect(state.currentTurn).toBe(eastId);
    expect(state.turnPhase).toBe("draw");

    // South and West were both skipped
    expect(state.currentTurn).not.toBe(southId);
    expect(state.currentTurn).not.toBe(westId);
  });

  test("closeCallWindow advances from CALLER (new discarder), not original discarder", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const westId = getPlayerBySeat(state, "west");
    const northId = getPlayerBySeat(state, "north");

    // East discards, West calls
    executeCallFlow(state, eastId, "west");

    // West discards — KEY: callWindow.discarderId is now West
    discardTile(state, westId);
    expect(state.callWindow!.discarderId).toBe(westId);

    // Close window — next player is counterclockwise from West (= North), NOT from East
    passAllNonDiscarders(state);
    expect(state.currentTurn).toBe(northId);
  });
});

// ============================================================================
// Task 3: Comprehensive skip-ahead scenario tests (AC: 2, 3)
// ============================================================================

describe("Skip-ahead scenarios (Story 3A.6)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("2-player skip: East discards, North calls → turn order resumes North→East→South→West", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");
    const westId = getPlayerBySeat(state, "west");
    const northId = getPlayerBySeat(state, "north");

    // East discards, North calls (skip South + West)
    executeCallFlow(state, eastId, "north");

    // North discards → all pass → East draws
    discardTile(state, northId);
    passAllNonDiscarders(state);
    expect(state.currentTurn).toBe(eastId);
    expect(state.turnPhase).toBe("draw");

    // East draws and discards → all pass → South draws (normal order resumes)
    handleDrawTile(state, { type: "DRAW_TILE", playerId: eastId });
    discardTile(state, eastId);
    passAllNonDiscarders(state);
    expect(state.currentTurn).toBe(southId);
    expect(state.turnPhase).toBe("draw");

    // South draws and discards → all pass → West draws (normal order)
    handleDrawTile(state, { type: "DRAW_TILE", playerId: southId });
    discardTile(state, southId);
    passAllNonDiscarders(state);
    expect(state.currentTurn).toBe(westId);
    expect(state.turnPhase).toBe("draw");
  });

  test("1-player skip: East discards, West calls → West discards, North draws", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const westId = getPlayerBySeat(state, "west");
    const northId = getPlayerBySeat(state, "north");

    // East discards, West calls (skip South)
    executeCallFlow(state, eastId, "west");

    // West discards → all pass → North draws
    discardTile(state, westId);
    passAllNonDiscarders(state);
    expect(state.currentTurn).toBe(northId);
    expect(state.turnPhase).toBe("draw");
  });

  test("consecutive calls in same game — turn order resets correctly each time", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");
    const westId = getPlayerBySeat(state, "west");
    const northId = getPlayerBySeat(state, "north");

    // First call: East discards, West calls (skip South)
    executeCallFlow(state, eastId, "west");
    discardTile(state, westId);
    passAllNonDiscarders(state);
    expect(state.currentTurn).toBe(northId);

    // North draws, discards normally
    handleDrawTile(state, { type: "DRAW_TILE", playerId: northId });
    discardTile(state, northId);
    passAllNonDiscarders(state);
    expect(state.currentTurn).toBe(eastId);

    // Second call: East draws, discards → South calls (no skip — South is next)
    handleDrawTile(state, { type: "DRAW_TILE", playerId: eastId });
    executeCallFlow(state, eastId, "south");
    discardTile(state, southId);
    passAllNonDiscarders(state);
    expect(state.currentTurn).toBe(westId);
    expect(state.turnPhase).toBe("draw");
  });

  test("chained calls: East discards → West calls → West discards → North calls → East draws", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const westId = getPlayerBySeat(state, "west");
    const northId = getPlayerBySeat(state, "north");

    // First call: East discards, West calls
    executeCallFlow(state, eastId, "west");

    // West discards, North calls West's discard
    executeCallFlow(state, westId, "north");

    // North discards → all pass → East draws (counterclockwise from North)
    discardTile(state, northId);
    passAllNonDiscarders(state);
    expect(state.currentTurn).toBe(eastId);
    expect(state.turnPhase).toBe("draw");
  });
});

// ============================================================================
// Task 4: Edge case tests (AC: all)
// ============================================================================

describe("Skip-ahead edge cases (Story 3A.6)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("wall depletion after caller's discard → game ends as wall game", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const westId = getPlayerBySeat(state, "west");

    // East discards, West calls
    executeCallFlow(state, eastId, "west");

    // Empty the wall before West discards
    state.wall.length = 0;
    state.wallRemaining = 0;

    // West discards → call window opens
    discardTile(state, westId);
    expect(state.callWindow).not.toBeNull();

    // All pass → wall empty → game ends as wall game
    passAllNonDiscarders(state);
    expect(state.gamePhase).toBe("scoreboard");
    expect(state.gameResult).toEqual({ winnerId: null, points: 0 });
  });

  test("caller's discard gets called by another player (nested call)", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const westId = getPlayerBySeat(state, "west");
    const northId = getPlayerBySeat(state, "north");

    // East discards, West calls
    executeCallFlow(state, eastId, "west");

    // West discards, North calls West's discard
    executeCallFlow(state, westId, "north");

    // North now has the turn
    expect(state.currentTurn).toBe(northId);
    expect(state.turnPhase).toBe("discard");

    // North discards → all pass → East draws (counterclockwise from North)
    discardTile(state, northId);
    passAllNonDiscarders(state);
    expect(state.currentTurn).toBe(eastId);
    expect(state.turnPhase).toBe("draw");
  });

  test("retraction during confirmation → window reopens → no call → turn advances from original discarder", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    // East discards
    const discardedTile = discardTile(state, eastId);

    // South calls pung
    const matchingTiles = findMatchingTiles(state, discardedTile, 2);
    if (matchingTiles.length < 2) {
      const jokers = findJokers(state, 2 - matchingTiles.length);
      matchingTiles.push(...jokers);
    }
    injectTilesIntoRack(state, southId, matchingTiles);
    const tileIds = matchingTiles.map((t) => t.id);

    handleCallAction(state, { type: "CALL_PUNG", playerId: southId, tileIds }, "pung");
    resolveCallWindow(state);
    expect(state.callWindow!.status).toBe("confirming");

    // South retracts — no remaining callers, time remaining → window reopens
    handleRetractCall(state, { type: "RETRACT_CALL", playerId: southId });
    expect(state.callWindow!.status).toBe("open");

    // Now all non-discarders pass → turn advances from East (original discarder)
    const nonDiscarders = getNonDiscarders(state);
    for (const id of nonDiscarders) {
      if (!state.callWindow!.passes.includes(id)) {
        handlePassCall(state, { type: "PASS_CALL", playerId: id });
      }
    }

    // Turn should advance from East to South (normal counterclockwise, no skip)
    expect(state.callWindow).toBeNull();
    expect(state.currentTurn).toBe(southId);
    expect(state.turnPhase).toBe("draw");
  });
});
