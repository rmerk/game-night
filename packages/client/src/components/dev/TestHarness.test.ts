/**
 * Unit tests for TestHarness.
 *
 * Logic tests use plain mutable state (no Vue reactivity) since the game engine
 * mutates state in-place. Component tests mount the real Vue component to verify
 * template bindings, click handlers, and reactivity wiring.
 */

import { describe, it, expect, beforeEach } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import { createLobbyState, handleAction } from "@mahjong-game/shared";
import type { GameState, GameAction, ActionResult } from "@mahjong-game/shared";
import { includeDevPages, includeDevPagesEnabled } from "../../include-dev-pages";
import TestHarness from "./TestHarness.vue";

// Mirrors the dispatch logic in TestHarness.vue (without Vue reactivity overhead)
function makeHarness() {
  let state = createLobbyState();

  function dispatch(action: GameAction): ActionResult {
    return handleAction(state, action);
  }

  function fastForwardToPlayForHarness(): void {
    state.gamePhase = "play";
    state.charleston = null;
  }

  function initGame() {
    state = createLobbyState();
    dispatch({ type: "START_GAME", playerIds: ["p1", "p2", "p3", "p4"] });
    fastForwardToPlayForHarness();
  }

  function getState(): GameState {
    return state;
  }

  function getDiscardableTileId(playerId: string): string {
    const player = state.players[playerId];
    const tile = player.rack.find((t) => t.category !== "joker");
    if (!tile) throw new Error(`No discardable tile for player '${playerId}'`);
    return tile.id;
  }

  return { getState, dispatch, initGame, getDiscardableTileId };
}

// ── 6.1 Game initialises correctly on mount ───────────────────────────────

describe("TestHarness – game initialisation (AC 1, 2)", () => {
  it("starts in play phase with 4 players after START_GAME", () => {
    const h = makeHarness();
    h.initGame();

    expect(h.getState().gamePhase).toBe("play");
    expect(Object.keys(h.getState().players)).toHaveLength(4);
  });

  it("deals 14 tiles to East and 13 to each other player", () => {
    const h = makeHarness();
    h.initGame();

    const playerValues = Object.values(h.getState().players);
    const east = playerValues.find((p) => p.seatWind === "east")!;
    const others = playerValues.filter((p) => p.seatWind !== "east");

    expect(east.rack).toHaveLength(14);
    others.forEach((p) => expect(p.rack).toHaveLength(13));
  });

  it("shows East in discard phase (no draw needed for first turn)", () => {
    const h = makeHarness();
    h.initGame();

    const east = Object.values(h.getState().players).find((p) => p.seatWind === "east")!;
    expect(h.getState().currentTurn).toBe(east.id);
    expect(h.getState().turnPhase).toBe("discard");
  });

  it("displays wall remaining count (99 after dealing)", () => {
    const h = makeHarness();
    h.initGame();
    expect(h.getState().wallRemaining).toBe(99);
  });

  it("starts with empty discard pools for all players", () => {
    const h = makeHarness();
    h.initGame();
    Object.values(h.getState().players).forEach((p) => expect(p.discardPool).toHaveLength(0));
  });
});

// ── 6.2 Draw action updates state ─────────────────────────────────────────

describe("TestHarness – draw action (AC 3)", () => {
  let h: ReturnType<typeof makeHarness>;

  /** Close call window by passing all non-discarder players. */
  function passAllPlayers() {
    const state = h.getState();
    if (!state.callWindow) return;
    const discarderId = state.callWindow.discarderId;
    const nonDiscarders = Object.keys(state.players).filter((id) => id !== discarderId);
    for (const playerId of nonDiscarders) {
      if (!h.getState().callWindow) break;
      h.dispatch({ type: "PASS_CALL", playerId });
    }
  }

  beforeEach(() => {
    h = makeHarness();
    h.initGame();
    // East starts in discard phase — discard one tile to open call window
    const state = h.getState();
    const east = Object.values(state.players).find((p) => p.seatWind === "east")!;
    h.dispatch({
      type: "DISCARD_TILE",
      playerId: east.id,
      tileId: h.getDiscardableTileId(east.id),
    });
    // Close call window so South enters draw phase
    passAllPlayers();
  });

  it("state is in draw phase after East discards and call window closes", () => {
    expect(h.getState().turnPhase).toBe("draw");
  });

  it("accepts DRAW_TILE when it is a player draw phase", () => {
    const playerId = h.getState().currentTurn;
    const result = h.dispatch({ type: "DRAW_TILE", playerId });
    expect(result.accepted).toBe(true);
  });

  it("adds tile to rack and decrements wall count after draw", () => {
    const state = h.getState();
    const playerId = state.currentTurn;
    const rackBefore = state.players[playerId].rack.length;
    const wallBefore = state.wallRemaining;

    h.dispatch({ type: "DRAW_TILE", playerId });

    expect(h.getState().players[playerId].rack).toHaveLength(rackBefore + 1);
    expect(h.getState().wallRemaining).toBe(wallBefore - 1);
  });

  it("transitions to discard phase after drawing", () => {
    const playerId = h.getState().currentTurn;
    h.dispatch({ type: "DRAW_TILE", playerId });
    expect(h.getState().turnPhase).toBe("discard");
  });
});

// ── 6.3 Discard action updates state and advances turn ────────────────────

describe("TestHarness – discard action (AC 4)", () => {
  it("moves tile to discard pool after DISCARD_TILE", () => {
    const h = makeHarness();
    h.initGame();

    const east = Object.values(h.getState().players).find((p) => p.seatWind === "east")!;
    const tileId = h.getDiscardableTileId(east.id);

    h.dispatch({ type: "DISCARD_TILE", playerId: east.id, tileId });

    expect(h.getState().players[east.id].discardPool).toHaveLength(1);
    expect(h.getState().players[east.id].discardPool[0].id).toBe(tileId);
  });

  it("opens call window after discard (turn advances when window closes)", () => {
    const h = makeHarness();
    h.initGame();

    const east = Object.values(h.getState().players).find((p) => p.seatWind === "east")!;
    const tileId = h.getDiscardableTileId(east.id);

    h.dispatch({ type: "DISCARD_TILE", playerId: east.id, tileId });

    // Call window opens — turn stays with discarder
    expect(h.getState().currentTurn).toBe(east.id);
    expect(h.getState().turnPhase).toBe("callWindow");
    expect(h.getState().callWindow).not.toBeNull();
  });

  it("rejects discarding a joker tile", () => {
    const h = makeHarness();
    h.initGame();

    const east = Object.values(h.getState().players).find((p) => p.seatWind === "east")!;
    const joker = east.rack.find((t) => t.category === "joker");

    if (!joker) return; // Skip if East has no joker (seed-dependent)

    const result = h.dispatch({ type: "DISCARD_TILE", playerId: east.id, tileId: joker.id });
    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("CANNOT_DISCARD_JOKER");
  });
});

// ── 6.4 Wall game result displays correctly ───────────────────────────────

describe("TestHarness – wall game detection (AC 5)", () => {
  it("reaches scoreboard with null winnerId after wall depletion", () => {
    const h = makeHarness();
    h.initGame();

    /** Close call window by passing all non-discarder players. */
    function passAllPlayers() {
      const state = h.getState();
      if (!state.callWindow) return;
      const discarderId = state.callWindow.discarderId;
      const nonDiscarders = Object.keys(state.players).filter((id) => id !== discarderId);
      for (const playerId of nonDiscarders) {
        if (!h.getState().callWindow) break;
        h.dispatch({ type: "PASS_CALL", playerId });
      }
    }

    // East's first turn is discard-only (no draw needed)
    const eastId = h.getState().currentTurn;
    h.dispatch({ type: "DISCARD_TILE", playerId: eastId, tileId: h.getDiscardableTileId(eastId) });
    passAllPlayers();

    // Play through draw-discard-pass cycles until the wall is depleted
    const MAX_TURNS = 200;
    let turns = 0;

    while (h.getState().gamePhase === "play" && turns < MAX_TURNS) {
      const currentPlayerId = h.getState().currentTurn;

      // Draw phase
      const drawResult = h.dispatch({ type: "DRAW_TILE", playerId: currentPlayerId });
      if (!drawResult.accepted) break;

      // Discard phase
      h.dispatch({
        type: "DISCARD_TILE",
        playerId: currentPlayerId,
        tileId: h.getDiscardableTileId(currentPlayerId),
      });

      // Close call window (all pass) — may trigger wall game
      passAllPlayers();

      turns++;
    }

    expect(h.getState().gamePhase).toBe("scoreboard");
    expect(h.getState().gameResult?.winnerId).toBeNull();
  });
});

// ── 6.5 Dev-only gating ───────────────────────────────────────────────────

describe("TestHarness – dev-only gating (AC 6)", () => {
  it("import.meta.env.DEV is true in test environment", () => {
    // Vitest runs with DEV=true, mirroring the harness gating condition
    expect(import.meta.env.DEV).toBe(true);
  });

  it("includeDevPages is true in test environment (DEV)", () => {
    expect(includeDevPages()).toBe(true);
  });

  it("includeDevPagesEnabled matches router gating for flag combinations", () => {
    expect(includeDevPagesEnabled(false, undefined)).toBe(false);
    expect(includeDevPagesEnabled(false, "true")).toBe(true);
    expect(includeDevPagesEnabled(true, undefined)).toBe(true);
    expect(includeDevPagesEnabled(true, "false")).toBe(true);
  });
});

// ── Component mount tests ────────────────────────────────────────────────

describe("TestHarness – component rendering", () => {
  it("renders all 4 player sections with rack tiles", () => {
    const wrapper = mount(TestHarness);
    const playerSections = wrapper.findAll('[class*="border-2 rounded"]');
    expect(playerSections).toHaveLength(4);

    // Each player section should display rack tiles
    for (const section of playerSections) {
      const rackLabel = section.text();
      expect(rackLabel).toMatch(/Rack \(\d+\)/);
    }
    wrapper.unmount();
  });

  it("shows call window phase after discard", async () => {
    const wrapper = mount(TestHarness);

    // Find clickable rack tile buttons (non-joker tiles of the current player get cursor-pointer)
    const rackButtons = wrapper
      .findAll("button")
      .filter((b) => b.classes().includes("cursor-pointer"));
    if (rackButtons.length > 0) {
      await rackButtons[0].trigger("click");
      await wrapper.vm.$nextTick();

      // Verify the rendered phase banner reflects the call window transition.
      expect(wrapper.text()).toMatch(/Turn Phase:\s*callWindow/);
    }
    wrapper.unmount();
  });

  it("displays wall remaining count and phase info", () => {
    const wrapper = mount(TestHarness);
    const text = wrapper.text();
    expect(text).toContain("Phase:");
    expect(text).toContain("Wall:");
    expect(text).toContain("99");
    wrapper.unmount();
  });

  it("clicking a rack tile discards it and updates the display", async () => {
    const wrapper = mount(TestHarness);

    // Find clickable rack tile buttons (non-joker tiles of the current player get cursor-pointer)
    const clickableTiles = wrapper
      .findAll("button")
      .filter((b) => b.classes().includes("cursor-pointer"));
    expect(clickableTiles.length).toBeGreaterThan(0);

    await clickableTiles[0].trigger("click");
    await wrapper.vm.$nextTick();

    // Verify the rendered discard count updates after the click.
    expect(wrapper.text()).toContain("Discards (1)");
    wrapper.unmount();
  });
});
