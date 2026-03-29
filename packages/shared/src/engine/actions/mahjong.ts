import type {
  GameState,
  ActionResult,
  MahjongGameResult,
  CallWindowState,
} from "../../types/game-state";
import type {
  DeclareMahjongAction,
  CancelMahjongAction,
  ConfirmInvalidMahjongAction,
} from "../../types/actions";
import { validateHandWithExposure } from "../../card/exposure-validation";
import { calculatePayments } from "../scoring";
import { handleRetraction } from "./call-window";

/** Deep copy a CallWindowState for safe preservation across state mutations */
function deepCopyCallWindow(cw: CallWindowState): CallWindowState {
  return {
    ...cw,
    passes: [...cw.passes],
    calls: cw.calls.map((c) => ({ ...c, tileIds: [...c.tileIds] })),
    remainingCallers: cw.remainingCallers.map((c) => ({ ...c, tileIds: [...c.tileIds] })),
    winningCall: cw.winningCall
      ? { ...cw.winningCall, tileIds: [...cw.winningCall.tileIds] }
      : null,
  };
}

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

  // Dead hand check — dead hand players cannot declare Mahjong
  if (player.deadHand) {
    return { accepted: false, reason: "DEAD_HAND" };
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
    // Return warning instead of rejection — player can cancel or confirm (dead hand)
    state.pendingMahjong = {
      playerId: action.playerId,
      path: "self-drawn",
      previousTurnPhase: state.turnPhase,
      previousCallWindow: null,
    };
    return {
      accepted: true,
      resolved: {
        type: "INVALID_MAHJONG_WARNING",
        playerId: action.playerId,
        reason: "INVALID_HAND",
      },
    };
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
    // Return warning instead of rejection — player can cancel or confirm (dead hand)
    // Preserve call window state for cancel restore (do NOT clear it)
    state.pendingMahjong = {
      playerId: callerId,
      path: "discard",
      previousTurnPhase: state.turnPhase,
      previousCallWindow: state.callWindow ? deepCopyCallWindow(state.callWindow) : null,
    };
    return {
      accepted: true,
      resolved: { type: "INVALID_MAHJONG_WARNING", playerId: callerId, reason: "INVALID_HAND" },
    };
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
    calledTile,
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

/**
 * Handle CANCEL_MAHJONG action: withdraw an invalid Mahjong declaration with no penalty.
 * Restores game state to before the declaration.
 * Follows validate-then-mutate pattern.
 */
export function handleCancelMahjong(state: GameState, action: CancelMahjongAction): ActionResult {
  if (!state.pendingMahjong) {
    return { accepted: false, reason: "NO_PENDING_MAHJONG" };
  }
  if (state.pendingMahjong.playerId !== action.playerId) {
    return { accepted: false, reason: "NOT_DECLARING_PLAYER" };
  }

  const { path, previousTurnPhase, previousCallWindow } = state.pendingMahjong;
  const playerId = action.playerId;

  // Clear pending state before path-specific logic
  state.pendingMahjong = null;

  if (path === "self-drawn") {
    // Restore turn phase — player continues their turn (can discard)
    state.turnPhase = previousTurnPhase;
    return {
      accepted: true,
      resolved: { type: "MAHJONG_CANCELLED", playerId },
    };
  }

  // Discard path — restore call window and trigger retraction flow
  state.callWindow = previousCallWindow;
  return handleRetraction(state, "MAHJONG_CANCELLED");
}

/**
 * Handle CONFIRM_INVALID_MAHJONG action: player confirms their invalid declaration,
 * enforcing a dead hand (player can no longer win or call discards).
 * Follows validate-then-mutate pattern.
 */
export function handleConfirmInvalidMahjong(
  state: GameState,
  action: ConfirmInvalidMahjongAction,
): ActionResult {
  if (!state.pendingMahjong) {
    return { accepted: false, reason: "NO_PENDING_MAHJONG" };
  }
  if (state.pendingMahjong.playerId !== action.playerId) {
    return { accepted: false, reason: "NOT_DECLARING_PLAYER" };
  }

  const { path, previousTurnPhase, previousCallWindow } = state.pendingMahjong;
  const playerId = action.playerId;

  // Enforce dead hand and clear pending state before path-specific logic
  state.players[playerId].deadHand = true;
  state.pendingMahjong = null;

  if (path === "self-drawn") {
    // Restore turn phase — player must discard
    state.turnPhase = previousTurnPhase;
    return {
      accepted: true,
      resolved: { type: "DEAD_HAND_ENFORCED", playerId, reason: "CONFIRMED_INVALID_DECLARATION" },
    };
  }

  // Discard path — restore call window and trigger retraction flow
  state.callWindow = previousCallWindow;
  return handleRetraction(state, "DEAD_HAND_ENFORCED");
}
