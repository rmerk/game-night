/** Discriminated union of all game actions */
export type GameAction =
  | StartGameAction
  | DrawTileAction
  | DiscardTileAction
  | PassCallAction
  | CallPungAction
  | CallKongAction
  | CallQuintAction
  | CallNewsAction
  | CallDragonSetAction
  | ConfirmCallAction
  | RetractCallAction;

/** Action to start a game with 4 players */
export interface StartGameAction {
  readonly type: "START_GAME";
  readonly playerIds: string[];
  readonly seed?: number;
}

/** Action for the current player to draw a tile from the wall */
export interface DrawTileAction {
  readonly type: "DRAW_TILE";
  readonly playerId: string;
}

/** Action for the current player to discard a tile from their rack */
export interface DiscardTileAction {
  readonly type: "DISCARD_TILE";
  readonly playerId: string;
  readonly tileId: string;
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
