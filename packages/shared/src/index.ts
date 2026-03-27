// Types
export type {
  Tile,
  TileId,
  TileSuit,
  TileCategory,
  TileValue,
  WindValue,
  DragonValue,
  FlowerValue,
  SuitedTile,
  WindTile,
  DragonTile,
  FlowerTile,
  JokerTile,
} from './types/tiles'

export type {
  GameState,
  GamePhase,
  TurnPhase,
  SeatWind,
  PlayerState,
  ExposedGroup,
  ActionResult,
  ResolvedAction,
  WallGameResult,
  GameResult,
} from './types/game-state'

export type {
  GameAction,
  StartGameAction,
  DrawTileAction,
  DiscardTileAction,
} from './types/actions'

// Constants
export {
  TILE_COUNT,
  JOKER_COUNT,
  COPIES_PER_TILE,
  COPIES_PER_FLOWER,
  MAX_PLAYERS,
  SEATS,
  SUITS,
  WINDS,
  DRAGONS,
  FLOWERS,
  TILE_VALUES,
} from './constants'

// Engine
export { createAllTiles, createWall } from './engine/state/wall'
export { dealTiles } from './engine/state/dealing'
export { createGame } from './engine/state/create-game'
export { createLobbyState, handleAction } from './engine/game-engine'
export { handleDrawTile, advanceTurn } from './engine/actions/draw'
export { handleDiscardTile } from './engine/actions/discard'
