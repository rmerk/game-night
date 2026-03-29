import type { GameState, ActionResult } from "../../types/game-state";
import type { ShowHandAction } from "../../types/actions";

/**
 * Handle a player voluntarily showing their hand during scoreboard phase.
 * This is the ONLY mechanism where rack data becomes public — and only post-game.
 */
export function handleShowHand(state: GameState, action: ShowHandAction): ActionResult {
  // Validate: scoreboard phase only
  if (state.gamePhase !== "scoreboard") {
    return { accepted: false, reason: "WRONG_PHASE" };
  }

  // Validate: player exists
  const playerState = state.players[action.playerId];
  if (!playerState) {
    return { accepted: false, reason: "PLAYER_NOT_FOUND" };
  }

  // Idempotent — already shown is a no-op (still accepted)
  if (state.shownHands[action.playerId]) {
    return { accepted: true, resolved: { type: "HAND_SHOWN", playerId: action.playerId } };
  }

  // Mutate: copy rack tiles into shownHands
  state.shownHands[action.playerId] = [...playerState.rack];

  return { accepted: true, resolved: { type: "HAND_SHOWN", playerId: action.playerId } };
}
