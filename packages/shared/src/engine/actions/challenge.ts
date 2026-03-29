import type { GameState, ActionResult, MahjongGameResult } from "../../types/game-state";
import type { ChallengeMahjongAction, ChallengeVoteAction } from "../../types/actions";
import { CHALLENGE_TIMEOUT_SECONDS } from "../../types/game-state";
import { MAX_PLAYERS, SEATS } from "../../constants";

/**
 * Handle CHALLENGE_MAHJONG action: initiate a challenge vote on a validated Mahjong.
 * Only available during scoreboard phase after a Mahjong win. Winner cannot challenge themselves.
 * Follows validate-then-mutate pattern.
 */
export function handleChallengeMahjong(
  state: GameState,
  action: ChallengeMahjongAction,
): ActionResult {
  if (state.gamePhase !== "scoreboard") {
    return { accepted: false, reason: "WRONG_PHASE" };
  }
  if (!state.gameResult) {
    return { accepted: false, reason: "NO_GAME_RESULT" };
  }
  if (state.gameResult.winnerId === null) {
    return { accepted: false, reason: "WALL_GAME_NO_CHALLENGE" };
  }
  if (state.gameResult.winnerId === action.playerId) {
    return { accepted: false, reason: "WINNER_CANNOT_CHALLENGE" };
  }
  if (state.challengeState !== null) {
    return { accepted: false, reason: "CHALLENGE_ALREADY_ACTIVE" };
  }
  if (!state.players[action.playerId]) {
    return { accepted: false, reason: "PLAYER_NOT_FOUND" };
  }

  const winnerId = state.gameResult.winnerId;
  const gameResult = state.gameResult;

  state.challengeState = {
    challengerId: action.playerId,
    winnerId,
    votes: { [action.playerId]: "invalid" },
    challengeExpiresAt: Date.now() + CHALLENGE_TIMEOUT_SECONDS * 1000,
    originalGameResult: gameResult,
    calledTile: gameResult.calledTile ?? null,
  };

  return {
    accepted: true,
    resolved: { type: "CHALLENGE_INITIATED", challengerId: action.playerId, winnerId },
  };
}

/**
 * Handle CHALLENGE_VOTE action: cast a vote on an active challenge.
 * When all 4 players have voted, resolves immediately.
 * 3+ invalid votes → overturn (dead hand, reverse scoring, back to play).
 * 2+ valid votes → uphold (challenge cleared, game stays on scoreboard).
 * Follows validate-then-mutate pattern.
 */
export function handleChallengeVote(state: GameState, action: ChallengeVoteAction): ActionResult {
  if (!state.challengeState) {
    return { accepted: false, reason: "NO_ACTIVE_CHALLENGE" };
  }
  if (!state.players[action.playerId]) {
    return { accepted: false, reason: "PLAYER_NOT_FOUND" };
  }
  if (state.challengeState.votes[action.playerId] !== undefined) {
    return { accepted: false, reason: "ALREADY_VOTED" };
  }

  state.challengeState.votes[action.playerId] = action.vote;

  const totalVotes = Object.keys(state.challengeState.votes).length;

  // Check if we can resolve (all 4 players voted)
  if (totalVotes === MAX_PLAYERS) {
    return resolveChallenge(state);
  }

  // Early resolution: 3+ invalid guarantees overturn, 2+ valid guarantees uphold
  // (remaining non-voters default to "valid" per AC #7, so 2 valid can never be overturned)
  const invalidCount = Object.values(state.challengeState.votes).filter(
    (v) => v === "invalid",
  ).length;
  const validCount = Object.values(state.challengeState.votes).filter((v) => v === "valid").length;

  if (invalidCount >= 3) {
    return resolveChallenge(state);
  }
  if (validCount >= 2) {
    return resolveChallenge(state);
  }

  return {
    accepted: true,
    resolved: { type: "CHALLENGE_VOTE_CAST", playerId: action.playerId, vote: action.vote },
  };
}

/**
 * Resolve the challenge based on votes.
 * 3+ invalid → overturn: dead hand on winner, reverse scoring, back to play.
 * Otherwise → uphold: challenge cleared.
 */
function resolveChallenge(state: GameState): ActionResult {
  const challenge = state.challengeState!;
  const votes = { ...challenge.votes };

  const invalidCount = Object.values(votes).filter((v) => v === "invalid").length;

  if (invalidCount >= 3) {
    // OVERTURN: dead hand on winner, reverse scoring, back to play
    state.players[challenge.winnerId].deadHand = true;

    // Reverse scoring — negate all payments from the original result
    for (const [playerId, amount] of Object.entries(challenge.originalGameResult.payments)) {
      state.scores[playerId] = (state.scores[playerId] ?? 0) - amount;
    }

    // Restore called tile: return it to the discarder's discard pool and remove from winner's rack
    if (challenge.calledTile && challenge.originalGameResult.discarderId) {
      const discarder = state.players[challenge.originalGameResult.discarderId];
      if (discarder) {
        discarder.discardPool.push(challenge.calledTile);
      }
      const winner = state.players[challenge.winnerId];
      const tileIdx = winner.rack.findIndex((t) => t.id === challenge.calledTile!.id);
      if (tileIdx !== -1) {
        winner.rack.splice(tileIdx, 1);
      }
    }

    // Clear game result and return to play
    state.gameResult = null;
    state.gamePhase = "play";

    // After overturned Mahjong, advance turn to the player AFTER the winner (counterclockwise)
    const winner = state.players[challenge.winnerId];
    const winnerSeatIndex = SEATS.indexOf(winner.seatWind);
    const nextSeatWind = SEATS[(winnerSeatIndex + 1) % SEATS.length];
    const nextPlayer = Object.values(state.players).find((p) => p.seatWind === nextSeatWind);
    if (nextPlayer) {
      state.currentTurn = nextPlayer.id;
      state.turnPhase = "draw";
    }

    state.challengeState = null;

    return {
      accepted: true,
      resolved: { type: "CHALLENGE_RESOLVED", outcome: "overturned", votes },
    };
  }

  // UPHOLD: challenge cleared, game remains on scoreboard
  state.challengeState = null;

  return {
    accepted: true,
    resolved: { type: "CHALLENGE_RESOLVED", outcome: "upheld", votes },
  };
}
