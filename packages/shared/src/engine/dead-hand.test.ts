import { describe, expect, it } from "vite-plus/test";
import { createPlayState } from "../testing/fixtures";
import {
  enforceDeadHandIfInvalidExposedGroups,
  enforceDeadHandIfTileCountMismatch,
  expectedHandTileCount,
  shouldRunTileCountInvariant,
  totalHandTiles,
} from "./dead-hand";

describe("dead-hand helpers", () => {
  it("totalHandTiles sums rack and exposed tiles", () => {
    const state = createPlayState();
    const p = state.players[state.currentTurn];
    expect(totalHandTiles(p)).toBe(p.rack.length);
  });

  it("enforceDeadHandIfTileCountMismatch enforces when current player has wrong total in discard phase", () => {
    const state = createPlayState();
    const pid = state.currentTurn;
    state.turnPhase = "discard";
    const p = state.players[pid];
    p.rack.pop();
    expect(totalHandTiles(p)).not.toBe(14);

    const r = enforceDeadHandIfTileCountMismatch(state, pid);
    expect(r?.accepted).toBe(true);
    expect(r?.resolved).toMatchObject({
      type: "DEAD_HAND_ENFORCED",
      playerId: pid,
      reason: "TILE_COUNT_MISMATCH",
    });
    expect(p.deadHand).toBe(true);
  });

  it("enforceDeadHandIfTileCountMismatch skips when call window is open", () => {
    const state = createPlayState();
    const pid = state.currentTurn;
    state.turnPhase = "discard";
    state.players[pid].rack.pop();
    state.callWindow = {
      status: "open",
      discardedTile: state.players[pid].rack[0],
      discarderId: "other",
      passes: [],
      calls: [],
      openedAt: 0,
      confirmingPlayerId: null,
      confirmationExpiresAt: null,
      remainingCallers: [],
      winningCall: null,
    };

    expect(enforceDeadHandIfTileCountMismatch(state, pid)).toBeNull();
  });

  it("expectedHandTileCount is 13 on draw phase for current player", () => {
    const state = createPlayState();
    const pid = state.currentTurn;
    state.turnPhase = "draw";
    expect(expectedHandTileCount(state, pid)).toBe(13);
  });

  it("enforceDeadHandIfInvalidExposedGroups returns null when no exposures", () => {
    const state = createPlayState();
    const pid = state.currentTurn;
    expect(enforceDeadHandIfInvalidExposedGroups(state, pid)).toBeNull();
  });

  it("enforceDeadHandIfInvalidExposedGroups returns null when card is missing", () => {
    const state = createPlayState();
    state.card = null;
    const pid = state.currentTurn;
    const eg = state.players[pid].exposedGroups;
    eg.length = 0;
    eg.push({
      type: "pung",
      tiles: [],
      identity: { type: "pung", suit: "bam", value: 1 },
    });
    expect(enforceDeadHandIfInvalidExposedGroups(state, pid)).toBeNull();
  });

  it("shouldRunTileCountInvariant is false for non-current player", () => {
    const state = createPlayState();
    const ids = Object.keys(state.players);
    const other = ids.find((id) => id !== state.currentTurn)!;
    expect(shouldRunTileCountInvariant(state, other)).toBe(false);
  });
});
