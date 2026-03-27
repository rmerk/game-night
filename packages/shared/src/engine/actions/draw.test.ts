import { describe, test, expect } from "vite-plus/test";
import { handleDrawTile, advanceTurn } from "./draw";
import { createPlayState } from "../../testing/fixtures";
import { getPlayerBySeat } from "../../testing/helpers";
import type { GameState } from "../../types/game-state";
import type { DrawTileAction } from "../../types/actions";
import { SEATS } from "../../constants";

function makeDrawAction(playerId: string): DrawTileAction {
  return { type: "DRAW_TILE", playerId };
}

function getEastPlayerId(state: GameState): string {
  return getPlayerBySeat(state, "east");
}

describe("handleDrawTile", () => {
  test("successful draw removes tile from wall, adds to rack, decrements wallRemaining", () => {
    const state = createPlayState();
    // East starts in 'discard' phase (14 tiles). Move to next player who is in 'draw' phase.
    // We need to set up a state where it's a non-East player's turn in 'draw' phase.
    const southId = getPlayerBySeat(state, "south");
    state.currentTurn = southId;
    state.turnPhase = "draw";

    const wallBefore = state.wall.length;
    const rackBefore = state.players[southId].rack.length;
    const topTile = state.wall[0];

    const result = handleDrawTile(state, makeDrawAction(southId));

    expect(result.accepted).toBe(true);
    expect(state.wall.length).toBe(wallBefore - 1);
    expect(state.players[southId].rack.length).toBe(rackBefore + 1);
    expect(state.players[southId].rack).toContain(topTile);
    expect(state.wallRemaining).toBe(wallBefore - 1);
  });

  test("successful draw returns accepted with DRAW_TILE resolved action", () => {
    const state = createPlayState();
    const southId = getPlayerBySeat(state, "south");
    state.currentTurn = southId;
    state.turnPhase = "draw";

    const result = handleDrawTile(state, makeDrawAction(southId));

    expect(result).toEqual({
      accepted: true,
      resolved: { type: "DRAW_TILE", playerId: southId },
    });
  });

  test("rejects NOT_YOUR_TURN when wrong player draws", () => {
    const state = createPlayState();
    const southId = getPlayerBySeat(state, "south");
    const westId = getPlayerBySeat(state, "west");
    state.currentTurn = southId;
    state.turnPhase = "draw";

    const result = handleDrawTile(state, makeDrawAction(westId));

    expect(result).toEqual({ accepted: false, reason: "NOT_YOUR_TURN" });
  });

  test("rejects ALREADY_DRAWN when turnPhase is discard", () => {
    const state = createPlayState();
    const southId = getPlayerBySeat(state, "south");
    state.currentTurn = southId;
    state.turnPhase = "discard";

    const result = handleDrawTile(state, makeDrawAction(southId));

    expect(result).toEqual({ accepted: false, reason: "ALREADY_DRAWN" });
  });

  test("East first turn — turnPhase starts as discard, DRAW_TILE rejected with ALREADY_DRAWN", () => {
    const state = createPlayState();
    const eastId = getEastPlayerId(state);

    // createPlayState sets currentTurn to East and turnPhase to 'discard'
    expect(state.currentTurn).toBe(eastId);
    expect(state.turnPhase).toBe("discard");

    const result = handleDrawTile(state, makeDrawAction(eastId));

    expect(result).toEqual({ accepted: false, reason: "ALREADY_DRAWN" });
  });

  test("after draw, turnPhase transitions to discard", () => {
    const state = createPlayState();
    const southId = getPlayerBySeat(state, "south");
    state.currentTurn = southId;
    state.turnPhase = "draw";

    handleDrawTile(state, makeDrawAction(southId));

    expect(state.turnPhase).toBe("discard");
  });

  test("state unchanged on rejected action (no partial mutations)", () => {
    const state = createPlayState();
    const southId = getPlayerBySeat(state, "south");
    state.currentTurn = southId;
    state.turnPhase = "draw";

    // Capture state snapshot before rejected action
    const wallBefore = [...state.wall];
    const rackBefore = [...state.players[southId].rack];
    const wallRemainingBefore = state.wallRemaining;
    const turnPhaseBefore = state.turnPhase;

    // Wrong player tries to draw
    const westId = getPlayerBySeat(state, "west");
    const westRackBefore = [...state.players[westId].rack];
    handleDrawTile(state, makeDrawAction(westId));

    expect(state.wall).toEqual(wallBefore);
    expect(state.players[southId].rack).toEqual(rackBefore);
    expect(state.players[westId].rack).toEqual(westRackBefore);
    expect(state.wallRemaining).toBe(wallRemainingBefore);
    expect(state.turnPhase).toBe(turnPhaseBefore);
  });

  test("rejects if gamePhase is not play", () => {
    const state = createPlayState();
    state.gamePhase = "lobby";
    const southId = getPlayerBySeat(state, "south");
    state.currentTurn = southId;
    state.turnPhase = "draw";

    const result = handleDrawTile(state, makeDrawAction(southId));

    expect(result).toEqual({ accepted: false, reason: "WRONG_PHASE" });
  });

  test("rejects WALL_EMPTY when wall has no tiles", () => {
    const state = createPlayState();
    const southId = getPlayerBySeat(state, "south");
    state.currentTurn = southId;
    state.turnPhase = "draw";
    state.wall = [];
    state.wallRemaining = 0;

    const rackLengthBefore = state.players[southId].rack.length;
    const result = handleDrawTile(state, makeDrawAction(southId));

    expect(result).toEqual({ accepted: false, reason: "WALL_EMPTY" });
    expect(state.players[southId].rack.length).toBe(rackLengthBefore);
  });
});

describe("advanceTurn", () => {
  test("cycles through east→south→west→north→east", () => {
    const state = createPlayState();

    const seatOrder: string[] = [];
    for (const seat of SEATS) {
      const playerId = getPlayerBySeat(state, seat);
      state.currentTurn = playerId;
      state.turnPhase = "discard";
      advanceTurn(state);
      // After advancing, find which seat the new currentTurn has
      const nextPlayer = state.players[state.currentTurn];
      seatOrder.push(nextPlayer.seatWind);
    }

    // east→south, south→west, west→north, north→east
    expect(seatOrder).toEqual(["south", "west", "north", "east"]);
  });

  test("resets turnPhase to draw after advancing", () => {
    const state = createPlayState();
    const eastId = getEastPlayerId(state);
    state.currentTurn = eastId;
    state.turnPhase = "discard";

    advanceTurn(state);

    expect(state.turnPhase).toBe("draw");
  });
});
