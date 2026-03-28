/** Discriminated union of all game actions */
export type GameAction = StartGameAction | DrawTileAction | DiscardTileAction | PassCallAction;

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
