/** Total tiles in an American Mahjong set */
export const TILE_COUNT = 152

/** Number of Joker tiles */
export const JOKER_COUNT = 8

/** Number of copies per regular tile (suited, wind, dragon) */
export const COPIES_PER_TILE = 4

/** Number of copies per flower type */
export const COPIES_PER_FLOWER = 4

/** Maximum players in a game */
export const MAX_PLAYERS = 4

/** Seat wind assignments in play order (counterclockwise) */
export const SEATS = ['east', 'south', 'west', 'north'] as const

/** All tile suits */
export const SUITS = ['bam', 'crak', 'dot'] as const

/** All wind directions */
export const WINDS = ['north', 'east', 'west', 'south'] as const

/** All dragon types */
export const DRAGONS = ['red', 'green', 'soap'] as const

/** All flower types */
export const FLOWERS = ['a', 'b'] as const

/** Suited tile values */
export const TILE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
