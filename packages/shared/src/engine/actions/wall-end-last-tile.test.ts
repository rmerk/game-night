/**
 * Story 3C.6 — Wall end & last tile rules (FR102, FR103).
 * NMJL acceptance verification: engine behavior when the wall has one tile left
 * or is empty after the last discard.
 */
import { describe, test, expect, vi } from "vite-plus/test";
import { handleDeclareMahjong } from "./mahjong";
import {
  handleCallAction,
  handleCallMahjong,
  handleConfirmCall,
  handlePassCall,
  resolveCallWindow,
  closeCallWindow,
  getValidCallOptions,
} from "./call-window";
import { handleDiscardTile } from "./discard";
import { handleDrawTile } from "./draw";
import { createPlayState } from "../../testing/fixtures";
import { getPlayerBySeat, injectTilesIntoRack } from "../../testing/helpers";
import { buildTilesForHand } from "../../testing/tile-builders";
import { loadCard } from "../../card/card-loader";
import type { GameState } from "../../types/game-state";
import type { Tile } from "../../types/tiles";

const card = loadCard("2026");

function isMahjongGameResult(
  gr: GameState["gameResult"],
): gr is NonNullable<GameState["gameResult"]> & { winnerId: string; selfDrawn: boolean } {
  return gr !== null && gr.winnerId !== null && "selfDrawn" in gr;
}

/** Drain wall to exactly `remaining` tiles. Keeps wallRemaining in sync. */
function drainWallTo(state: GameState, remaining: number): void {
  if (remaining < 0 || remaining > state.wall.length) {
    throw new Error(`Cannot drain wall to ${remaining} (current: ${state.wall.length})`);
  }
  state.wall.splice(0, state.wall.length - remaining);
  state.wallRemaining = state.wall.length;
}

function getDiscardableTileId(state: GameState, playerId: string): string {
  const player = state.players[playerId];
  const tile = player.rack.find((t) => t.category !== "joker");
  if (!tile) throw new Error("No discardable tile in rack");
  return tile.id;
}

function passAllPlayers(state: GameState): void {
  if (!state.callWindow) throw new Error("No call window to pass");
  const discarderId = state.callWindow.discarderId;
  const nonDiscarders = Object.keys(state.players).filter((id) => id !== discarderId);
  for (const playerId of nonDiscarders) {
    if (!state.callWindow) break;
    handlePassCall(state, { type: "PASS_CALL", playerId });
  }
}

/**
 * Set up state for South drawing with exactly `wallRemaining` tiles left before the draw.
 */
function setupForLastDraw(state: GameState, wallRemaining: number): { drawerId: string } {
  const eastId = getPlayerBySeat(state, "east");
  const southId = getPlayerBySeat(state, "south");

  const eastTileId = getDiscardableTileId(state, eastId);
  handleDiscardTile(state, { type: "DISCARD_TILE", playerId: eastId, tileId: eastTileId });

  passAllPlayers(state);

  expect(state.currentTurn).toBe(southId);
  expect(state.turnPhase).toBe("draw");

  drainWallTo(state, wallRemaining);

  return { drawerId: southId };
}

/**
 * Like setupForLastDraw(1), but moves two Jokers from the wall into West's rack first so
 * West can always Pung the last discard (Jokers substitute) after the wall is empty.
 */
function setupForLastDrawWithWestJokerPung(state: GameState): {
  drawerId: string;
  westId: string;
  jokerTileIds: [string, string];
} {
  const eastId = getPlayerBySeat(state, "east");
  const southId = getPlayerBySeat(state, "south");
  const westId = getPlayerBySeat(state, "west");

  const eastTileId = getDiscardableTileId(state, eastId);
  handleDiscardTile(state, { type: "DISCARD_TILE", playerId: eastId, tileId: eastTileId });
  passAllPlayers(state);

  drainWallTo(state, 24);
  const jokers = state.wall.filter((t) => t.category === "joker").slice(0, 2);
  expect(jokers.length).toBe(2);
  injectTilesIntoRack(state, westId, jokers);
  drainWallTo(state, 1);

  expect(state.currentTurn).toBe(southId);
  expect(state.turnPhase).toBe("draw");

  return { drawerId: southId, westId, jokerTileIds: [jokers[0].id, jokers[1].id] };
}

function buildValidHandEv2(): Tile[] {
  return buildTilesForHand(card, "ev-2", { A: "bam", B: "crak", C: "dot" });
}

/**
 * East can win on ev-3 when South draws the last wall tile and discards the missing tile.
 * Uses the same per-tile move pattern as AC4 (do not bulk-remove fullHand first — tiles must stay in play).
 */
function setupEastMahjongOnSouthLastDiscard(state: GameState): { eastId: string; southId: string } {
  const eastId = getPlayerBySeat(state, "east");
  const southId = getPlayerBySeat(state, "south");

  const { drawerId } = setupForLastDraw(state, 1);
  if (drawerId !== southId) throw new Error("expected South as drawer");

  const fullHand = buildTilesForHand(card, "ev-3", { A: "bam", B: "crak", C: "dot" });
  const missingTile = fullHand[0];
  const eastRackTiles = fullHand.slice(1);
  const fullHandIds = new Set(fullHand.map((t) => t.id));

  // Last wall tile is the missing piece for ev-3
  state.wall.splice(0, state.wall.length, missingTile);
  state.wallRemaining = 1;

  // East: 13 tiles from ev-3 (same move pattern as mahjong.test / AC4)
  state.players[eastId].rack.length = 0;
  for (const tile of eastRackTiles) {
    for (const p of Object.values(state.players)) {
      if (p.id === eastId) continue;
      const idx = p.rack.findIndex((t) => t.id === tile.id);
      if (idx >= 0) p.rack.splice(idx, 1);
    }
    const wallIdx = state.wall.findIndex((t) => t.id === tile.id);
    if (wallIdx >= 0) state.wall.splice(wallIdx, 1);
    state.players[eastId].rack.push(tile);
  }
  if (state.players[eastId].rack.length !== 13) {
    throw new Error(`East rack expected 13 tiles, got ${state.players[eastId].rack.length}`);
  }

  state.wall.splice(0, state.wall.length, missingTile);
  state.wallRemaining = 1;

  // South: 13 tiles not part of ev-3 (so South draws missing tile to 14, then discards it)
  state.players[southId].rack.length = 0;
  let moved = 0;
  for (const p of Object.values(state.players)) {
    if (p.id === southId || p.id === eastId) continue;
    while (moved < 13 && p.rack.length > 0) {
      const idx = p.rack.findIndex((t) => !fullHandIds.has(t.id));
      if (idx < 0) break;
      const [t] = p.rack.splice(idx, 1);
      state.players[southId].rack.push(t);
      moved++;
    }
  }
  while (moved < 13 && state.wall.length > 0) {
    const idx = state.wall.findIndex((t) => t.id !== missingTile.id && !fullHandIds.has(t.id));
    if (idx < 0) break;
    const [t] = state.wall.splice(idx, 1);
    state.players[southId].rack.push(t);
    moved++;
  }
  state.wall.splice(0, state.wall.length, missingTile);
  state.wallRemaining = 1;
  if (moved !== 13) {
    throw new Error(`South rack expected 13 filler tiles, got ${moved}`);
  }

  if (state.currentTurn !== southId || state.turnPhase !== "draw") {
    throw new Error("expected South draw phase");
  }
  return { eastId, southId };
}

describe("Story 3C.6 — Wall end & last tile (FR102, FR103)", () => {
  test("AC1 — self-drawn Mahjong on last wall tile: payments are 2x from all three losers", () => {
    const state = createPlayState();
    const { drawerId } = setupForLastDraw(state, 1);

    handleDrawTile(state, { type: "DRAW_TILE", playerId: drawerId });
    expect(state.wall.length).toBe(0);

    state.players[drawerId].rack.length = 0;
    injectTilesIntoRack(state, drawerId, buildValidHandEv2());

    const result = handleDeclareMahjong(state, {
      type: "DECLARE_MAHJONG",
      playerId: drawerId,
    });

    expect(result.accepted).toBe(true);
    expect(state.gamePhase).toBe("scoreboard");
    const gr = state.gameResult;
    expect(isMahjongGameResult(gr)).toBe(true);
    if (!isMahjongGameResult(gr)) throw new Error("expected mahjong result");
    expect(gr.selfDrawn).toBe(true);

    const loserIds = Object.keys(state.players).filter((id) => id !== drawerId);
    for (const loserId of loserIds) {
      expect(gr.payments[loserId]).toBe(-50);
    }
    expect(gr.payments[drawerId]).toBe(150);
  });

  test("AC2 — last discard with empty wall: Pung can be registered (full call menu not restricted)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T12:00:00Z"));
    try {
      const state = createPlayState();
      const { drawerId, westId, jokerTileIds } = setupForLastDrawWithWestJokerPung(state);

      handleDrawTile(state, { type: "DRAW_TILE", playerId: drawerId });
      expect(state.wall.length).toBe(0);

      const tileToDiscardId = getDiscardableTileId(state, drawerId);
      handleDiscardTile(state, {
        type: "DISCARD_TILE",
        playerId: drawerId,
        tileId: tileToDiscardId,
      });

      expect(state.wall.length).toBe(0);
      expect(state.callWindow).not.toBeNull();

      const result = handleCallAction(
        state,
        { type: "CALL_PUNG", playerId: westId, tileIds: [...jokerTileIds] },
        "pung",
      );

      expect(result.accepted).toBe(true);
      expect(result.resolved).toEqual({ type: "CALL_WINDOW_FROZEN", callerId: westId });
    } finally {
      vi.useRealTimers();
    }
  });

  test("AC2 — getValidCallOptions ignores wall state (empty wall does not reduce call types)", () => {
    const discard: Tile = { id: "bam-5-1", category: "suited", suit: "bam", value: 5, copy: 1 };
    const rack: Tile[] = [
      { id: "bam-5-2", category: "suited", suit: "bam", value: 5, copy: 2 },
      { id: "bam-5-3", category: "suited", suit: "bam", value: 5, copy: 3 },
    ];
    const options = getValidCallOptions(rack, discard);
    expect(options).toContain("pung");
  });

  test("AC3 — last discard, no calls: wall game with winnerId null (explicit AC3 label)", () => {
    const state = createPlayState();
    const { drawerId } = setupForLastDraw(state, 1);

    handleDrawTile(state, { type: "DRAW_TILE", playerId: drawerId });
    const tileId = getDiscardableTileId(state, drawerId);
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: drawerId, tileId });

    passAllPlayers(state);

    expect(state.gamePhase).toBe("scoreboard");
    expect(state.gameResult).toEqual({ winnerId: null, points: 0 });
  });

  test("AC3 — timer_expired closeCallWindow with empty wall ends as wall game (same path as all_pass)", () => {
    const state = createPlayState();
    const { drawerId } = setupForLastDraw(state, 1);

    handleDrawTile(state, { type: "DRAW_TILE", playerId: drawerId });
    const tileId = getDiscardableTileId(state, drawerId);
    handleDiscardTile(state, { type: "DISCARD_TILE", playerId: drawerId, tileId });

    expect(state.callWindow).not.toBeNull();
    expect(state.callWindow!.calls).toHaveLength(0);
    expect(state.wall.length).toBe(0);

    const result = closeCallWindow(state, "timer_expired");
    expect(result.accepted).toBe(true);
    expect(result.resolved).toEqual({ type: "WALL_GAME" });
    expect(state.gamePhase).toBe("scoreboard");
    expect(state.gameResult).toEqual({ winnerId: null, points: 0 });
  });

  test("AC4 — Mahjong on last discard: discarder pays 2x, others 1x (empty wall)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:00:00Z"));
    try {
      const state = createPlayState();
      const eastId = getPlayerBySeat(state, "east");
      const southId = getPlayerBySeat(state, "south");

      const eastFirstDiscardId = getDiscardableTileId(state, eastId);
      handleDiscardTile(state, {
        type: "DISCARD_TILE",
        playerId: eastId,
        tileId: eastFirstDiscardId,
      });

      const fullHand = buildTilesForHand(card, "ev-3", { A: "bam", B: "crak", C: "dot" });
      const southRack = fullHand.slice(1);
      const missingTile = fullHand[0];

      state.players[southId].rack.length = 0;
      for (const tile of southRack) {
        for (const p of Object.values(state.players)) {
          if (p.id === southId) continue;
          const idx = p.rack.findIndex((t) => t.id === tile.id);
          if (idx >= 0) p.rack.splice(idx, 1);
        }
        const wallIdx = state.wall.findIndex((t) => t.id === tile.id);
        if (wallIdx >= 0) state.wall.splice(wallIdx, 1);
        state.players[southId].rack.push(tile);
      }
      state.wallRemaining = state.wall.length;

      state.callWindow = {
        status: "confirming",
        discardedTile: missingTile,
        discarderId: eastId,
        passes: [eastId],
        calls: [],
        openedAt: Date.now(),
        confirmingPlayerId: southId,
        confirmationExpiresAt: Date.now() + 5000,
        remainingCallers: [],
        winningCall: { callType: "mahjong", playerId: southId, tileIds: [] },
      };

      state.players[eastId].discardPool.push(missingTile);

      state.wall.splice(0, state.wall.length);
      state.wallRemaining = 0;

      handleConfirmCall(state, { type: "CONFIRM_CALL", playerId: southId, tileIds: [] });

      const gr = state.gameResult;
      if (!gr || gr.winnerId === null) throw new Error("expected Mahjong game result");
      if (!("payments" in gr) || !gr.payments) throw new Error("expected payments on result");
      expect(gr.payments[eastId]).toBe(-50);
      const otherLosers = Object.keys(state.players).filter(
        (id) => id !== southId && id !== eastId,
      );
      for (const id of otherLosers) {
        expect(gr.payments[id]).toBe(-25);
      }
      expect(gr.payments[southId]).toBe(100);
    } finally {
      vi.useRealTimers();
    }
  });

  test("AC4 — Mahjong on last discard via CALL_MAHJONG → resolveCallWindow → confirm (integration)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-28T12:05:00Z"));
    try {
      const state = createPlayState();
      const { eastId, southId } = setupEastMahjongOnSouthLastDiscard(state);

      const missingTileId = buildTilesForHand(card, "ev-3", { A: "bam", B: "crak", C: "dot" })[0]
        .id;

      handleDrawTile(state, { type: "DRAW_TILE", playerId: southId });
      expect(state.wall.length).toBe(0);

      handleDiscardTile(state, {
        type: "DISCARD_TILE",
        playerId: southId,
        tileId: missingTileId,
      });

      expect(state.callWindow).not.toBeNull();

      const mj = handleCallMahjong(state, {
        type: "CALL_MAHJONG",
        playerId: eastId,
        tileIds: [],
      });
      expect(mj.accepted).toBe(true);

      resolveCallWindow(state);
      expect(state.callWindow?.status).toBe("confirming");

      handleConfirmCall(state, { type: "CONFIRM_CALL", playerId: eastId, tileIds: [] });

      const gr = state.gameResult;
      if (!gr || gr.winnerId === null) throw new Error("expected Mahjong game result");
      if (!("payments" in gr) || !gr.payments) throw new Error("expected payments on result");
      expect(gr.payments[southId]).toBe(-50);
      const otherLosers = Object.keys(state.players).filter(
        (id) => id !== eastId && id !== southId,
      );
      for (const id of otherLosers) {
        expect(gr.payments[id]).toBe(-25);
      }
      expect(gr.payments[eastId]).toBe(100);
    } finally {
      vi.useRealTimers();
    }
  });

  test("AC5 — Pung on last discard → confirm → discard → pass all → wall game", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T14:00:00Z"));
    try {
      const state = createPlayState();
      const { drawerId, westId, jokerTileIds } = setupForLastDrawWithWestJokerPung(state);

      handleDrawTile(state, { type: "DRAW_TILE", playerId: drawerId });
      expect(state.wall.length).toBe(0);

      const tileToDiscardId = getDiscardableTileId(state, drawerId);
      handleDiscardTile(state, {
        type: "DISCARD_TILE",
        playerId: drawerId,
        tileId: tileToDiscardId,
      });

      const tileIdsForPung = [...jokerTileIds];
      handleCallAction(
        state,
        { type: "CALL_PUNG", playerId: westId, tileIds: tileIdsForPung },
        "pung",
      );
      resolveCallWindow(state);
      expect(state.callWindow?.status).toBe("confirming");

      handleConfirmCall(state, {
        type: "CONFIRM_CALL",
        playerId: westId,
        tileIds: tileIdsForPung,
      });

      expect(state.currentTurn).toBe(westId);
      expect(state.turnPhase).toBe("discard");
      expect(state.wall.length).toBe(0);

      const westDiscardId = getDiscardableTileId(state, westId);
      handleDiscardTile(state, { type: "DISCARD_TILE", playerId: westId, tileId: westDiscardId });

      passAllPlayers(state);

      expect(state.gamePhase).toBe("scoreboard");
      expect(state.gameResult).toEqual({ winnerId: null, points: 0 });
    } finally {
      vi.useRealTimers();
    }
  });
});
