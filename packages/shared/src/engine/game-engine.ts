import type { GameState, ActionResult } from "../types/game-state";
import type { GameAction } from "../types/actions";
import { handleStartGame } from "./actions/game-flow";
import { handleDrawTile } from "./actions/draw";
import { handleDiscardTile } from "./actions/discard";
import {
  handlePassCall,
  handleCallAction,
  handleCallMahjong,
  handleConfirmCall,
  handleRetractCall,
} from "./actions/call-window";
import { handleDeclareMahjong } from "./actions/mahjong";

/**
 * Create a lobby-state GameState suitable for receiving a START_GAME action.
 */
export function createLobbyState(): GameState {
  return {
    gamePhase: "lobby",
    players: {},
    wall: [],
    wallRemaining: 0,
    currentTurn: "",
    turnPhase: "draw",
    lastDiscard: null,
    callWindow: null,
    scores: {},
    gameResult: null,
    card: null,
  };
}

/**
 * Process a game action against the current state.
 * Dispatches to the appropriate action handler based on action type.
 * Follows validate-then-mutate pattern: state is only modified if action is accepted.
 */
export function handleAction(state: GameState, action: GameAction): ActionResult {
  switch (action.type) {
    case "START_GAME":
      return handleStartGame(state, action);
    case "DRAW_TILE":
      return handleDrawTile(state, action);
    case "DISCARD_TILE":
      return handleDiscardTile(state, action);
    case "PASS_CALL":
      return handlePassCall(state, action);
    case "CALL_PUNG":
      return handleCallAction(state, action, "pung");
    case "CALL_KONG":
      return handleCallAction(state, action, "kong");
    case "CALL_QUINT":
      return handleCallAction(state, action, "quint");
    case "CALL_NEWS":
      return handleCallAction(state, action, "news");
    case "CALL_DRAGON_SET":
      return handleCallAction(state, action, "dragon_set");
    case "CALL_MAHJONG":
      return handleCallMahjong(state, action);
    case "CONFIRM_CALL":
      return handleConfirmCall(state, action);
    case "RETRACT_CALL":
      return handleRetractCall(state, action);
    case "DECLARE_MAHJONG":
      return handleDeclareMahjong(state, action);
    default: {
      const _exhaustive: never = action;
      return { accepted: false, reason: `UNKNOWN_ACTION: ${(_exhaustive as GameAction).type}` };
    }
  }
}
