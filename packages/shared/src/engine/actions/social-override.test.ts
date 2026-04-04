import { describe, expect, test } from "vite-plus/test";
import { createPlayState } from "../../testing/fixtures";
import { handleDiscardTile } from "./discard";
import { handlePassCall } from "./call-window";
import {
  handleSocialOverrideRequest,
  handleSocialOverrideVote,
  handleSocialOverrideTimeout,
} from "./social-override";
import { getPlayerBySeat } from "../../testing/helpers";

function eastId(state: ReturnType<typeof createPlayState>) {
  return getPlayerBySeat(state, "east");
}

describe("social override (discard undo)", () => {
  test("happy path: request then 3 approves restores discard phase", () => {
    const state = createPlayState();
    const east = eastId(state);
    expect(state.turnPhase).toBe("discard");
    const tile = state.players[east].rack.find((t) => t.category !== "joker");
    expect(tile).toBeDefined();
    expect(
      handleDiscardTile(state, { type: "DISCARD_TILE", playerId: east, tileId: tile!.id }).accepted,
    ).toBe(true);
    expect(state.turnPhase).toBe("callWindow");

    const req = handleSocialOverrideRequest(state, {
      type: "SOCIAL_OVERRIDE_REQUEST",
      playerId: east,
      description: "oops wrong tile",
    });
    expect(req.accepted).toBe(true);
    expect(state.socialOverrideState).not.toBeNull();

    const others = Object.keys(state.players).filter((id) => id !== east);
    expect(others).toHaveLength(3);

    for (const pid of others) {
      const vr = handleSocialOverrideVote(state, {
        type: "SOCIAL_OVERRIDE_VOTE",
        playerId: pid,
        approve: true,
      });
      expect(vr.accepted).toBe(true);
    }

    expect(state.socialOverrideState).toBeNull();
    expect(state.turnPhase).toBe("discard");
    expect(state.callWindow).toBeNull();
    expect(state.lastDiscard).toBeNull();
    expect(state.currentTurn).toBe(east);
    expect(state.players[east].rack.some((t) => t.id === tile!.id)).toBe(true);
  });

  test("any deny rejects and leaves call window intact", () => {
    const state = createPlayState();
    const east = eastId(state);
    const tile = state.players[east].rack.find((t) => t.category !== "joker")!;
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: east, tileId: tile.id });
    handleSocialOverrideRequest(state, {
      type: "SOCIAL_OVERRIDE_REQUEST",
      playerId: east,
      description: "oops",
    });
    const other = Object.keys(state.players).find((id) => id !== east)!;
    const r = handleSocialOverrideVote(state, {
      type: "SOCIAL_OVERRIDE_VOTE",
      playerId: other,
      approve: false,
    });
    expect(r.accepted).toBe(true);
    expect(state.socialOverrideState).toBeNull();
    expect(state.turnPhase).toBe("callWindow");
    expect(state.callWindow).not.toBeNull();
  });

  test("PASS_CALL blocked while override pending", () => {
    const state = createPlayState();
    const east = eastId(state);
    const tile = state.players[east].rack.find((t) => t.category !== "joker")!;
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: east, tileId: tile.id });
    handleSocialOverrideRequest(state, {
      type: "SOCIAL_OVERRIDE_REQUEST",
      playerId: east,
      description: "oops",
    });
    const south = getPlayerBySeat(state, "south");
    const pr = handlePassCall(state, { type: "PASS_CALL", playerId: south });
    expect(pr.accepted).toBe(false);
    expect(pr.reason).toBe("SOCIAL_OVERRIDE_PENDING");
  });

  test("dead hand cannot request", () => {
    const state = createPlayState();
    const east = eastId(state);
    state.players[east].deadHand = true;
    const tile = state.players[east].rack.find((t) => t.category !== "joker")!;
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: east, tileId: tile.id });
    const r = handleSocialOverrideRequest(state, {
      type: "SOCIAL_OVERRIDE_REQUEST",
      playerId: east,
      description: "oops",
    });
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe("DEAD_HAND_CANNOT_REQUEST");
  });

  test("timeout clears pending vote", () => {
    const state = createPlayState();
    const east = eastId(state);
    const tile = state.players[east].rack.find((t) => t.category !== "joker")!;
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: east, tileId: tile.id });
    handleSocialOverrideRequest(state, {
      type: "SOCIAL_OVERRIDE_REQUEST",
      playerId: east,
      description: "oops",
    });
    const tr = handleSocialOverrideTimeout(state);
    expect(tr.accepted).toBe(true);
    expect(state.socialOverrideState).toBeNull();
  });

  test("host audit log records request", () => {
    const state = createPlayState();
    const east = eastId(state);
    const tile = state.players[east].rack.find((t) => t.category !== "joker")!;
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: east, tileId: tile.id });
    handleSocialOverrideRequest(state, {
      type: "SOCIAL_OVERRIDE_REQUEST",
      playerId: east,
      description: "oops",
    });
    expect(state.hostAuditLog.length).toBeGreaterThan(0);
    expect(state.hostAuditLog[0]).toContain("Social Override");
  });
});
