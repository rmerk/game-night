import { describe, test, expect } from "vite-plus/test";
import { handleChallengeMahjong, handleChallengeVote } from "./challenge";
import { handleDeclareMahjong } from "./mahjong";
import { handleAction } from "../game-engine";
import { createPlayState } from "../../testing/fixtures";
import { getPlayerBySeat, injectTilesIntoRack } from "../../testing/helpers";
import { buildTilesForHand } from "../../testing/tile-builders";
import { loadCard } from "../../card/card-loader";
import type { GameState, MahjongGameResult } from "../../types/game-state";

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
