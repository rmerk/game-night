import { describe, test, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { handlePassCall, closeCallWindow } from "./call-window";
import { handleDiscardTile } from "./discard";
import { handleDrawTile } from "./draw";
import { createPlayState } from "../../testing/fixtures";
import { getPlayerBySeat } from "../../testing/helpers";
import type { GameState } from "../../types/game-state";

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
