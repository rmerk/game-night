/** Total tiles in an American Mahjong set */
export const TILE_COUNT = 152;

/** Number of Joker tiles */
export const JOKER_COUNT = 8;

/** Number of copies per regular tile (suited, wind, dragon) */
export const COPIES_PER_TILE = 4;

/** Number of copies per flower type */
export const COPIES_PER_FLOWER = 4;

/** Maximum players in a game */
export const MAX_PLAYERS = 4;

/** Seat wind assignments in play order (counterclockwise) */
export const SEATS = ["east", "south", "west", "north"] as const;

/** All tile suits */
export const SUITS = ["bam", "crak", "dot"] as const;

/** All wind directions */
export const WINDS = ["north", "east", "west", "south"] as const;

/** All dragon types */
export const DRAGONS = ["red", "green", "soap"] as const;

/** All flower types */
export const FLOWERS = ["a", "b"] as const;

/** Suited tile values */
export const TILE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** All valid group types for hand patterns */
export const GROUP_TYPES = [
  "single",
  "pair",
  "pung",
  "kong",
  "quint",
  "sextet",
  "news",
  "dragon_set",
] as const;

/** Default call window duration in milliseconds */
export const DEFAULT_CALL_WINDOW_MS = 5000;

/** Minimum call window duration in milliseconds */
export const MIN_CALL_WINDOW_MS = 3000;

/** Maximum call window duration in milliseconds */
export const MAX_CALL_WINDOW_MS = 5000;

/** Number of tiles each group type contributes to a hand */
export const GROUP_SIZES: Record<(typeof GROUP_TYPES)[number], number> = {
  single: 1,
  pair: 2,
  pung: 3,
  kong: 4,
  quint: 5,
  sextet: 6,
  news: 4,
  dragon_set: 3,
};

/** Wall counter: remaining tiles at or below this value use warning styling (client HUD). */
export const WALL_WARNING_THRESHOLD = 20;

/** Wall counter: remaining tiles at or below this value use critical styling (client HUD). */
export const WALL_CRITICAL_THRESHOLD = 10;
