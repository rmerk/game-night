import type { SuitedTile, WindTile, DragonTile, FlowerTile, JokerTile, TileSuit, TileValue, WindValue, DragonValue, FlowerValue } from '../types/tiles'

/** Create a suited tile for testing */
export function suitedTile(suit: TileSuit, value: TileValue, copy: number = 1): SuitedTile {
  return { id: `${suit}-${value}-${copy}`, category: 'suited', suit, value, copy }
}

/** Create a wind tile for testing */
export function windTile(value: WindValue, copy: number = 1): WindTile {
  return { id: `wind-${value}-${copy}`, category: 'wind', value, copy }
}

/** Create a dragon tile for testing */
export function dragonTile(value: DragonValue, copy: number = 1): DragonTile {
  return { id: `dragon-${value}-${copy}`, category: 'dragon', value, copy }
}

/** Create a flower tile for testing */
export function flowerTile(value: FlowerValue, copy: number = 1): FlowerTile {
  return { id: `flower-${value}-${copy}`, category: 'flower', value, copy }
}

/** Create a joker tile for testing */
export function jokerTile(copy: number = 1): JokerTile {
  return { id: `joker-${copy}`, category: 'joker', copy }
}
