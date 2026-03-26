/** Tile suit for numbered tiles (1-9) */
export type TileSuit = 'bam' | 'crak' | 'dot'

/** Top-level tile category */
export type TileCategory = 'suited' | 'wind' | 'dragon' | 'flower' | 'joker'

/** Numbered tile values 1-9 */
export type TileValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** Wind directions */
export type WindValue = 'north' | 'east' | 'west' | 'south'

/** Dragon types (White Dragon = Soap in American Mahjong) */
export type DragonValue = 'red' | 'green' | 'soap'

/** Flower types */
export type FlowerValue = 'a' | 'b'

/**
 * Tile ID string — uniquely identifies a single physical tile in the game.
 * Format: `{category}-{value}-{copy}` (e.g., `bam-3-2`, `wind-north-1`, `joker-5`)
 */
export type TileId = string

/** A single Mahjong tile */
export interface SuitedTile {
  readonly id: TileId
  readonly category: 'suited'
  readonly suit: TileSuit
  readonly value: TileValue
  readonly copy: number
}

export interface WindTile {
  readonly id: TileId
  readonly category: 'wind'
  readonly value: WindValue
  readonly copy: number
}

export interface DragonTile {
  readonly id: TileId
  readonly category: 'dragon'
  readonly value: DragonValue
  readonly copy: number
}

export interface FlowerTile {
  readonly id: TileId
  readonly category: 'flower'
  readonly value: FlowerValue
  readonly copy: number
}

export interface JokerTile {
  readonly id: TileId
  readonly category: 'joker'
  readonly copy: number
}

/** Discriminated union of all tile types */
export type Tile = SuitedTile | WindTile | DragonTile | FlowerTile | JokerTile
