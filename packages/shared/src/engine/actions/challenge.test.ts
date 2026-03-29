import { describe, test, expect } from "vite-plus/test";
import { handleChallengeMahjong, handleChallengeVote } from "./challenge";
import { handleDeclareMahjong } from "./mahjong";
import { handleAction } from "../game-engine";
import { createPlayState } from "../../testing/fixtures";
import { getPlayerBySeat, injectTilesIntoRack } from "../../testing/helpers";
import { buildTilesForHand } from "../../testing/tile-builders";
import { loadCard } from "../../card/card-loader";
import type { GameState, MahjongGameResult } from "../../types/game-state";
import type { Tile } from "../../types/tiles";

const card = loadCard("2026");

/** Set up a scoreboard state with a valid Mahjong winner */
function setupScoreboardWithWinner(): {
  state: GameState;
  winnerId: string;
  losers: string[];
} {
  const state = createPlayState();
  const eastId = getPlayerBySeat(state, "east");

  // Give east a valid hand and declare mahjong
  const validTiles = buildTilesForHand(card, "ev-2", { A: "bam", B: "crak", C: "dot" });
  state.players[eastId].rack.length = 0;
  injectTilesIntoRack(state, eastId, validTiles);
  state.currentTurn = eastId;
  state.turnPhase = "discard";

  handleDeclareMahjong(state, { type: "DECLARE_MAHJONG", playerId: eastId });

  const losers = Object.keys(state.players).filter((id) => id !== eastId);

  return { state, winnerId: eastId, losers };
}

describe("Challenge Mechanism", () => {
  test("challenge initiated during scoreboard phase → accepted, challenger vote pre-set", () => {
    const { state, winnerId, losers } = setupScoreboardWithWinner();
    const challengerId = losers[0];

    const result = handleChallengeMahjong(state, {
      type: "CHALLENGE_MAHJONG",
      playerId: challengerId,
    });

    expect(result.accepted).toBe(true);
    expect(result.resolved).toMatchObject({
      type: "CHALLENGE_INITIATED",
      challengerId,
      winnerId,
    });
    expect(state.challengeState).not.toBeNull();
    expect(state.challengeState!.votes[challengerId]).toBe("invalid");
  });

  test("challenge by winner → rejected (cannot challenge own Mahjong)", () => {
    const { state, winnerId } = setupScoreboardWithWinner();

    const result = handleChallengeMahjong(state, {
      type: "CHALLENGE_MAHJONG",
      playerId: winnerId,
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("WINNER_CANNOT_CHALLENGE");
  });

  test("challenge during non-scoreboard phase → rejected", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    const result = handleChallengeMahjong(state, {
      type: "CHALLENGE_MAHJONG",
      playerId: eastId,
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("WRONG_PHASE");
  });

  test("challenge when challenge already active → rejected", () => {
    const { state, losers } = setupScoreboardWithWinner();

    // First challenge
    handleChallengeMahjong(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });

    // Second challenge
    const result = handleChallengeMahjong(state, {
      type: "CHALLENGE_MAHJONG",
      playerId: losers[1],
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("CHALLENGE_ALREADY_ACTIVE");
  });

  test("challenge on wall game result → rejected (no Mahjong to challenge)", () => {
    const state = createPlayState();
    state.gamePhase = "scoreboard";
    state.gameResult = { winnerId: null, points: 0 };

    const eastId = getPlayerBySeat(state, "east");
    const result = handleChallengeMahjong(state, {
      type: "CHALLENGE_MAHJONG",
      playerId: eastId,
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("WALL_GAME_NO_CHALLENGE");
  });

  test("vote cast by participant → recorded correctly", () => {
    const { state, losers } = setupScoreboardWithWinner();
    handleChallengeMahjong(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });

    const result = handleChallengeVote(state, {
      type: "CHALLENGE_VOTE",
      playerId: losers[1],
      vote: "valid",
    });

    expect(result.accepted).toBe(true);
    expect(result.resolved).toMatchObject({
      type: "CHALLENGE_VOTE_CAST",
      playerId: losers[1],
      vote: "valid",
    });
    expect(state.challengeState!.votes[losers[1]]).toBe("valid");
  });

  test("vote by non-participant → rejected", () => {
    const { state, losers } = setupScoreboardWithWinner();
    handleChallengeMahjong(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });

    const result = handleChallengeVote(state, {
      type: "CHALLENGE_VOTE",
      playerId: "nonexistent-player",
      vote: "valid",
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("PLAYER_NOT_FOUND");
  });

  test("duplicate vote → rejected", () => {
    const { state, losers } = setupScoreboardWithWinner();
    handleChallengeMahjong(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });

    // Challenger already has "invalid" vote pre-set
    const result = handleChallengeVote(state, {
      type: "CHALLENGE_VOTE",
      playerId: losers[0],
      vote: "invalid",
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("ALREADY_VOTED");
  });

  test("3+ invalid votes → Mahjong overturned, dead hand on winner, scoring reversed", () => {
    const { state, winnerId, losers } = setupScoreboardWithWinner();

    handleChallengeMahjong(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });
    // losers[0] has "invalid" pre-set

    handleChallengeVote(state, { type: "CHALLENGE_VOTE", playerId: losers[1], vote: "invalid" });

    // 3rd invalid vote should resolve
    const result = handleChallengeVote(state, {
      type: "CHALLENGE_VOTE",
      playerId: winnerId,
      vote: "invalid",
    });

    expect(result.accepted).toBe(true);
    expect(result.resolved).toMatchObject({
      type: "CHALLENGE_RESOLVED",
      outcome: "overturned",
    });

    // Dead hand on winner
    expect(state.players[winnerId].deadHand).toBe(true);

    // Scoring reversed — all scores should be back to 0
    for (const playerId of Object.keys(state.players)) {
      expect(state.scores[playerId]).toBe(0);
    }

    // Game phase transitions back to play
    expect(state.gamePhase).toBe("play");
    expect(state.gameResult).toBeNull();
    expect(state.challengeState).toBeNull();
  });

  test("2+ valid votes → Mahjong upheld, challenge cleared", () => {
    const { state, winnerId, losers } = setupScoreboardWithWinner();

    handleChallengeMahjong(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });

    // 2 valid votes should resolve (majority for uphold)
    handleChallengeVote(state, { type: "CHALLENGE_VOTE", playerId: losers[1], vote: "valid" });
    const result = handleChallengeVote(state, {
      type: "CHALLENGE_VOTE",
      playerId: winnerId,
      vote: "valid",
    });

    expect(result.accepted).toBe(true);
    expect(result.resolved).toMatchObject({
      type: "CHALLENGE_RESOLVED",
      outcome: "upheld",
    });

    // Game stays on scoreboard
    expect(state.gamePhase).toBe("scoreboard");
    expect(state.challengeState).toBeNull();
    expect(state.players[winnerId].deadHand).toBe(false);
  });

  test("all 4 votes cast → auto-resolve without waiting for timer", () => {
    const { state, winnerId, losers } = setupScoreboardWithWinner();

    handleChallengeMahjong(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });
    // losers[0] has "invalid" pre-set. To reach 4 votes without early resolution:
    // 1 invalid (pre-set) + 1 invalid + 1 valid = 2 invalid, 1 valid — no early resolve yet
    handleChallengeVote(state, { type: "CHALLENGE_VOTE", playerId: losers[1], vote: "invalid" });
    handleChallengeVote(state, { type: "CHALLENGE_VOTE", playerId: losers[2], vote: "valid" });

    // 4th vote triggers resolution: 2 invalid + 2 valid → upheld (valid ≥ 2)
    const result = handleChallengeVote(state, {
      type: "CHALLENGE_VOTE",
      playerId: winnerId,
      vote: "valid",
    });

    expect(result.resolved).toMatchObject({
      type: "CHALLENGE_RESOLVED",
      outcome: "upheld",
    });
    expect(state.challengeState).toBeNull();
  });

  test("scoring reversal: all payment amounts negated correctly", () => {
    const { state, losers } = setupScoreboardWithWinner();

    // Record original payments
    const originalResult = state.gameResult as unknown as MahjongGameResult;
    const originalPayments = { ...originalResult.payments };

    handleChallengeMahjong(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });
    handleChallengeVote(state, { type: "CHALLENGE_VOTE", playerId: losers[1], vote: "invalid" });
    handleChallengeVote(state, { type: "CHALLENGE_VOTE", playerId: losers[2], vote: "invalid" });

    // Overturned — check scores are reversed to 0
    for (const [playerId] of Object.entries(originalPayments)) {
      // Original score was reversed by negation, so net = 0
      expect(state.scores[playerId]).toBe(0);
    }
  });

  test("game phase transitions: overturned → back to play, upheld → stays scoreboard", () => {
    // Overturned case
    const overturnState = setupScoreboardWithWinner();
    handleChallengeMahjong(overturnState.state, {
      type: "CHALLENGE_MAHJONG",
      playerId: overturnState.losers[0],
    });
    handleChallengeVote(overturnState.state, {
      type: "CHALLENGE_VOTE",
      playerId: overturnState.losers[1],
      vote: "invalid",
    });
    handleChallengeVote(overturnState.state, {
      type: "CHALLENGE_VOTE",
      playerId: overturnState.losers[2],
      vote: "invalid",
    });
    expect(overturnState.state.gamePhase).toBe("play");

    // Upheld case
    const upheldState = setupScoreboardWithWinner();
    handleChallengeMahjong(upheldState.state, {
      type: "CHALLENGE_MAHJONG",
      playerId: upheldState.losers[0],
    });
    handleChallengeVote(upheldState.state, {
      type: "CHALLENGE_VOTE",
      playerId: upheldState.losers[1],
      vote: "valid",
    });
    handleChallengeVote(upheldState.state, {
      type: "CHALLENGE_VOTE",
      playerId: upheldState.winnerId,
      vote: "valid",
    });
    expect(upheldState.state.gamePhase).toBe("scoreboard");
  });

  test("no active challenge → vote rejected", () => {
    const state = createPlayState();
    const eastId = getPlayerBySeat(state, "east");

    const result = handleChallengeVote(state, {
      type: "CHALLENGE_VOTE",
      playerId: eastId,
      vote: "valid",
    });

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe("NO_ACTIVE_CHALLENGE");
  });
});

/** Set up a scoreboard state with a valid discard Mahjong winner (east discards, south wins) */
function setupDiscardMahjongScoreboard(): {
  state: GameState;
  winnerId: string;
  discarderId: string;
  calledTile: Tile;
  losers: string[];
} {
  const state = createPlayState();
  const eastId = getPlayerBySeat(state, "east");
  const southId = getPlayerBySeat(state, "south");

  // Build a valid 14-tile hand for ev-2 pattern
  const fullHand = buildTilesForHand(card, "ev-2", { A: "bam", B: "crak", C: "dot" });
  const calledTile = fullHand[0]; // The tile that east will discard and south calls
  const southRack = fullHand.slice(1); // 13 tiles in south's rack

  // Clear south's rack and inject the 13 tiles
  state.players[southId].rack.length = 0;
  injectTilesIntoRack(state, southId, southRack);

  // Put the called tile in east's discard pool (simulating east discarded it)
  state.players[eastId].discardPool.push(calledTile);

  // Set up call window in confirming state for south's mahjong call
  state.callWindow = {
    status: "confirming" as const,
    discardedTile: calledTile,
    discarderId: eastId,
    passes: [eastId],
    calls: [],
    openedAt: Date.now(),
    confirmingPlayerId: southId,
    confirmationExpiresAt: Date.now() + 5000,
    remainingCallers: [],
    winningCall: { callType: "mahjong", playerId: southId, tileIds: [] },
  };

  // Confirm the mahjong call (this removes the tile from east's discard pool)
  const result = handleAction(state, {
    type: "CONFIRM_CALL",
    playerId: southId,
    tileIds: [],
  });
  if (!result.accepted || result.resolved?.type !== "MAHJONG_DECLARED") {
    throw new Error(`Expected MAHJONG_DECLARED but got: ${JSON.stringify(result)}`);
  }

  const losers = Object.keys(state.players).filter((id) => id !== southId);
  return { state, winnerId: southId, discarderId: eastId, calledTile, losers };
}

describe("Challenge overturn restores called discard tile", () => {
  test("overturned discard Mahjong restores called tile to discarder's pool", () => {
    const { state, winnerId, discarderId, calledTile, losers } = setupDiscardMahjongScoreboard();

    // Verify the tile is NOT in discarder's pool after mahjong confirmation
    expect(
      state.players[discarderId].discardPool.find((t) => t.id === calledTile.id),
    ).toBeUndefined();

    // Initiate challenge and overturn with 3 invalid votes
    handleChallengeMahjong(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });
    handleChallengeVote(state, { type: "CHALLENGE_VOTE", playerId: losers[1], vote: "invalid" });
    const result = handleChallengeVote(state, {
      type: "CHALLENGE_VOTE",
      playerId: losers[2],
      vote: "invalid",
    });

    expect(result.resolved).toMatchObject({ type: "CHALLENGE_RESOLVED", outcome: "overturned" });

    // Verify called tile is restored to discarder's discard pool
    const restoredTile = state.players[discarderId].discardPool.find((t) => t.id === calledTile.id);
    expect(restoredTile).toBeDefined();
    expect(restoredTile!.id).toBe(calledTile.id);
  });

  test("overturned discard Mahjong removes called tile from winner's rack", () => {
    const { state, winnerId, losers, calledTile } = setupDiscardMahjongScoreboard();

    // The called tile is conceptually part of the winner's hand (saved in gameResult)
    // After overturn, it should not be in the winner's rack
    handleChallengeMahjong(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });
    handleChallengeVote(state, { type: "CHALLENGE_VOTE", playerId: losers[1], vote: "invalid" });
    handleChallengeVote(state, { type: "CHALLENGE_VOTE", playerId: losers[2], vote: "invalid" });

    // Verify called tile is NOT in winner's rack
    expect(state.players[winnerId].rack.find((t) => t.id === calledTile.id)).toBeUndefined();
  });

  test("upheld discard Mahjong does NOT restore called tile to discarder's pool", () => {
    const { state, winnerId, discarderId, calledTile, losers } = setupDiscardMahjongScoreboard();

    handleChallengeMahjong(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });
    handleChallengeVote(state, { type: "CHALLENGE_VOTE", playerId: losers[1], vote: "valid" });
    const result = handleChallengeVote(state, {
      type: "CHALLENGE_VOTE",
      playerId: winnerId,
      vote: "valid",
    });

    expect(result.resolved).toMatchObject({ type: "CHALLENGE_RESOLVED", outcome: "upheld" });

    // Tile should NOT reappear in discarder's pool
    expect(
      state.players[discarderId].discardPool.find((t) => t.id === calledTile.id),
    ).toBeUndefined();
  });

  test("self-drawn Mahjong overturn does not attempt tile restoration", () => {
    // Self-drawn mahjong has no calledTile — should not error
    const { state, winnerId, losers } = setupScoreboardWithWinner();

    handleChallengeMahjong(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });
    handleChallengeVote(state, { type: "CHALLENGE_VOTE", playerId: losers[1], vote: "invalid" });
    const result = handleChallengeVote(state, {
      type: "CHALLENGE_VOTE",
      playerId: losers[2],
      vote: "invalid",
    });

    expect(result.resolved).toMatchObject({ type: "CHALLENGE_RESOLVED", outcome: "overturned" });
    expect(state.gamePhase).toBe("play");
  });
});

describe("Challenge game engine dispatcher", () => {
  test("CHALLENGE_MAHJONG dispatched correctly", () => {
    const { state, losers } = setupScoreboardWithWinner();

    const result = handleAction(state, {
      type: "CHALLENGE_MAHJONG",
      playerId: losers[0],
    });

    expect(result.accepted).toBe(true);
    expect(result.resolved).toMatchObject({ type: "CHALLENGE_INITIATED" });
  });

  test("CHALLENGE_VOTE dispatched correctly", () => {
    const { state, losers } = setupScoreboardWithWinner();
    handleAction(state, { type: "CHALLENGE_MAHJONG", playerId: losers[0] });

    const result = handleAction(state, {
      type: "CHALLENGE_VOTE",
      playerId: losers[1],
      vote: "valid",
    });

    expect(result.accepted).toBe(true);
  });
});
