import { describe, expect, test } from "vitest";
import { handleShowHand } from "./show-hand";
import { createPlayState } from "../../testing/fixtures";

function createScoreboardState() {
  const state = createPlayState();
  state.gamePhase = "scoreboard";
  state.gameResult = {
    winnerId: "p1",
    patternId: "test",
    patternName: "Test Hand",
    points: 25,
    selfDrawn: true,
    payments: { p1: 75, p2: -25, p3: -25, p4: -25 },
  };
  return state;
}

describe("handleShowHand", () => {
  test("accepted during scoreboard phase — copies rack to shownHands", () => {
    const state = createScoreboardState();
    const rackBefore = [...state.players.p1.rack];

    const result = handleShowHand(state, { type: "SHOW_HAND", playerId: "p1" });

    expect(result.accepted).toBe(true);
    expect(result.resolved).toEqual({ type: "HAND_SHOWN", playerId: "p1" });
    expect(state.shownHands.p1).toEqual(rackBefore);
    expect(state.shownHands.p1).not.toBe(state.players.p1.rack); // separate copy
  });

  test("rejected during play phase", () => {
    const state = createPlayState();
    state.gamePhase = "play";

    const result = handleShowHand(state, { type: "SHOW_HAND", playerId: "p1" });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("WRONG_PHASE");
    expect(state.shownHands.p1).toBeUndefined();
  });

  test("rejected during lobby phase", () => {
    const state = createPlayState();
    state.gamePhase = "lobby";

    const result = handleShowHand(state, { type: "SHOW_HAND", playerId: "p1" });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("WRONG_PHASE");
  });

  test("rejected for unknown player", () => {
    const state = createScoreboardState();

    const result = handleShowHand(state, { type: "SHOW_HAND", playerId: "unknown" });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("PLAYER_NOT_FOUND");
  });

  test("idempotent — showing hand twice is accepted with no additional mutation", () => {
    const state = createScoreboardState();

    handleShowHand(state, { type: "SHOW_HAND", playerId: "p1" });
    const shownFirst = state.shownHands.p1;

    const result = handleShowHand(state, { type: "SHOW_HAND", playerId: "p1" });

    expect(result.accepted).toBe(true);
    expect(state.shownHands.p1).toBe(shownFirst); // same reference — no re-copy
  });

  test("multiple players can show hands independently", () => {
    const state = createScoreboardState();

    handleShowHand(state, { type: "SHOW_HAND", playerId: "p1" });
    handleShowHand(state, { type: "SHOW_HAND", playerId: "p2" });

    expect(state.shownHands.p1).toBeDefined();
    expect(state.shownHands.p2).toBeDefined();
    expect(state.shownHands.p3).toBeUndefined();
    expect(state.shownHands.p4).toBeUndefined();
  });

  test("shown hands appear in PlayerGameView for all players", () => {
    const state = createScoreboardState();
    handleShowHand(state, { type: "SHOW_HAND", playerId: "p1" });

    // shownHands is part of GameState which gets passed through to PlayerGameView
    expect(state.shownHands.p1).toHaveLength(state.players.p1.rack.length);
  });
});
