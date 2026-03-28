import type { GameState, ActionResult } from "../../types/game-state";
import type { PassCallAction } from "../../types/actions";
import { MAX_PLAYERS, SEATS } from "../../constants";

/**
 * Handle PASS_CALL action: validate call window state, then record the pass.
 * If all players have passed, closes the call window via closeCallWindow.
 * Follows validate-then-mutate pattern.
 */
export function handlePassCall(state: GameState, action: PassCallAction): ActionResult {
  // 1. Validate — no mutations above this line
  if (state.gamePhase !== "play") {
    return { accepted: false, reason: "WRONG_PHASE" };
  }
  if (!state.callWindow) {
    return { accepted: false, reason: "NO_CALL_WINDOW" };
  }
  if (state.callWindow.status !== "open") {
    return { accepted: false, reason: "CALL_WINDOW_NOT_OPEN" };
  }
  if (state.callWindow.discarderId === action.playerId) {
    return { accepted: false, reason: "DISCARDER_CANNOT_CALL" };
  }
  if (state.callWindow.passes.includes(action.playerId)) {
    return { accepted: false, reason: "ALREADY_PASSED" };
  }

  // 2. Mutate — only reached if all validation passed
  state.callWindow.passes.push(action.playerId);

  // 3. Check for early close — all 4 players (including auto-passed discarder) have passed
  if (state.callWindow.passes.length === MAX_PLAYERS) {
    return closeCallWindow(state, "all_passed");
  }

  // 4. Return result — window still open
  return {
    accepted: true,
    resolved: { type: "PASS_CALL", playerId: action.playerId },
  };
}

/**
 * Close the call window and advance the turn to the next player counterclockwise
 * from the discarder. If the wall is empty and no calls were made, end as wall game.
 */
export function closeCallWindow(
  state: GameState,
  reason: "all_passed" | "timer_expired",
): ActionResult {
  if (!state.callWindow) {
    return { accepted: false, reason: "NO_CALL_WINDOW" };
  }

  const discarderId = state.callWindow.discarderId;

  // Clear call window
  state.callWindow = null;

  // Check for wall game — wall empty and no calls resolved
  if (state.wall.length === 0) {
    state.gamePhase = "scoreboard";
    state.gameResult = { winnerId: null, points: 0 };
    return {
      accepted: true,
      resolved: { type: "WALL_GAME" },
    };
  }

  // Advance turn to next player counterclockwise from the discarder
  const discarder = state.players[discarderId];
  if (!discarder)
    throw new Error(`closeCallWindow: no player found for discarderId '${discarderId}'`);
  const discarderSeatIndex = SEATS.indexOf(discarder.seatWind);
  const nextSeatWind = SEATS[(discarderSeatIndex + 1) % SEATS.length];

  const nextPlayer = Object.values(state.players).find((p) => p.seatWind === nextSeatWind);
  if (!nextPlayer)
    throw new Error(`closeCallWindow: no player found with seatWind '${nextSeatWind}'`);
  state.currentTurn = nextPlayer.id;
  state.turnPhase = "draw";

  return {
    accepted: true,
    resolved: { type: "CALL_WINDOW_CLOSED", reason },
  };
}
