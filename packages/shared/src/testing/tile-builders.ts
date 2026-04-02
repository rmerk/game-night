import type {
  Tile,
  SuitedTile,
  WindTile,
  DragonTile,
  FlowerTile,
  JokerTile,
  TileSuit,
  TileValue,
  WindValue,
  DragonValue,
  FlowerValue,
} from "../types/tiles";
import type { NMJLCard } from "../types/card";
import { GROUP_SIZES } from "../constants";

/** Create a suited tile for testing */
export function suitedTile(suit: TileSuit, value: TileValue, copy: number = 1): SuitedTile {
  return { id: `${suit}-${value}-${copy}`, category: "suited", suit, value, copy };
}

/** Create a wind tile for testing */
export function windTile(value: WindValue, copy: number = 1): WindTile {
  return { id: `wind-${value}-${copy}`, category: "wind", value, copy };
}

/** Create a dragon tile for testing */
export function dragonTile(value: DragonValue, copy: number = 1): DragonTile {
  return { id: `dragon-${value}-${copy}`, category: "dragon", value, copy };
}

/** Create a flower tile for testing */
export function flowerTile(value: FlowerValue, copy: number = 1): FlowerTile {
  return { id: `flower-${value}-${copy}`, category: "flower", value, copy };
}

/** Create a joker tile for testing */
export function jokerTile(copy: number = 1): JokerTile {
  return { id: `joker-${copy}`, category: "joker", copy };
}

/** Abstract NMJL suit colors on the card → concrete suits (full A/B/C mapping). */
export type SuitMapping = Record<"A" | "B" | "C", TileSuit>;

const DEFAULT_SUIT_MAPPING: SuitMapping = { A: "bam", B: "crak", C: "dot" };

const CATEGORY_POOL: Record<string, string[]> = {
  dragon: ["red", "green", "soap"],
  wind: ["north", "east", "west", "south"],
  flower: ["a", "b"],
};

function asWindValue(s: string): WindValue {
  if (s === "north" || s === "east" || s === "west" || s === "south") {
    return s;
  }
  throw new Error(`Invalid wind value: ${s}`);
}

function asDragonValue(s: string): DragonValue {
  if (s === "red" || s === "green" || s === "soap") {
    return s;
  }
  throw new Error(`Invalid dragon value: ${s}`);
}

function asFlowerValue(s: string): FlowerValue {
  if (s === "a" || s === "b") {
    return s;
  }
  throw new Error(`Invalid flower value: ${s}`);
}

function asTileValue(n: number): TileValue {
  switch (n) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
    case 9:
      return n;
    default:
      throw new Error(`Invalid suited tile value: ${n}`);
  }
}

/**
 * Build a valid 14-tile array for a given hand pattern from the NMJL card.
 * Resolves abstract colors (A/B/C) to concrete suits via suitMapping,
 * wildcard values (N/N+1/N+2) via nValue, and auto-assigns Jokers when
 * a tile's copy count exceeds 4.
 */
export function buildTilesForHand(
  card: NMJLCard,
  handId: string,
  suitMapping: SuitMapping = DEFAULT_SUIT_MAPPING,
  nValue = 1,
): Tile[] {
  const allHands = card.categories.flatMap((c) => c.hands);
  const hand = allHands.find((h) => h.id === handId);
  if (!hand) throw new Error(`Hand ${handId} not found`);
  const tiles: Tile[] = [];
  let jokerCopy = 1;
  const copyCounters = new Map<string, number>();
  const anyPicks = new Map<string, string[]>();

  function nextCopy(key: string): number {
    const current = copyCounters.get(key) ?? 0;
    const next = current + 1;
    copyCounters.set(key, next);
    return next;
  }

  function resolveSpecific(category: string, specific: string | undefined): string {
    const pool = CATEGORY_POOL[category];
    if (!pool) throw new Error(`Unknown category: ${category}`);
    if (!specific || specific === "any") {
      const picks = anyPicks.get(category) ?? [];
      if (picks.length === 0) {
        picks.push(pool[0]);
        anyPicks.set(category, picks);
      }
      return picks[0];
    }
    if (specific.startsWith("any_different:")) {
      const n = parseInt(specific.split(":")[1]);
      const picks = anyPicks.get(category) ?? [];
      while (picks.length < n) {
        picks.push(pool[picks.length]);
        anyPicks.set(category, picks);
      }
      return picks[n - 1];
    }
    return specific;
  }

  function resolveValue(value: number | string | undefined): number {
    if (typeof value === "number") return value;
    if (value === undefined) {
      throw new Error("Suited tile requires value (expected 1–9, N, N+1, or N+2)");
    }
    if (value === "N") return nValue;
    if (value === "N+1") return nValue + 1;
    if (value === "N+2") return nValue + 2;
    throw new Error(`Unexpected suited tile value: ${JSON.stringify(value)}`);
  }

  function resolveSuit(color: string): TileSuit {
    if (color === "A" || color === "B" || color === "C") {
      return suitMapping[color];
    }
    return "bam";
  }

  function pushTile(tileKey: string, builder: (copy: number) => Tile): void {
    const copy = nextCopy(tileKey);
    if (copy > 4) {
      tiles.push(jokerTile(jokerCopy));
      jokerCopy++;
    } else {
      tiles.push(builder(copy));
    }
  }

  for (const group of hand.groups) {
    const size = GROUP_SIZES[group.type];
    if (group.type === "news") {
      for (const w of ["north", "east", "west", "south"] as const) {
        pushTile(`wind-${w}`, (copy) => ({
          id: `wind-${w}-${copy}`,
          category: "wind",
          value: w,
          copy,
        }));
      }
      continue;
    }
    if (group.type === "dragon_set") {
      for (const d of ["red", "green", "soap"] as const) {
        pushTile(`dragon-${d}`, (copy) => ({
          id: `dragon-${d}-${copy}`,
          category: "dragon",
          value: d,
          copy,
        }));
      }
      continue;
    }
    if (!group.tile) continue;
    for (let i = 0; i < size; i++) {
      if (group.tile.category) {
        const specific = resolveSpecific(group.tile.category, group.tile.specific);
        const tileKey = `${group.tile.category}-${specific}`;
        const cat = group.tile.category;
        pushTile(tileKey, (copy) => {
          if (cat === "wind") {
            const value = asWindValue(specific);
            return {
              id: `wind-${value}-${copy}`,
              category: "wind",
              value,
              copy,
            };
          }
          if (cat === "dragon") {
            const value = asDragonValue(specific);
            return {
              id: `dragon-${value}-${copy}`,
              category: "dragon",
              value,
              copy,
            };
          }
          const value = asFlowerValue(specific);
          return {
            id: `flower-${value}-${copy}`,
            category: "flower",
            value,
            copy,
          };
        });
      } else if (group.tile.color) {
        const suit = resolveSuit(group.tile.color);
        const value = asTileValue(resolveValue(group.tile.value));
        const tileKey = `${suit}-${value}`;
        pushTile(tileKey, (copy) => ({
          id: `${suit}-${value}-${copy}`,
          category: "suited" as const,
          suit,
          value,
          copy,
        }));
      }
    }
  }
  return tiles;
}
