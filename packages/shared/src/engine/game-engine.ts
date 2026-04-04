import type { GameState, ActionResult } from "../types/game-state";
import type { GameAction } from "../types/actions";
import { handleStartGame } from "./actions/game-flow";
import {
  handleCharlestonPass,
  handleCharlestonVote,
  handleCourtesyPass,
} from "./actions/charleston";
import { handleDrawTile } from "./actions/draw";
import { handleDiscardTile } from "./actions/discard";
import { handleJokerExchange } from "./actions/joker-exchange";
import {
  handlePassCall,
  handleCallAction,
  handleCallMahjong,
  handleConfirmCall,
  handleRetractCall,
} from "./actions/call-window";
import {
  handleDeclareMahjong,
  handleCancelMahjong,
  handleConfirmInvalidMahjong,
} from "./actions/mahjong";
import { handleChallengeMahjong, handleChallengeVote } from "./actions/challenge";
import { handleSocialOverrideRequest, handleSocialOverrideVote } from "./actions/social-override";
import { handleTableTalkReport, handleTableTalkVote } from "./actions/table-talk-report";
import { handleShowHand } from "./actions/show-hand";

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
    pendingMahjong: null,
    challengeState: null,
    socialOverrideState: null,
    tableTalkReportState: null,
    tableTalkReportCountsByPlayerId: {},
    hostAuditLog: [],
    charleston: null,
    shownHands: {},
    jokerRulesMode: "standard",
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
    case "CHARLESTON_PASS":
      return handleCharlestonPass(state, action);
    case "CHARLESTON_VOTE":
      return handleCharlestonVote(state, action);
    case "COURTESY_PASS":
      return handleCourtesyPass(state, action);
    case "DRAW_TILE":
      return handleDrawTile(state, action);
    case "DISCARD_TILE":
      return handleDiscardTile(state, action);
    case "JOKER_EXCHANGE":
      return handleJokerExchange(state, action);
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
    case "CANCEL_MAHJONG":
      return handleCancelMahjong(state, action);
    case "CONFIRM_INVALID_MAHJONG":
      return handleConfirmInvalidMahjong(state, action);
    case "CHALLENGE_MAHJONG":
      return handleChallengeMahjong(state, action);
    case "CHALLENGE_VOTE":
      return handleChallengeVote(state, action);
    case "SOCIAL_OVERRIDE_REQUEST":
      return handleSocialOverrideRequest(state, action);
    case "SOCIAL_OVERRIDE_VOTE":
      return handleSocialOverrideVote(state, action);
    case "TABLE_TALK_REPORT":
      return handleTableTalkReport(state, action);
    case "TABLE_TALK_VOTE":
      return handleTableTalkVote(state, action);
    case "SHOW_HAND":
      return handleShowHand(state, action);
    default: {
      const _exhaustive: never = action;
      return { accepted: false, reason: `UNKNOWN_ACTION: ${(_exhaustive as GameAction).type}` };
    }
  }
}
