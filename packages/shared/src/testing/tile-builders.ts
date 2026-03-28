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

type SuitMapping = Record<string, "bam" | "crak" | "dot">;

const CATEGORY_POOL: Record<string, string[]> = {
  dragon: ["red", "green", "soap"],
  wind: ["north", "east", "west", "south"],
  flower: ["a", "b"],
};

/**
 * Build a valid 14-tile array for a given hand pattern from the NMJL card.
 * Resolves abstract colors (A/B/C) to concrete suits via suitMapping,
 * wildcard values (N/N+1/N+2) via nValue, and auto-assigns Jokers when
 * a tile's copy count exceeds 4.
 */
export function buildTilesForHand(
  card: NMJLCard,
  handId: string,
  suitMapping: SuitMapping = { A: "bam", B: "crak", C: "dot" },
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
    if (value === "N") return nValue;
    if (value === "N+1") return nValue + 1;
    if (value === "N+2") return nValue + 2;
    return 1;
  }

  function pushTile(tileKey: string, builder: (copy: number) => Tile): void {
    const copy = nextCopy(tileKey);
    if (copy > 4) {
      tiles.push({ id: `joker-${jokerCopy}`, category: "joker", copy: jokerCopy } as Tile);
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
          if (cat === "wind")
            return {
              id: `wind-${specific}-${copy}`,
              category: "wind",
              value: specific as WindValue,
              copy,
            };
          if (cat === "dragon")
            return {
              id: `dragon-${specific}-${copy}`,
              category: "dragon",
              value: specific as DragonValue,
              copy,
            };
          return {
            id: `flower-${specific}-${copy}`,
            category: "flower",
            value: specific as FlowerValue,
            copy,
          };
        });
      } else if (group.tile.color) {
        const suit = suitMapping[group.tile.color] ?? "bam";
        const value = resolveValue(group.tile.value);
        const tileKey = `${suit}-${value}`;
        pushTile(tileKey, (copy) => ({
          id: `${suit}-${value}-${copy}`,
          category: "suited" as const,
          suit,
          value: value as TileValue,
          copy,
        }));
      }
    }
  }
  return tiles;
}
