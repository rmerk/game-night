import type { Tile } from "../../types/tiles";
import {
  SUITS,
  TILE_VALUES,
  WINDS,
  DRAGONS,
  FLOWERS,
  COPIES_PER_TILE,
  COPIES_PER_FLOWER,
  JOKER_COUNT,
} from "../../constants";

/**
 * Mulberry32 seeded PRNG — lightweight, deterministic, good distribution.
 * Returns a function that produces numbers in [0, 1).
 */
function mulberry32(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle using a provided random function.
 * Mutates the array in place and returns it.
 */
function shuffle<T>(array: T[], random: () => number): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const temp = array[i];
    array[i] = array[j]!;
    array[j] = temp;
  }
  return array;
}

/** Create all 152 tiles in a deterministic (unshuffled) order. */
export function createAllTiles(): Tile[] {
  const tiles: Tile[] = [];

  // 108 suited tiles: 3 suits x 9 values x 4 copies
  for (const suit of SUITS) {
    for (const value of TILE_VALUES) {
      for (let copy = 1; copy <= COPIES_PER_TILE; copy++) {
        tiles.push({
          id: `${suit}-${value}-${copy}`,
          category: "suited",
          suit,
          value,
          copy,
        });
      }
    }
  }

  // 16 wind tiles: 4 directions x 4 copies
  for (const wind of WINDS) {
    for (let copy = 1; copy <= COPIES_PER_TILE; copy++) {
      tiles.push({
        id: `wind-${wind}-${copy}`,
        category: "wind",
        value: wind,
        copy,
      });
    }
  }

  // 12 dragon tiles: 3 types x 4 copies
  for (const dragon of DRAGONS) {
    for (let copy = 1; copy <= COPIES_PER_TILE; copy++) {
      tiles.push({
        id: `dragon-${dragon}-${copy}`,
        category: "dragon",
        value: dragon,
        copy,
      });
    }
  }

  // 8 flower tiles: 2 types x 4 copies
  for (const flower of FLOWERS) {
    for (let copy = 1; copy <= COPIES_PER_FLOWER; copy++) {
      tiles.push({
        id: `flower-${flower}-${copy}`,
        category: "flower",
        value: flower,
        copy,
      });
    }
  }

  // 8 joker tiles
  for (let copy = 1; copy <= JOKER_COUNT; copy++) {
    tiles.push({
      id: `joker-${copy}`,
      category: "joker",
      copy,
    });
  }

  return tiles;
}

/**
 * Create a shuffled wall of 152 tiles.
 * @param seed - Optional seed for deterministic shuffle (for tests). If omitted, uses Math.random().
 */
export function createWall(seed?: number): Tile[] {
  const tiles = createAllTiles();
  const actualSeed = seed ?? Math.floor(Math.random() * 0xffffffff);
  const random = mulberry32(actualSeed);
  return shuffle(tiles, random);
}
