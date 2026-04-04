import type { JokerRulesMode } from "./game-state";

/** Discriminated union of all game actions */
export type GameAction =
  | StartGameAction
  | CharlestonPassAction
  | CharlestonVoteAction
  | CourtesyPassAction
  | DrawTileAction
  | DiscardTileAction
  | JokerExchangeAction
  | PassCallAction
  | CallPungAction
  | CallKongAction
  | CallQuintAction
  | CallNewsAction
  | CallDragonSetAction
  | CallMahjongAction
  | ConfirmCallAction
  | RetractCallAction
  | DeclareMahjongAction
  | CancelMahjongAction
  | ConfirmInvalidMahjongAction
  | ChallengeMahjongAction
  | ChallengeVoteAction
  | SocialOverrideRequestAction
  | SocialOverrideVoteAction
  | ShowHandAction;

/** Action to start a game with 4 players */
export interface StartGameAction {
  readonly type: "START_GAME";
  readonly playerIds: string[];
  readonly seed?: number;
  /** Server supplies authoritative mode; omitted defaults to standard in engine */
  readonly jokerRulesMode?: JokerRulesMode;
}

/** Action for the current player to draw a tile from the wall */
export interface DrawTileAction {
  readonly type: "DRAW_TILE";
  readonly playerId: string;
}

/** Action for a player to lock in their Charleston pass selection */
export interface CharlestonPassAction {
  readonly type: "CHARLESTON_PASS";
  readonly playerId: string;
  readonly tileIds: readonly string[];
}

/** Action for a player to vote on whether the optional second Charleston should occur */
export interface CharlestonVoteAction {
  readonly type: "CHARLESTON_VOTE";
  readonly playerId: string;
  readonly accept: boolean;
}

/** Action for a player to lock in their courtesy pass count and ordered tile selection */
export interface CourtesyPassAction {
  readonly type: "COURTESY_PASS";
  readonly playerId: string;
  readonly count: number;
  readonly tileIds: readonly string[];
}

/** Action for the current player to discard a tile from their rack */
export interface DiscardTileAction {
  readonly type: "DISCARD_TILE";
  readonly playerId: string;
  readonly tileId: string;
}

/** Action for the current player to exchange a natural tile from their rack for a Joker in an exposed group */
export interface JokerExchangeAction {
  readonly type: "JOKER_EXCHANGE";
  readonly playerId: string;
  readonly jokerGroupId: string;
  readonly naturalTileId: string;
}

/** Action for a player to pass during the call window */
export interface PassCallAction {
  readonly type: "PASS_CALL";
  readonly playerId: string;
}

/** Action for a player to call Pung (3 of a kind) on a discarded tile */
export interface CallPungAction {
  readonly type: "CALL_PUNG";
  readonly playerId: string;
  readonly tileIds: readonly string[];
}

/** Action for a player to call Kong (4 of a kind) on a discarded tile */
export interface CallKongAction {
  readonly type: "CALL_KONG";
  readonly playerId: string;
  readonly tileIds: readonly string[];
}

/** Action for a player to call Quint (5 of a kind) on a discarded tile */
export interface CallQuintAction {
  readonly type: "CALL_QUINT";
  readonly playerId: string;
  readonly tileIds: readonly string[];
}

/** Action for a player to call NEWS (one of each wind) on a discarded wind tile */
export interface CallNewsAction {
  readonly type: "CALL_NEWS";
  readonly playerId: string;
  readonly tileIds: readonly string[];
}

/** Action for a player to call Dragon set (one of each dragon) on a discarded dragon tile */
export interface CallDragonSetAction {
  readonly type: "CALL_DRAGON_SET";
  readonly playerId: string;
  readonly tileIds: readonly string[];
}

/** Action for a player to call Mahjong on a discarded tile during call window */
export interface CallMahjongAction {
  readonly type: "CALL_MAHJONG";
  readonly playerId: string;
  readonly tileIds: readonly string[];
}

/** Action for the current player to declare Mahjong from a self-drawn tile (before discarding) */
export interface DeclareMahjongAction {
  readonly type: "DECLARE_MAHJONG";
  readonly playerId: string;
}

/** Action for the winning caller to confirm their call by exposing tiles */
export interface ConfirmCallAction {
  readonly type: "CONFIRM_CALL";
  readonly playerId: string;
  readonly tileIds: readonly string[];
}

/** Action for the winning caller to retract their call during confirmation phase */
export interface RetractCallAction {
  readonly type: "RETRACT_CALL";
  readonly playerId: string;
}

/** Action to cancel an invalid Mahjong declaration (no penalty) */
export interface CancelMahjongAction {
  readonly type: "CANCEL_MAHJONG";
  readonly playerId: string;
}

/** Action to confirm an invalid Mahjong declaration (enforces dead hand) */
export interface ConfirmInvalidMahjongAction {
  readonly type: "CONFIRM_INVALID_MAHJONG";
  readonly playerId: string;
}

/** Action for a non-winning player to challenge a validated Mahjong */
export interface ChallengeMahjongAction {
  readonly type: "CHALLENGE_MAHJONG";
  readonly playerId: string;
}

/** Action for a player to vote on a challenge (valid or invalid) */
export interface ChallengeVoteAction {
  readonly type: "CHALLENGE_VOTE";
  readonly playerId: string;
  readonly vote: "valid" | "invalid";
}

/** Action for a player to voluntarily show their hand during scoreboard phase */
export interface ShowHandAction {
  readonly type: "SHOW_HAND";
  readonly playerId: string;
}

/** Discarder requests unanimous undo during open call window (no calls yet) */
export interface SocialOverrideRequestAction {
  readonly type: "SOCIAL_OVERRIDE_REQUEST";
  readonly playerId: string;
  readonly description: string;
}

/** Non-requesting player votes on a social override */
export interface SocialOverrideVoteAction {
  readonly type: "SOCIAL_OVERRIDE_VOTE";
  readonly playerId: string;
  readonly approve: boolean;
}
