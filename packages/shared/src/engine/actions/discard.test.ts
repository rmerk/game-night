import { describe, test, expect } from "vite-plus/test";
import { handleDiscardTile } from "./discard";
import { createPlayState } from "../../testing/fixtures";
import { getPlayerBySeat } from "../../testing/helpers";
import { jokerTile } from "../../testing/tile-builders";
import type { DiscardTileAction } from "../../types/actions";
import type { GameState } from "../../types/game-state";

function makeDiscardAction(playerId: string, tileId: string): DiscardTileAction {
  return { type: "DISCARD_TILE", playerId, tileId };
}

function getDiscardableTile(state: GameState, playerId: string) {
  const tile = state.players[playerId].rack.find((t) => t.category !== "joker");
  if (!tile) throw new Error(`No discardable tile in rack for player '${playerId}'`);
  return tile;
}

describe("handleDiscardTile", () => {
  test("successful discard removes tile from rack, adds to discardPool, opens call window", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    // East starts in 'discard' phase with 14 tiles
    expect(state.currentTurn).toBe(eastId);
    expect(state.turnPhase).toBe("discard");

    const tileToDiscard = getDiscardableTile(state, eastId);
    const rackBefore = state.players[eastId].rack.length;
    const discardPoolBefore = state.players[eastId].discardPool.length;

    const result = handleDiscardTile(state, makeDiscardAction(eastId, tileToDiscard.id));

    expect(result.accepted).toBe(true);
    expect(state.players[eastId].rack.length).toBe(rackBefore - 1);
    expect(state.players[eastId].rack.find((t) => t.id === tileToDiscard.id)).toBeUndefined();
    expect(state.players[eastId].discardPool.length).toBe(discardPoolBefore + 1);
    expect(state.players[eastId].discardPool).toContain(tileToDiscard);
    // Call window opens — turn does NOT advance yet
    expect(state.currentTurn).toBe(eastId);
    expect(state.turnPhase).toBe("callWindow");
    expect(state.callWindow).not.toBeNull();
  });

  test("successful discard returns accepted with DISCARD_TILE resolved action", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const tileToDiscard = getDiscardableTile(state, eastId);

    const result = handleDiscardTile(state, makeDiscardAction(eastId, tileToDiscard.id));

    expect(result).toEqual({
      accepted: true,
      resolved: { type: "DISCARD_TILE", playerId: eastId, tileId: tileToDiscard.id },
    });
  });

  test("rejects NOT_YOUR_TURN when wrong player discards", () => {
    const state = createPlayState();
    const southId = getPlayerBySeat(state, "south");
    const tile = state.players[southId].rack[0];

    const result = handleDiscardTile(state, makeDiscardAction(southId, tile.id));

    expect(result).toEqual({ accepted: false, reason: "NOT_YOUR_TURN" });
  });

  test("rejects TILE_NOT_IN_RACK when tile not found", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    const result = handleDiscardTile(state, makeDiscardAction(eastId, "nonexistent-tile-99"));

    expect(result).toEqual({ accepted: false, reason: "TILE_NOT_IN_RACK" });
  });

  test("rejects CANNOT_DISCARD_JOKER when discarding a Joker tile (FR51)", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    // Insert a Joker into East's rack
    const joker = jokerTile(1);
    state.players[eastId].rack.push(joker);

    const result = handleDiscardTile(state, makeDiscardAction(eastId, joker.id));

    expect(result).toEqual({ accepted: false, reason: "CANNOT_DISCARD_JOKER" });
  });

  test("East's first turn — turnPhase starts as discard, discard succeeds without prior draw (FR14)", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    // Verify initial state: East has 14 tiles, turnPhase is 'discard'
    expect(state.currentTurn).toBe(eastId);
    expect(state.turnPhase).toBe("discard");
    expect(state.players[eastId].rack.length).toBe(14);

    const tile = getDiscardableTile(state, eastId);
    const result = handleDiscardTile(state, makeDiscardAction(eastId, tile.id));

    expect(result.accepted).toBe(true);
    expect(state.players[eastId].rack.length).toBe(13);
  });

  test("rejects MUST_DRAW_FIRST when turnPhase is 'draw' (non-East, mid-game)", () => {
    const state = createPlayState();
    const southId = getPlayerBySeat(state, "south");
    state.currentTurn = southId;
    state.turnPhase = "draw";

    const tile = state.players[southId].rack[0];
    const result = handleDiscardTile(state, makeDiscardAction(southId, tile.id));

    expect(result).toEqual({ accepted: false, reason: "MUST_DRAW_FIRST" });
  });

  test("rejects WRONG_PHASE when gamePhase is not play", () => {
    const state = createPlayState();
    state.gamePhase = "lobby";
    const eastId = getPlayerBySeat(state, "east");
    const tile = state.players[eastId].rack[0];

    const result = handleDiscardTile(state, makeDiscardAction(eastId, tile.id));

    expect(result).toEqual({ accepted: false, reason: "WRONG_PHASE" });
  });

  test("state completely unchanged on any rejected action", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const southId = getPlayerBySeat(state, "south");

    // Snapshot state before rejected action
    const eastRackBefore = [...state.players[eastId].rack];
    const southRackBefore = [...state.players[southId].rack];
    const eastDiscardBefore = [...state.players[eastId].discardPool];
    const currentTurnBefore = state.currentTurn;
    const turnPhaseBefore = state.turnPhase;
    const lastDiscardBefore = state.lastDiscard;
    const wallRemainingBefore = state.wallRemaining;

    // Wrong player tries to discard
    const tile = state.players[southId].rack[0];
    handleDiscardTile(state, makeDiscardAction(southId, tile.id));

    expect(state.players[eastId].rack).toEqual(eastRackBefore);
    expect(state.players[southId].rack).toEqual(southRackBefore);
    expect(state.players[eastId].discardPool).toEqual(eastDiscardBefore);
    expect(state.currentTurn).toBe(currentTurnBefore);
    expect(state.turnPhase).toBe(turnPhaseBefore);
    expect(state.lastDiscard).toBe(lastDiscardBefore);
    expect(state.wallRemaining).toBe(wallRemainingBefore);
  });

  test("lastDiscard is set correctly after successful discard", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");
    const tile = state.players[eastId].rack[0];

    expect(state.lastDiscard).toBeNull();

    handleDiscardTile(state, makeDiscardAction(eastId, tile.id));

    expect(state.lastDiscard).toEqual({ tile, discarderId: eastId });
  });

  test("discard opens call window instead of advancing turn (turn advances on call window close)", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    // East discards — call window opens, turn stays with East
    const tile = getDiscardableTile(state, eastId);
    handleDiscardTile(state, makeDiscardAction(eastId, tile.id));

    expect(state.currentTurn).toBe(eastId);
    expect(state.turnPhase).toBe("callWindow");
    expect(state.callWindow).not.toBeNull();
    expect(state.callWindow!.discarderId).toBe(eastId);
    expect(state.callWindow!.discardedTile).toBe(tile);
    expect(state.callWindow!.status).toBe("open");
    expect(state.callWindow!.passes).toEqual([eastId]);
  });

  test("discarding a regular tile while holding Jokers succeeds", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    // Insert a Joker into East's rack
    const joker = jokerTile(1);
    state.players[eastId].rack.push(joker);

    // Discard a non-Joker tile — should succeed even though rack contains a Joker
    const regularTile = getDiscardableTile(state, eastId);

    const result = handleDiscardTile(state, makeDiscardAction(eastId, regularTile.id));

    expect(result.accepted).toBe(true);
    // Joker should still be in rack
    expect(state.players[eastId].rack.find((t) => t.id === joker.id)).toBeDefined();
  });
});
