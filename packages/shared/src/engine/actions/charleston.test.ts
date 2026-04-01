import { describe, expect, test } from "vite-plus/test";
import { createGame } from "../state/create-game";
import { handleAction } from "../game-engine";
import type { GameState, CharlestonDirection } from "../../types/game-state";
import type { GameAction } from "../../types/actions";
import { getPlayerBySeat } from "../../testing/helpers";
import { getCharlestonTargetPlayerId } from "./charleston";

const PLAYER_IDS = ["p1", "p2", "p3", "p4"] as const;
const SEED = 42;

function rackIds(state: GameState, playerId: string): string[] {
  return state.players[playerId].rack.map((tile) => tile.id);
}

function visibleSelection(state: GameState, playerId: string): string[] {
  return rackIds(state, playerId).slice(0, 3);
}

function submitCharlestonPass(state: GameState, playerId: string, tileIds: readonly string[]) {
  const action: GameAction = {
    type: "CHARLESTON_PASS",
    playerId,
    tileIds,
  };
  return handleAction(state, action);
}

function submitCharlestonVote(state: GameState, playerId: string, accept: boolean) {
  const action: GameAction = {
    type: "CHARLESTON_VOTE",
    playerId,
    accept,
  };
  return handleAction(state, action);
}

function advanceToSecondCharlestonVote(state: GameState): void {
  completeDirection(state, "right");
  completeDirection(state, "across");
  completeDirection(state, "left");
}

function senderPlayerIdForRecipient(
  state: GameState,
  recipientPlayerId: string,
  direction: CharlestonDirection,
): string {
  const senderPlayerId = PLAYER_IDS.find(
    (candidatePlayerId) =>
      getCharlestonTargetPlayerId(state, candidatePlayerId, direction) === recipientPlayerId,
  );

  if (!senderPlayerId) {
    throw new Error(
      `No sender found for recipient ${recipientPlayerId} and direction ${direction}`,
    );
  }

  return senderPlayerId;
}

function completeDirection(
  state: GameState,
  direction: CharlestonDirection,
): {
  selections: Record<string, string[]>;
  lastResult: ReturnType<typeof submitCharlestonPass>;
} {
  const selections = Object.fromEntries(
    PLAYER_IDS.map((playerId) => [playerId, visibleSelection(state, playerId)]),
  ) as Record<string, string[]>;

  let lastResult = submitCharlestonPass(state, PLAYER_IDS[0], selections[PLAYER_IDS[0]]);
  for (const playerId of PLAYER_IDS.slice(1)) {
    lastResult = submitCharlestonPass(state, playerId, selections[playerId]);
  }

  expect(lastResult.accepted).toBe(true);
  expect(lastResult.resolved).toMatchObject({
    type: "CHARLESTON_PHASE_COMPLETE",
    direction,
  });

  return { selections, lastResult };
}

function expectRackContainsPassedTiles(
  state: GameState,
  recipientPlayerId: string,
  senderSelection: readonly string[],
): void {
  expect(rackIds(state, recipientPlayerId)).toEqual(expect.arrayContaining([...senderSelection]));
}

function expectParsedStateEqual(state: GameState, serializedBefore: string): void {
  expect(JSON.parse(JSON.stringify(state))).toEqual(JSON.parse(serializedBefore));
}

describe("Charleston passes", () => {
  test("resolves the right pass simultaneously after all four players submit", () => {
    const state = createGame([...PLAYER_IDS], SEED);
    const eastPlayerId = getPlayerBySeat(state, "east");
    const southPlayerId = getPlayerBySeat(state, "south");
    const westPlayerId = getPlayerBySeat(state, "west");
    const northPlayerId = getPlayerBySeat(state, "north");

    const { selections } = completeDirection(state, "right");

    expect(state.charleston).toMatchObject({
      stage: "first",
      status: "passing",
      currentDirection: "across",
      submittedPlayerIds: [],
    });

    expectRackContainsPassedTiles(state, southPlayerId, selections[eastPlayerId]);
    expectRackContainsPassedTiles(state, westPlayerId, selections[southPlayerId]);
    expectRackContainsPassedTiles(state, northPlayerId, selections[westPlayerId]);
    expectRackContainsPassedTiles(state, eastPlayerId, selections[northPlayerId]);

    for (const playerId of PLAYER_IDS) {
      const recipientRackIds = rackIds(state, playerId);
      for (const passedTileId of selections[playerId]) {
        expect(recipientRackIds).not.toContain(passedTileId);
      }
    }
  });

  test("stores across receipts as hidden tiles until the relevant left-pass lock", () => {
    const state = createGame([...PLAYER_IDS], SEED);
    completeDirection(state, "right");

    const { selections } = completeDirection(state, "across");
    const eastPlayerId = getPlayerBySeat(state, "east");
    const acrossSenderId = senderPlayerIdForRecipient(state, eastPlayerId, "across");
    const hiddenAcrossTileIds = selections[acrossSenderId];

    expect(state.charleston).toMatchObject({
      stage: "first",
      status: "passing",
      currentDirection: "left",
    });
    expect(rackIds(state, eastPlayerId)).not.toEqual(expect.arrayContaining(hiddenAcrossTileIds));
    const hiddenAcrossTiles = state.charleston?.hiddenAcrossTilesByPlayerId[eastPlayerId];
    expect(hiddenAcrossTiles).toBeDefined();
    expect(hiddenAcrossTiles?.map((tile) => tile.id)).toEqual(hiddenAcrossTileIds);

    const leftSelection = visibleSelection(state, eastPlayerId);
    const result = submitCharlestonPass(state, eastPlayerId, leftSelection);

    expect(result.accepted).toBe(true);
    expect(rackIds(state, eastPlayerId)).toEqual(expect.arrayContaining(hiddenAcrossTileIds));
    expect(state.charleston?.submittedPlayerIds).toContain(eastPlayerId);
  });

  test("completes right, across, and left passes before handing off to second Charleston voting", () => {
    const state = createGame([...PLAYER_IDS], SEED);

    completeDirection(state, "right");
    completeDirection(state, "across");
    const { lastResult } = completeDirection(state, "left");

    expect(lastResult.accepted).toBe(true);
    expect(lastResult.resolved).toMatchObject({
      type: "CHARLESTON_PHASE_COMPLETE",
      direction: "left",
      nextDirection: null,
      stage: "second",
      status: "vote-ready",
    });
    expect(state.gamePhase).toBe("charleston");
    expect(state.charleston).toMatchObject({
      stage: "second",
      status: "vote-ready",
      currentDirection: null,
      submittedPlayerIds: [],
    });
    expect(state.charleston?.hiddenAcrossTilesByPlayerId).toEqual({});
  });

  test("resolves the left pass using exact seat-to-seat transfers", () => {
    const state = createGame([...PLAYER_IDS], SEED);
    const eastPlayerId = getPlayerBySeat(state, "east");
    const southPlayerId = getPlayerBySeat(state, "south");
    const westPlayerId = getPlayerBySeat(state, "west");
    const northPlayerId = getPlayerBySeat(state, "north");

    completeDirection(state, "right");
    completeDirection(state, "across");
    const { selections } = completeDirection(state, "left");

    expectRackContainsPassedTiles(state, northPlayerId, selections[eastPlayerId]);
    expectRackContainsPassedTiles(state, eastPlayerId, selections[southPlayerId]);
    expectRackContainsPassedTiles(state, southPlayerId, selections[westPlayerId]);
    expectRackContainsPassedTiles(state, westPlayerId, selections[northPlayerId]);
  });

  test("rejects wrong pass sizes without mutating state", () => {
    const state = createGame([...PLAYER_IDS], SEED);
    const before = JSON.stringify(state);
    const eastPlayerId = getPlayerBySeat(state, "east");

    const result = submitCharlestonPass(
      state,
      eastPlayerId,
      visibleSelection(state, eastPlayerId).slice(0, 2),
    );

    expect(result).toEqual({ accepted: false, reason: "MUST_PASS_THREE_TILES" });
    expectParsedStateEqual(state, before);
  });

  test("rejects tile selections that are not currently visible in the player's rack", () => {
    const state = createGame([...PLAYER_IDS], SEED);
    completeDirection(state, "right");
    const { selections } = completeDirection(state, "across");

    const eastPlayerId = getPlayerBySeat(state, "east");
    const acrossSenderId = senderPlayerIdForRecipient(state, eastPlayerId, "across");
    const hiddenAcrossTileId = selections[acrossSenderId][0];
    const before = JSON.stringify(state);

    const result = submitCharlestonPass(state, eastPlayerId, [
      hiddenAcrossTileId,
      ...visibleSelection(state, eastPlayerId).slice(0, 2),
    ]);

    expect(result).toEqual({ accepted: false, reason: "TILE_NOT_IN_RACK" });
    expectParsedStateEqual(state, before);
  });

  test("rejects duplicate tile ids and repeat submissions with zero mutations", () => {
    const state = createGame([...PLAYER_IDS], SEED);
    const eastPlayerId = getPlayerBySeat(state, "east");
    const [firstTileId, secondTileId] = visibleSelection(state, eastPlayerId);
    const beforeDuplicate = JSON.stringify(state);

    const duplicateTileResult = submitCharlestonPass(state, eastPlayerId, [
      firstTileId,
      firstTileId,
      secondTileId,
    ]);

    expect(duplicateTileResult).toEqual({ accepted: false, reason: "DUPLICATE_TILE_IDS" });
    expectParsedStateEqual(state, beforeDuplicate);

    const firstSubmission = visibleSelection(state, eastPlayerId);
    const firstResult = submitCharlestonPass(state, eastPlayerId, firstSubmission);
    const beforeRepeat = JSON.stringify(state);
    const repeatResult = submitCharlestonPass(state, eastPlayerId, firstSubmission);

    expect(firstResult.accepted).toBe(true);
    expect(repeatResult).toEqual({ accepted: false, reason: "CHARLESTON_PASS_ALREADY_LOCKED" });
    expectParsedStateEqual(state, beforeRepeat);
  });

  test('requires unanimous "yes" votes before starting the reversed second Charleston', () => {
    const state = createGame([...PLAYER_IDS], SEED);
    advanceToSecondCharlestonVote(state);

    const firstVote = submitCharlestonVote(state, "p1", true);
    expect(firstVote).toEqual({
      accepted: true,
      resolved: {
        type: "CHARLESTON_VOTE_CAST",
        votesReceivedCount: 1,
      },
    });

    submitCharlestonVote(state, "p2", true);
    submitCharlestonVote(state, "p3", true);
    const finalVote = submitCharlestonVote(state, "p4", true);

    expect(finalVote).toEqual({
      accepted: true,
      resolved: {
        type: "CHARLESTON_VOTE_RESOLVED",
        outcome: "accepted",
        nextDirection: "left",
        stage: "second",
        status: "passing",
      },
    });
    expect(state.gamePhase).toBe("charleston");
    expect(state.charleston).toMatchObject({
      stage: "second",
      status: "passing",
      currentDirection: "left",
      submittedPlayerIds: [],
    });
  });

  test('skips directly to courtesy-ready state on the first "no" vote', () => {
    const state = createGame([...PLAYER_IDS], SEED);
    advanceToSecondCharlestonVote(state);

    const eastPlayerId = getPlayerBySeat(state, "east");
    const southPlayerId = getPlayerBySeat(state, "south");
    const westPlayerId = getPlayerBySeat(state, "west");
    const northPlayerId = getPlayerBySeat(state, "north");

    const result = submitCharlestonVote(state, eastPlayerId, false);

    expect(result).toEqual({
      accepted: true,
      resolved: {
        type: "CHARLESTON_VOTE_RESOLVED",
        outcome: "rejected",
        nextDirection: null,
        stage: "courtesy",
        status: "courtesy-ready",
      },
    });
    expect(state.gamePhase).toBe("charleston");
    expect(state.charleston).toMatchObject({
      stage: "courtesy",
      status: "courtesy-ready",
      currentDirection: null,
      submittedPlayerIds: [],
      courtesyPairings: [
        [eastPlayerId, westPlayerId],
        [southPlayerId, northPlayerId],
      ],
    });
  });

  test("rejects wrong-phase and duplicate Charleston votes without mutating state", () => {
    const state = createGame([...PLAYER_IDS], SEED);
    const beforeWrongPhase = JSON.stringify(state);

    const wrongPhaseResult = submitCharlestonVote(state, "p1", true);

    expect(wrongPhaseResult).toEqual({ accepted: false, reason: "WRONG_PHASE" });
    expectParsedStateEqual(state, beforeWrongPhase);

    advanceToSecondCharlestonVote(state);
    const firstVote = submitCharlestonVote(state, "p1", true);
    const beforeRepeat = JSON.stringify(state);
    const repeatVote = submitCharlestonVote(state, "p1", true);

    expect(firstVote.accepted).toBe(true);
    expect(repeatVote).toEqual({ accepted: false, reason: "CHARLESTON_VOTE_ALREADY_CAST" });
    expectParsedStateEqual(state, beforeRepeat);
  });

  test("stores second-Charleston across receipts as hidden tiles until the relevant right-pass lock", () => {
    const state = createGame([...PLAYER_IDS], SEED);
    advanceToSecondCharlestonVote(state);
    submitCharlestonVote(state, "p1", true);
    submitCharlestonVote(state, "p2", true);
    submitCharlestonVote(state, "p3", true);
    submitCharlestonVote(state, "p4", true);

    completeDirection(state, "left");
    const { selections } = completeDirection(state, "across");

    const eastPlayerId = getPlayerBySeat(state, "east");
    const acrossSenderId = senderPlayerIdForRecipient(state, eastPlayerId, "across");
    const hiddenAcrossTileIds = selections[acrossSenderId];

    expect(state.charleston).toMatchObject({
      stage: "second",
      status: "passing",
      currentDirection: "right",
    });
    expect(rackIds(state, eastPlayerId)).not.toEqual(expect.arrayContaining(hiddenAcrossTileIds));
    expect(
      state.charleston?.hiddenAcrossTilesByPlayerId[eastPlayerId]?.map((tile) => tile.id),
    ).toEqual(hiddenAcrossTileIds);

    const rightSelection = visibleSelection(state, eastPlayerId);
    const lockResult = submitCharlestonPass(state, eastPlayerId, rightSelection);

    expect(lockResult.accepted).toBe(true);
    expect(rackIds(state, eastPlayerId)).toEqual(expect.arrayContaining(hiddenAcrossTileIds));
  });

  test("completes the reversed second Charleston and hands off to courtesy-ready instead of play", () => {
    const state = createGame([...PLAYER_IDS], SEED);
    advanceToSecondCharlestonVote(state);
    submitCharlestonVote(state, "p1", true);
    submitCharlestonVote(state, "p2", true);
    submitCharlestonVote(state, "p3", true);
    submitCharlestonVote(state, "p4", true);

    completeDirection(state, "left");
    completeDirection(state, "across");
    const { lastResult } = completeDirection(state, "right");

    expect(lastResult).toEqual({
      accepted: true,
      resolved: {
        type: "CHARLESTON_PHASE_COMPLETE",
        direction: "right",
        nextDirection: null,
        stage: "courtesy",
        status: "courtesy-ready",
      },
    });
    expect(state.gamePhase).toBe("charleston");
    expect(state.charleston).toMatchObject({
      stage: "courtesy",
      status: "courtesy-ready",
      currentDirection: null,
    });
  });
});
