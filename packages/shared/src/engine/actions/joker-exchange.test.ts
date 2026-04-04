import { describe, it, expect } from "vite-plus/test";
import { createPlayState } from "../../testing/fixtures";
import { suitedTile, jokerTile, windTile, dragonTile } from "../../testing/tile-builders";
import { handleJokerExchange } from "./joker-exchange";
import type { JokerExchangeAction } from "../../types/actions";

function makeAction(
  playerId: string,
  jokerGroupId: string,
  naturalTileId: string,
): JokerExchangeAction {
  return { type: "JOKER_EXCHANGE", playerId, jokerGroupId, naturalTileId };
}

describe("handleJokerExchange", () => {
  function setupExchangeScenario() {
    const state = createPlayState();
    state.turnPhase = "discard";
    const currentPlayerId = state.currentTurn;
    const currentPlayer = state.players[currentPlayerId];

    const targetPlayerId = Object.keys(state.players).find((id) => id !== currentPlayerId)!;
    const targetPlayer = state.players[targetPlayerId];

    const bam3_1 = suitedTile("bam", 3, 1);
    const bam3_2 = suitedTile("bam", 3, 2);
    const bam3_3 = suitedTile("bam", 3, 3);
    const joker = jokerTile(1);
    targetPlayer.exposedGroups.push({
      type: "kong",
      tiles: [bam3_1, bam3_2, bam3_3, joker],
      identity: { type: "kong", suit: "bam", value: 3 },
    });

    const matchingTile = { ...suitedTile("bam", 3, 4), id: "test-exchange-bam-3-offer" };
    currentPlayer.rack.push(matchingTile);

    const jokerGroupId = `${targetPlayerId}-group-${targetPlayer.exposedGroups.length - 1}`;

    return {
      state,
      currentPlayerId,
      currentPlayer,
      targetPlayerId,
      targetPlayer,
      matchingTile,
      joker,
      jokerGroupId,
    };
  }

  it("AC1 AC2 AC9: successful exchange moves Joker to rack, natural to group, resolved action", () => {
    const {
      state,
      currentPlayerId,
      currentPlayer,
      targetPlayer,
      matchingTile,
      joker,
      jokerGroupId,
    } = setupExchangeScenario();

    const result = handleJokerExchange(
      state,
      makeAction(currentPlayerId, jokerGroupId, matchingTile.id),
    );

    expect(result.accepted).toBe(true);
    if (!result.accepted || !result.resolved) return;
    expect(result.resolved).toEqual({
      type: "JOKER_EXCHANGE",
      playerId: currentPlayerId,
      jokerGroupId,
      jokerTileId: joker.id,
      naturalTileId: matchingTile.id,
    });

    expect(currentPlayer.rack.some((t) => t.id === joker.id)).toBe(true);
    expect(currentPlayer.rack.some((t) => t.id === matchingTile.id)).toBe(false);

    const group = targetPlayer.exposedGroups[0];
    expect(group.tiles.some((t) => t.id === matchingTile.id)).toBe(true);
    expect(group.tiles.some((t) => t.id === joker.id)).toBe(false);
    expect(state.turnPhase).toBe("discard");
  });

  it("AC3: identity mismatch rejects with TILE_DOES_NOT_MATCH_GROUP", () => {
    const { state, currentPlayerId, jokerGroupId } = setupExchangeScenario();
    const wrongTile = { ...suitedTile("dot", 5, 1), id: "test-exchange-wrong-dot-5" };
    state.players[currentPlayerId].rack.push(wrongTile);

    const result = handleJokerExchange(
      state,
      makeAction(currentPlayerId, jokerGroupId, wrongTile.id),
    );

    expect(result).toEqual({ accepted: false, reason: "TILE_DOES_NOT_MATCH_GROUP" });
  });

  it("AC4: no Joker in group rejects with NO_JOKER_IN_GROUP", () => {
    const { state, currentPlayerId, targetPlayer, matchingTile, jokerGroupId } =
      setupExchangeScenario();
    targetPlayer.exposedGroups[0] = {
      type: "kong",
      tiles: [
        suitedTile("bam", 3, 1),
        suitedTile("bam", 3, 2),
        suitedTile("bam", 3, 3),
        suitedTile("bam", 3, 4),
      ],
      identity: { type: "kong", suit: "bam", value: 3 },
    };

    const result = handleJokerExchange(
      state,
      makeAction(currentPlayerId, jokerGroupId, matchingTile.id),
    );

    expect(result).toEqual({ accepted: false, reason: "NO_JOKER_IN_GROUP" });
  });

  it("AC5: multiple exchanges in one turn keep turnPhase discard", () => {
    const state = createPlayState();
    state.turnPhase = "discard";
    const currentPlayerId = state.currentTurn;
    const currentPlayer = state.players[currentPlayerId];
    const targetPlayerId = Object.keys(state.players).find((id) => id !== currentPlayerId)!;
    const targetPlayer = state.players[targetPlayerId];

    targetPlayer.exposedGroups.push({
      type: "kong",
      tiles: [
        suitedTile("bam", 3, 1),
        suitedTile("bam", 3, 2),
        suitedTile("bam", 3, 3),
        jokerTile(1),
      ],
      identity: { type: "kong", suit: "bam", value: 3 },
    });
    targetPlayer.exposedGroups.push({
      type: "kong",
      tiles: [
        suitedTile("dot", 7, 1),
        suitedTile("dot", 7, 2),
        suitedTile("dot", 7, 3),
        jokerTile(2),
      ],
      identity: { type: "kong", suit: "dot", value: 7 },
    });

    const m1 = { ...suitedTile("bam", 3, 4), id: "test-exchange-bam3-second-turn" };
    const m2 = { ...suitedTile("dot", 7, 4), id: "test-exchange-dot7-second-turn" };
    currentPlayer.rack.push(m1, m2);

    const gid0 = `${targetPlayerId}-group-0`;
    const gid1 = `${targetPlayerId}-group-1`;

    const r1 = handleJokerExchange(state, makeAction(currentPlayerId, gid0, m1.id));
    expect(r1.accepted).toBe(true);
    expect(state.turnPhase).toBe("discard");

    const r2 = handleJokerExchange(state, makeAction(currentPlayerId, gid1, m2.id));
    expect(r2.accepted).toBe(true);
    expect(state.turnPhase).toBe("discard");
  });

  it("AC6: not your turn rejects", () => {
    const { state, currentPlayerId, matchingTile, jokerGroupId } = setupExchangeScenario();
    const otherId = Object.keys(state.players).find((id) => id !== currentPlayerId)!;

    const result = handleJokerExchange(state, makeAction(otherId, jokerGroupId, matchingTile.id));

    expect(result).toEqual({ accepted: false, reason: "NOT_YOUR_TURN" });
  });

  it("AC7: wrong turnPhase rejects with ALREADY_DISCARDED", () => {
    const { state, currentPlayerId, matchingTile, jokerGroupId } = setupExchangeScenario();
    state.turnPhase = "callWindow";

    const result = handleJokerExchange(
      state,
      makeAction(currentPlayerId, jokerGroupId, matchingTile.id),
    );

    expect(result).toEqual({ accepted: false, reason: "ALREADY_DISCARDED" });
  });

  it("AC8: wrong game phase rejects with WRONG_PHASE", () => {
    const { state, currentPlayerId, matchingTile, jokerGroupId } = setupExchangeScenario();
    state.gamePhase = "lobby";

    const result = handleJokerExchange(
      state,
      makeAction(currentPlayerId, jokerGroupId, matchingTile.id),
    );

    expect(result).toEqual({ accepted: false, reason: "WRONG_PHASE" });
  });

  it("AC10: exchange into another player's exposed group succeeds", () => {
    const { state, currentPlayerId, targetPlayerId, matchingTile, joker, jokerGroupId } =
      setupExchangeScenario();

    expect(currentPlayerId).not.toBe(targetPlayerId);

    const result = handleJokerExchange(
      state,
      makeAction(currentPlayerId, jokerGroupId, matchingTile.id),
    );

    expect(result.accepted).toBe(true);
    if (!result.accepted || !result.resolved || result.resolved.type !== "JOKER_EXCHANGE") return;
    expect(result.resolved.jokerTileId).toBe(joker.id);
  });

  it("AC11: natural tile not in rack rejects", () => {
    const { state, currentPlayerId, jokerGroupId } = setupExchangeScenario();

    const result = handleJokerExchange(
      state,
      makeAction(currentPlayerId, jokerGroupId, "no-such-tile"),
    );

    expect(result).toEqual({ accepted: false, reason: "TILE_NOT_IN_RACK" });
  });

  it("AC12: invalid group ID rejects with GROUP_NOT_FOUND", () => {
    const { state, currentPlayerId, matchingTile } = setupExchangeScenario();

    const result = handleJokerExchange(
      state,
      makeAction(currentPlayerId, "bogus-id-format", matchingTile.id),
    );

    expect(result).toEqual({ accepted: false, reason: "GROUP_NOT_FOUND" });
  });

  it("AC12: out-of-range group index rejects", () => {
    const { state, currentPlayerId, matchingTile, targetPlayerId } = setupExchangeScenario();

    const result = handleJokerExchange(
      state,
      makeAction(currentPlayerId, `${targetPlayerId}-group-99`, matchingTile.id),
    );

    expect(result).toEqual({ accepted: false, reason: "GROUP_NOT_FOUND" });
  });

  it("multi-Joker group: removes only one Joker; others remain", () => {
    const state = createPlayState();
    state.turnPhase = "discard";
    const currentPlayerId = state.currentTurn;
    const currentPlayer = state.players[currentPlayerId];
    const targetPlayerId = Object.keys(state.players).find((id) => id !== currentPlayerId)!;
    const targetPlayer = state.players[targetPlayerId];

    const j1 = jokerTile(1);
    const j2 = jokerTile(2);
    targetPlayer.exposedGroups.push({
      type: "quint",
      tiles: [suitedTile("dot", 7, 1), suitedTile("dot", 7, 2), suitedTile("dot", 7, 3), j1, j2],
      identity: { type: "quint", suit: "dot", value: 7 },
    });

    const offered = { ...suitedTile("dot", 7, 4), id: "test-exchange-quint-dot7" };
    currentPlayer.rack.push(offered);
    const jokerGroupId = `${targetPlayerId}-group-0`;

    const result = handleJokerExchange(
      state,
      makeAction(currentPlayerId, jokerGroupId, offered.id),
    );

    expect(result.accepted).toBe(true);
    const tiles = targetPlayer.exposedGroups[0].tiles;
    expect(tiles.filter((t) => t.category === "joker")).toHaveLength(1);
    expect(tiles.some((t) => t.id === offered.id)).toBe(true);
  });

  it("wind tile exchange matching wind group identity", () => {
    const state = createPlayState();
    state.turnPhase = "discard";
    const currentPlayerId = state.currentTurn;
    const currentPlayer = state.players[currentPlayerId];
    const targetPlayerId = Object.keys(state.players).find((id) => id !== currentPlayerId)!;
    const targetPlayer = state.players[targetPlayerId];

    const j = jokerTile(3);
    targetPlayer.exposedGroups.push({
      type: "pung",
      tiles: [windTile("north", 1), windTile("north", 2), j],
      identity: { type: "pung", wind: "north" },
    });

    const offered = { ...windTile("north", 4), id: "test-exchange-wind-north-offer" };
    currentPlayer.rack.push(offered);
    const jokerGroupId = `${targetPlayerId}-group-0`;

    const result = handleJokerExchange(
      state,
      makeAction(currentPlayerId, jokerGroupId, offered.id),
    );

    expect(result.accepted).toBe(true);
    if (!result.accepted || !result.resolved || result.resolved.type !== "JOKER_EXCHANGE") return;
    expect(result.resolved.jokerTileId).toBe(j.id);
  });

  it("dragon tile exchange matching dragon group identity", () => {
    const state = createPlayState();
    state.turnPhase = "discard";
    const currentPlayerId = state.currentTurn;
    const currentPlayer = state.players[currentPlayerId];
    const targetPlayerId = Object.keys(state.players).find((id) => id !== currentPlayerId)!;
    const targetPlayer = state.players[targetPlayerId];

    const j = jokerTile(4);
    targetPlayer.exposedGroups.push({
      type: "pung",
      tiles: [dragonTile("red", 1), dragonTile("red", 2), j],
      identity: { type: "pung", dragon: "red" },
    });

    const offered = { ...dragonTile("red", 3), id: "test-exchange-dragon-red-offer" };
    currentPlayer.rack.push(offered);
    const jokerGroupId = `${targetPlayerId}-group-0`;

    const result = handleJokerExchange(
      state,
      makeAction(currentPlayerId, jokerGroupId, offered.id),
    );

    expect(result.accepted).toBe(true);
    if (!result.accepted || !result.resolved || result.resolved.type !== "JOKER_EXCHANGE") return;
    expect(result.resolved.jokerTileId).toBe(j.id);
  });

  it("simplified Joker rules: rejects with JOKER_EXCHANGE_DISABLED", () => {
    const { state, currentPlayerId, matchingTile, jokerGroupId } = setupExchangeScenario();
    state.jokerRulesMode = "simplified";
    const result = handleJokerExchange(
      state,
      makeAction(currentPlayerId, jokerGroupId, matchingTile.id),
    );
    expect(result).toEqual({ accepted: false, reason: "JOKER_EXCHANGE_DISABLED" });
  });
});
