/** Discriminated union of all game actions */
export type GameAction =
  | StartGameAction
  | DrawTileAction

/** Action to start a game with 4 players */
export interface StartGameAction {
  readonly type: 'START_GAME'
  readonly playerIds: string[]
  readonly seed?: number
}

/** Action for the current player to draw a tile from the wall */
export interface DrawTileAction {
  readonly type: 'DRAW_TILE'
  readonly playerId: string
}
