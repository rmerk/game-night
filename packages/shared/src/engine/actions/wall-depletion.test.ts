import { describe, test, expect } from "vite-plus/test";
import { handleDiscardTile } from "./discard";
import { handleDrawTile } from "./draw";
import { handlePassCall } from "./call-window";
import { handleAction } from "../game-engine";
import { createPlayState, TEST_PLAYER_IDS } from "../../testing/fixtures";
import { TILE_COUNT } from "../../constants";
import { getPlayerBySeat } from "../../testing/helpers";
import type { GameState } from "../../types/game-state";

/** Drain wall to exactly `remaining` tiles. Keeps wallRemaining in sync. */
function drainWallTo(state: GameState, remaining: number): void {
  if (remaining < 0 || remaining > state.wall.length) {
    throw new Error(`Cannot drain wall to ${remaining} (current: ${state.wall.length})`);
  }
  state.wall.splice(0, state.wall.length - remaining);
  state.wallRemaining = state.wall.length;
}

/** Get a discardable (non-Joker) tile ID from a player's rack. */
function getDiscardableTileId(state: GameState, playerId: string): string {
  const player = state.players[playerId];
  const tile = player.rack.find((t) => t.category !== "joker");
  if (!tile) throw new Error("No discardable tile in rack");
  return tile.id;
}

/** Close the call window by having all non-discarder players pass. */
function passAllPlayers(state: GameState): void {
  if (!state.callWindow) throw new Error("No call window to pass");
  const discarderId = state.callWindow.discarderId;
  const nonDiscarders = Object.keys(state.players).filter((id) => id !== discarderId);
  for (const playerId of nonDiscarders) {
    if (!state.callWindow) break; // Window may close early
    handlePassCall(state, { type: "PASS_CALL", playerId });
  }
}

/**
 * Set up state for a draw-then-discard scenario on a non-East player.
 * Advances to South's turn in draw phase, drains wall to specified remaining.
 */
function setupForLastDraw(
  state: GameState,
  wallRemaining: number,
): { drawerId: string; nextPlayerId: string } {
  const eastId = getPlayerBySeat(state, "east");
  const southId = getPlayerBySeat(state, "south");
  const westId = getPlayerBySeat(state, "west");

  // East discards first (starts in discard phase with 14 tiles)
  const eastTileId = getDiscardableTileId(state, eastId);
  handleDiscardTile(state, { type: "DISCARD_TILE", playerId: eastId, tileId: eastTileId });

  // Close call window so South can draw
  passAllPlayers(state);

  // Now it's South's turn in draw phase
  expect(state.currentTurn).toBe(southId);
  expect(state.turnPhase).toBe("draw");

  drainWallTo(state, wallRemaining);

  return { drawerId: southId, nextPlayerId: westId };
}

describe("Wall Depletion & Game End", () => {
  test("last discard opens call window even when wall is empty (last discard can be called)", () => {
    const state = createPlayState();
    const { drawerId } = setupForLastDraw(state, 1);

    handleDrawTile(state, { type: "DRAW_TILE", playerId: drawerId });
    const tileId = getDiscardableTileId(state, drawerId);
    const result = handleDiscardTile(state, { type: "DISCARD_TILE", playerId: drawerId, tileId });

    // Call window opens — game does NOT end yet
    expect(result.accepted).toBe(true);
    expect(state.gamePhase).toBe("play");
    expect(state.turnPhase).toBe("callWindow");
    expect(state.callWindow).not.toBeNull();
  });

  test("wall game triggers when call window closes with empty wall and no calls", () => {
    const state = createPlayState();
    const { drawerId } = setupForLastDraw(state, 1);

    handleDrawTile(state, { type: "DRAW_TILE", playerId: drawerId });
    const tileId = getDiscardableTileId(state, drawerId);
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: drawerId, tileId });

    // All players pass — call window closes → wall game
    passAllPlayers(state);

    expect(state.gamePhase).toBe("scoreboard");
    expect(state.gameResult).toEqual({ winnerId: null, points: 0 });
  });

  test("wall game via closeCallWindow returns WALL_GAME resolved action", () => {
    const state = createPlayState();
    const { drawerId } = setupForLastDraw(state, 1);

    handleDrawTile(state, { type: "DRAW_TILE", playerId: drawerId });
    const tileId = getDiscardableTileId(state, drawerId);
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: drawerId, tileId });

    // Pass 2 of 3 non-discarders first
    const nonDiscarders = Object.keys(state.players).filter((id) => id !== drawerId);
    handlePassCall(state, { type: "PASS_CALL", playerId: nonDiscarders[0] });
    handlePassCall(state, { type: "PASS_CALL", playerId: nonDiscarders[1] });

    // Last pass triggers close and wall game — propagates WALL_GAME from closeCallWindow
    const result = handlePassCall(state, { type: "PASS_CALL", playerId: nonDiscarders[2] });
    expect(result.resolved).toEqual({ type: "WALL_GAME" });
    expect(state.gamePhase).toBe("scoreboard");
  });

  test("scores unchanged after wall game — all players remain at 0", () => {
    const state = createPlayState();
    const scoresBefore = { ...state.scores };

    const { drawerId } = setupForLastDraw(state, 1);
    handleDrawTile(state, { type: "DRAW_TILE", playerId: drawerId });
    const tileId = getDiscardableTileId(state, drawerId);
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: drawerId, tileId });
    passAllPlayers(state);

    expect(state.scores).toEqual(scoresBefore);
    for (const playerId of TEST_PLAYER_IDS) {
      expect(state.scores[playerId]).toBe(0);
    }
  });

  test("draw rejected with WALL_EMPTY after wall depleted", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    // Drain wall completely and set up for draw attempt
    drainWallTo(state, 0);
    state.currentTurn = eastId;
    state.turnPhase = "draw";

    const result = handleDrawTile(state, { type: "DRAW_TILE", playerId: eastId });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("WALL_EMPTY");
  });

  test("draw rejected with WRONG_PHASE when gamePhase is scoreboard", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    state.gamePhase = "scoreboard";
    state.turnPhase = "draw";

    const result = handleDrawTile(state, { type: "DRAW_TILE", playerId: eastId });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("WRONG_PHASE");
  });

  test("discard rejected with WRONG_PHASE when gamePhase is scoreboard", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const tileId = state.players[eastId].rack[0].id;

    state.gamePhase = "scoreboard";

    const result = handleDiscardTile(state, { type: "DISCARD_TILE", playerId: eastId, tileId });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("WRONG_PHASE");
  });

  test("wallRemaining accurately tracks wall depletion through draw-discard cycles", () => {
    const state = createPlayState();
    expect(state.wallRemaining).toBe(TILE_COUNT - (14 + 13 * 3)); // east gets 14, others get 13

    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    // East discards (no draw needed — first turn)
    const eastTileId = getDiscardableTileId(state, eastId);
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: eastId, tileId: eastTileId });
    expect(state.wallRemaining).toBe(99); // Discard doesn't change wall

    // Close call window so South can draw
    passAllPlayers(state);

    // South draws
    handleDrawTile(state, { type: "DRAW_TILE", playerId: southId });
    expect(state.wallRemaining).toBe(98); // Draw decrements

    // South discards
    const southTileId = getDiscardableTileId(state, southId);
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: southId, tileId: southTileId });
    expect(state.wallRemaining).toBe(98); // Discard doesn't change wall
  });

  test("discard with 2+ wall tiles remaining does NOT trigger wall game", () => {
    const state = createPlayState();
    const { drawerId } = setupForLastDraw(state, 3);

    handleDrawTile(state, { type: "DRAW_TILE", playerId: drawerId });

    // Wall has 2 tiles left — should NOT end game
    const tileId = getDiscardableTileId(state, drawerId);
    const result = handleDiscardTile(state, { type: "DISCARD_TILE", playerId: drawerId, tileId });

    expect(result.accepted).toBe(true);
    expect(result.resolved).toEqual({ type: "DISCARD_TILE", playerId: drawerId, tileId });
    expect(state.gamePhase).toBe("play");
    expect(state.gameResult).toBeNull();
    // Call window is open, not wall game
    expect(state.callWindow).not.toBeNull();
  });

  test("full game simulation — play through until wall depletion", () => {
    const state = createPlayState();

    expect(state.gamePhase).toBe("play");
    expect(state.wallRemaining).toBe(99);
    expect(state.gameResult).toBeNull();

    let turnCount = 0;
    const maxTurns = 200;

    // East's first turn: discard only (no draw)
    const eastId = getPlayerBySeat(state, "east");
    const firstTileId = getDiscardableTileId(state, eastId);
    const firstResult = handleAction(state, {
      type: "DISCARD_TILE",
      playerId: eastId,
      tileId: firstTileId,
    });
    expect(firstResult.accepted).toBe(true);
    // Close call window so next player can draw
    passAllPlayers(state);
    turnCount++;

    // Play through draw-discard-pass cycles
    while (state.gamePhase === "play" && turnCount < maxTurns) {
      const currentPlayer = state.currentTurn;

      // Draw
      const drawResult = handleAction(state, { type: "DRAW_TILE", playerId: currentPlayer });
      if (!drawResult.accepted) break;

      // Discard
      const discardTileId = getDiscardableTileId(state, currentPlayer);
      const discardResult = handleAction(state, {
        type: "DISCARD_TILE",
        playerId: currentPlayer,
        tileId: discardTileId,
      });
      expect(discardResult.accepted).toBe(true);

      // Close call window (all pass) — may trigger wall game if wall is empty
      if (state.callWindow) {
        passAllPlayers(state);
      }

      turnCount++;
    }

    // Game should have ended as wall game
    expect(state.gamePhase).toBe("scoreboard");
    expect(state.gameResult).toEqual({ winnerId: null, points: 0 });
    expect(state.wallRemaining).toBe(0);
    expect(state.wall.length).toBe(0);

    // All scores still 0
    for (const playerId of TEST_PLAYER_IDS) {
      expect(state.scores[playerId]).toBe(0);
    }

    expect(turnCount).toBeGreaterThan(50);
  });

  test("gameResult is null during active play", () => {
    const state = createPlayState();
    expect(state.gameResult).toBeNull();
  });
});
