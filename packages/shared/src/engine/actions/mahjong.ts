import type { GameState, ActionResult, MahjongGameResult } from "../../types/game-state";
import type { DeclareMahjongAction } from "../../types/actions";
import { validateHandWithExposure } from "../../card/exposure-validation";
import { calculatePayments } from "../scoring";

/**
 * Handle DECLARE_MAHJONG action: self-drawn Mahjong path.
 * Player draws from wall, hand completes a pattern, player declares before discarding.
 * Validates hand against NMJL card, calculates scoring, transitions to scoreboard.
 * Follows validate-then-mutate pattern.
 */
export function handleDeclareMahjong(state: GameState, action: DeclareMahjongAction): ActionResult {
  // 1. Validate game state
  if (state.gamePhase !== "play") {
    return { accepted: false, reason: "WRONG_PHASE" };
  }
  if (state.currentTurn !== action.playerId) {
    return { accepted: false, reason: "NOT_YOUR_TURN" };
  }
  if (state.turnPhase !== "discard") {
    return { accepted: false, reason: "MUST_DRAW_FIRST" };
  }
  if (state.callWindow) {
    return { accepted: false, reason: "CALL_WINDOW_ACTIVE" };
  }

  const player = state.players[action.playerId];
  if (!player) {
    return { accepted: false, reason: "PLAYER_NOT_FOUND" };
  }

  // 2. Validate card is available
  if (!state.card) {
    return { accepted: false, reason: "NO_CARD_LOADED" };
  }

  // 3. Validate hand against NMJL card
  // All 14 tiles: rack tiles + tiles in exposed groups (validateHandWithExposure expects the full hand)
  const allTiles = [...player.rack, ...player.exposedGroups.flatMap((g) => g.tiles)];
  const match = validateHandWithExposure(allTiles, player.exposedGroups, state.card);
  if (!match) {
    return { accepted: false, reason: "INVALID_HAND" };
  }

  // 4. Calculate scoring — self-drawn: all 3 losers pay 2x
  const allPlayerIds = Object.keys(state.players);
  const scoringResult = calculatePayments({
    winnerId: action.playerId,
    allPlayerIds,
    points: match.points,
    selfDrawn: true,
  });

  if (!scoringResult.valid) {
    return { accepted: false, reason: "SCORING_ERROR" };
  }

  // 5. Mutate — transition to scoreboard
  state.gamePhase = "scoreboard";
  state.gameResult = {
    winnerId: action.playerId,
    patternId: match.patternId,
    patternName: match.patternName,
    points: match.points,
    selfDrawn: true,
    payments: scoringResult.payments,
  } satisfies MahjongGameResult;

  // Update scores
  for (const [playerId, amount] of Object.entries(scoringResult.payments)) {
    state.scores[playerId] = (state.scores[playerId] ?? 0) + amount;
  }

  return {
    accepted: true,
    resolved: {
      type: "MAHJONG_DECLARED",
      winnerId: action.playerId,
      patternId: match.patternId,
      patternName: match.patternName,
      points: match.points,
      selfDrawn: true,
    },
  };
}

/**
 * Handle Mahjong confirmation after a CALL_MAHJONG wins priority.
 * Called from handleConfirmCall when winningCall.callType === "mahjong".
 * Validates hand (rack + called discard = 14 tiles), calculates discard Mahjong scoring.
 *
 * @returns ActionResult — if invalid, returns rejection for auto-retraction by caller
 */
export function confirmMahjongCall(
  state: GameState,
  callerId: string,
  discarderId: string,
  calledDiscardTileId: string,
): ActionResult {
  const player = state.players[callerId];
  if (!player) {
    return { accepted: false, reason: "PLAYER_NOT_FOUND" };
  }

  if (!state.card) {
    return { accepted: false, reason: "NO_CARD_LOADED" };
  }

  // Build full 14-tile hand: caller's rack + exposed group tiles + called discard
  const calledTile = state.callWindow?.discardedTile;
  if (!calledTile || calledTile.id !== calledDiscardTileId) {
    return { accepted: false, reason: "DISCARD_TILE_MISMATCH" };
  }

  const fullHand = [...player.rack, ...player.exposedGroups.flatMap((g) => g.tiles), calledTile];

  const match = validateHandWithExposure(fullHand, player.exposedGroups, state.card);
  if (!match) {
    return { accepted: false, reason: "INVALID_HAND" };
  }

  // Calculate scoring — discard Mahjong: discarder pays 2x, others 1x
  const allPlayerIds = Object.keys(state.players);
  const scoringResult = calculatePayments({
    winnerId: callerId,
    allPlayerIds,
    points: match.points,
    selfDrawn: false,
    discarderId,
  });

  if (!scoringResult.valid) {
    return { accepted: false, reason: "SCORING_ERROR" };
  }

  // Remove the called tile from the discarder's discard pool
  const discarder = state.players[discarderId];
  if (discarder) {
    const discardIdx = discarder.discardPool.findIndex((t) => t.id === calledDiscardTileId);
    if (discardIdx !== -1) {
      discarder.discardPool.splice(discardIdx, 1);
    }
  }

  // Clear call window before state transition
  state.callWindow = null;

  // Transition to scoreboard
  state.gamePhase = "scoreboard";
  state.gameResult = {
    winnerId: callerId,
    patternId: match.patternId,
    patternName: match.patternName,
    points: match.points,
    selfDrawn: false,
    discarderId,
    payments: scoringResult.payments,
  } satisfies MahjongGameResult;

  // Update scores
  for (const [playerId, amount] of Object.entries(scoringResult.payments)) {
    state.scores[playerId] = (state.scores[playerId] ?? 0) + amount;
  }

  return {
    accepted: true,
    resolved: {
      type: "MAHJONG_DECLARED",
      winnerId: callerId,
      patternId: match.patternId,
      patternName: match.patternName,
      points: match.points,
      selfDrawn: false,
      discarderId,
    },
  };
}
