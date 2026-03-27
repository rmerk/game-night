import { describe, test, expect } from "vite-plus/test";
import { loadCard } from "../card/card-loader";
import { GROUP_SIZES } from "../constants";
import type { NMJLCard, TileRequirement } from "../types/card";
import type {
  Tile,
  TileSuit,
  TileValue,
  WindValue,
  DragonValue,
  FlowerValue,
} from "../types/tiles";
import { validateHand } from "./pattern-matcher";

const card: NMJLCard = loadCard("2026");
const allHands = card.categories.flatMap((c) => c.hands);
const handMap = new Map(allHands.map((h) => [h.id, h]));

// ---------------------------------------------------------------------------
// 2.1 — Test helper: buildTilesForHand
// ---------------------------------------------------------------------------

type SuitMapping = Record<string, TileSuit>;

const CATEGORY_POOL: Record<string, string[]> = {
  dragon: ["red", "green", "soap"],
  wind: ["north", "east", "west", "south"],
  flower: ["a", "b"],
};

/**
 * Generates a valid 14-tile array for a given hand pattern.
 * Resolves color-group wildcards (A/B/C → suits), value wildcards (N/N+1/N+2),
 * and implicit groups (NEWS, dragon_set).
 * For quints/sextets where copies exceed 4, Joker tiles fill the gap.
 */
function buildTilesForHand(
  handId: string,
  suitMapping: SuitMapping = { A: "bam", B: "crak", C: "dot" },
  nValue = 1,
): Tile[] {
  const hand = handMap.get(handId);
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

  function createCategoryTile(category: string, specific: string, copy: number): Tile {
    switch (category) {
      case "wind":
        return {
          id: `wind-${specific}-${copy}`,
          category: "wind",
          value: specific as WindValue,
          copy,
        };
      case "dragon":
        return {
          id: `dragon-${specific}-${copy}`,
          category: "dragon",
          value: specific as DragonValue,
          copy,
        };
      case "flower":
        return {
          id: `flower-${specific}-${copy}`,
          category: "flower",
          value: specific as FlowerValue,
          copy,
        };
      default:
        throw new Error(`Unknown category: ${category}`);
    }
  }

  for (const group of hand.groups) {
    const size = GROUP_SIZES[group.type];

    if (group.type === "news") {
      const winds: WindValue[] = ["north", "east", "west", "south"];
      for (const w of winds) {
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
      const dragons: DragonValue[] = ["red", "green", "soap"];
      for (const d of dragons) {
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
    const req: TileRequirement = group.tile;

    for (let i = 0; i < size; i++) {
      if (req.category) {
        const specific = resolveSpecific(req.category, req.specific);
        const tileKey = `${req.category}-${specific}`;
        pushTile(tileKey, (copy) => createCategoryTile(req.category!, specific, copy));
      } else if (req.color) {
        const suit = suitMapping[req.color] ?? ("bam" as TileSuit);
        const value = resolveValue(req.value);
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

// ---------------------------------------------------------------------------
// Helper: create 14 random tiles that match no pattern
// ---------------------------------------------------------------------------

function buildRandomNonMatchingTiles(): Tile[] {
  // 7 pairs across 3 different suits — no NMJL hand uses cross-suit pairs
  const specs: Array<{ suit: TileSuit; value: number }> = [
    { suit: "bam", value: 1 },
    { suit: "crak", value: 3 },
    { suit: "dot", value: 5 },
    { suit: "bam", value: 7 },
    { suit: "crak", value: 9 },
    { suit: "dot", value: 2 },
    { suit: "bam", value: 4 },
  ];
  const tiles: Tile[] = [];
  for (const s of specs) {
    for (let c = 1; c <= 2; c++) {
      tiles.push({
        id: `${s.suit}-${s.value}-${c}`,
        category: "suited" as const,
        suit: s.suit,
        value: s.value as TileValue,
        copy: c,
      });
    }
  }
  return tiles;
}

// ---------------------------------------------------------------------------
// 2.2 — One test per hand (all 54 hands) — RED tests (expected to FAIL)
// These use test.fails: they SHOULD fail now (stub returns null).
// Story 2.3 will implement validateHand, making them pass — at which point
// test.fails must be changed back to test (Vitest will flag this).
// ---------------------------------------------------------------------------

describe("Pattern Matcher - Hand Validation (Red Tests)", () => {
  describe("2468 category", () => {
    test("ev-1: 2026 Year Hand", () => {
      const tiles = buildTilesForHand("ev-1");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ev-1");
      expect(result!.points).toBe(25);
    });

    test("ev-2: Even Suited Kongs", () => {
      const tiles = buildTilesForHand("ev-2");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ev-2");
      expect(result!.points).toBe(25);
    });

    test("ev-3: Even Mixed Kongs", () => {
      const tiles = buildTilesForHand("ev-3");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ev-3");
      expect(result!.points).toBe(25);
    });

    test("ev-4: Big Even Sextet", () => {
      const tiles = buildTilesForHand("ev-4");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ev-4");
      expect(result!.points).toBe(30);
    });

    test("ev-5: Even Pairs", () => {
      const tiles = buildTilesForHand("ev-5");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ev-5");
      expect(result!.points).toBe(50);
    });

    test("ev-6: Even Pungs", () => {
      const tiles = buildTilesForHand("ev-6");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ev-6");
      expect(result!.points).toBe(25);
    });

    test("ev-7: Even Mixed Pungs", () => {
      const tiles = buildTilesForHand("ev-7");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ev-7");
      expect(result!.points).toBe(25);
    });

    test("ev-8: Even Quint", () => {
      const tiles = buildTilesForHand("ev-8");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ev-8");
      expect(result!.points).toBe(40);
    });
  });

  describe("Quints category", () => {
    test("q-1: Double Quint Same Number", () => {
      const tiles = buildTilesForHand("q-1");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("q-1");
      expect(result!.points).toBe(50);
    });

    test("q-2: Quint With Dragon Set", () => {
      const tiles = buildTilesForHand("q-2");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("q-2");
      expect(result!.points).toBe(40);
    });

    test("q-3: Consecutive Quints", () => {
      const tiles = buildTilesForHand("q-3");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("q-3");
      expect(result!.points).toBe(55);
    });

    test("q-4: Quint NEWS", () => {
      const tiles = buildTilesForHand("q-4");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("q-4");
      expect(result!.points).toBe(45);
    });

    test("q-5: Quint Dragon Frame", () => {
      const tiles = buildTilesForHand("q-5");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("q-5");
      expect(result!.points).toBe(45);
    });

    test("q-6: Even Quint Pair", () => {
      const tiles = buildTilesForHand("q-6");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("q-6");
      expect(result!.points).toBe(60);
    });
  });

  describe("Consecutive Run category", () => {
    test("cr-1: Three-Suit Run Kongs", () => {
      const tiles = buildTilesForHand("cr-1");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("cr-1");
      expect(result!.points).toBe(25);
    });

    test("cr-2: Same-Suit Run Kongs", () => {
      const tiles = buildTilesForHand("cr-2");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("cr-2");
      expect(result!.points).toBe(25);
    });

    test("cr-3: Run Pungs", () => {
      const tiles = buildTilesForHand("cr-3");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("cr-3");
      expect(result!.points).toBe(25);
    });

    test("cr-4: Run Mixed Pungs", () => {
      const tiles = buildTilesForHand("cr-4");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("cr-4");
      expect(result!.points).toBe(25);
    });

    test("cr-5: Run Pairs", () => {
      const tiles = buildTilesForHand("cr-5");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("cr-5");
      expect(result!.points).toBe(50);
    });

    test("cr-6: Consecutive Sextet", () => {
      const tiles = buildTilesForHand("cr-6");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("cr-6");
      expect(result!.points).toBe(35);
    });

    test("cr-7: Long Run", () => {
      const tiles = buildTilesForHand("cr-7");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("cr-7");
      expect(result!.points).toBe(25);
    });

    test("cr-8: Consecutive Dragon Run", () => {
      const tiles = buildTilesForHand("cr-8");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("cr-8");
      expect(result!.points).toBe(30);
    });
  });

  describe("13579 category", () => {
    test("od-1: Odd Suited Kongs", () => {
      const tiles = buildTilesForHand("od-1");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("od-1");
      expect(result!.points).toBe(25);
    });

    test("od-2: Odd Mixed Kongs", () => {
      const tiles = buildTilesForHand("od-2");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("od-2");
      expect(result!.points).toBe(25);
    });

    test("od-3: Odd Pungs", () => {
      const tiles = buildTilesForHand("od-3");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("od-3");
      expect(result!.points).toBe(25);
    });

    test("od-4: Odd Mixed Pungs", () => {
      const tiles = buildTilesForHand("od-4");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("od-4");
      expect(result!.points).toBe(25);
    });

    test("od-5: Odd Pairs", () => {
      const tiles = buildTilesForHand("od-5");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("od-5");
      expect(result!.points).toBe(50);
    });

    test("od-6: Odd Sextet", () => {
      const tiles = buildTilesForHand("od-6");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("od-6");
      expect(result!.points).toBe(30);
    });

    test("od-7: Odd Quint", () => {
      const tiles = buildTilesForHand("od-7");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("od-7");
      expect(result!.points).toBe(40);
    });

    test("od-8: Odd NEWS", () => {
      const tiles = buildTilesForHand("od-8");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("od-8");
      expect(result!.points).toBe(30);
    });
  });

  describe("Winds-Dragons category", () => {
    test("wd-1: NEWS Double Kong", () => {
      const tiles = buildTilesForHand("wd-1");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("wd-1");
      expect(result!.points).toBe(25);
    });

    test("wd-2: Wind Pungs", () => {
      const tiles = buildTilesForHand("wd-2");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("wd-2");
      expect(result!.points).toBe(30);
    });

    test("wd-3: Dragon Pungs", () => {
      const tiles = buildTilesForHand("wd-3");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("wd-3");
      expect(result!.points).toBe(30);
    });

    test("wd-4: NEWS NEWS Pungs", () => {
      const tiles = buildTilesForHand("wd-4");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("wd-4");
      expect(result!.points).toBe(30);
    });

    test("wd-5: Dragon Kong Frame", () => {
      const tiles = buildTilesForHand("wd-5");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("wd-5");
      expect(result!.points).toBe(35);
    });

    test("wd-6: Wind Kong Parade", () => {
      const tiles = buildTilesForHand("wd-6");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("wd-6");
      expect(result!.points).toBe(35);
    });

    test("wd-7: NEWS Dragon Set Run", () => {
      const tiles = buildTilesForHand("wd-7");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("wd-7");
      expect(result!.points).toBe(30);
    });

    test("wd-8: Wind Dragon Pairs", () => {
      const tiles = buildTilesForHand("wd-8");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("wd-8");
      expect(result!.points).toBe(50);
    });
  });

  describe("369 category", () => {
    test("ts-1: Dragon 369", () => {
      const tiles = buildTilesForHand("ts-1");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ts-1");
      expect(result!.points).toBe(25);
    });

    test("ts-2: 369 Kongs", () => {
      const tiles = buildTilesForHand("ts-2");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ts-2");
      expect(result!.points).toBe(25);
    });

    test("ts-3: 369 Mixed Kongs", () => {
      const tiles = buildTilesForHand("ts-3");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ts-3");
      expect(result!.points).toBe(25);
    });

    test("ts-4: 369 Mixed Pungs", () => {
      const tiles = buildTilesForHand("ts-4");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ts-4");
      expect(result!.points).toBe(25);
    });

    test("ts-5: 369 Pairs", () => {
      const tiles = buildTilesForHand("ts-5");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ts-5");
      expect(result!.points).toBe(50);
    });

    test("ts-6: 369 NEWS", () => {
      const tiles = buildTilesForHand("ts-6");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ts-6");
      expect(result!.points).toBe(30);
    });

    test("ts-7: 369 Quint", () => {
      const tiles = buildTilesForHand("ts-7");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ts-7");
      expect(result!.points).toBe(45);
    });

    test("ts-8: Triple 369 Dragon", () => {
      const tiles = buildTilesForHand("ts-8");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ts-8");
      expect(result!.points).toBe(30);
    });
  });

  describe("Singles and Pairs category", () => {
    test("sp-1: Flower Frame", () => {
      const tiles = buildTilesForHand("sp-1");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("sp-1");
      expect(result!.points).toBe(30);
    });

    test("sp-2: Year Singles", () => {
      const tiles = buildTilesForHand("sp-2");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("sp-2");
      expect(result!.points).toBe(25);
    });

    test("sp-3: Rainbow Pairs", () => {
      const tiles = buildTilesForHand("sp-3");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("sp-3");
      expect(result!.points).toBe(50);
    });

    test("sp-4: Suited Pairs", () => {
      const tiles = buildTilesForHand("sp-4");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("sp-4");
      expect(result!.points).toBe(50);
    });

    test("sp-5: Flower Dragon Singles", () => {
      const tiles = buildTilesForHand("sp-5");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("sp-5");
      expect(result!.points).toBe(25);
    });

    test("sp-6: Mixed Singles", () => {
      const tiles = buildTilesForHand("sp-6");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("sp-6");
      expect(result!.points).toBe(30);
    });

    test("sp-7: NEWS Singles Frame", () => {
      // sp-7 and wd-1 match identical tiles (4 winds + 2 suited kongs + dragon pair)
      // at the same point value (25). Either match is valid.
      const tiles = buildTilesForHand("sp-7");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(["sp-7", "wd-1"]).toContain(result!.patternId);
      expect(result!.points).toBe(25);
    });

    test("sp-8: Dragon Pair Stack", () => {
      const tiles = buildTilesForHand("sp-8");
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("sp-8");
      expect(result!.points).toBe(25);
    });
  });
});

// ---------------------------------------------------------------------------
// 2.3 — Wildcard suit resolution across all 6 permutations
// ---------------------------------------------------------------------------

describe("Pattern Matcher - Suit Wildcard Permutations (Red Tests)", () => {
  const permutations: SuitMapping[] = [
    { A: "bam", B: "crak", C: "dot" },
    { A: "bam", B: "dot", C: "crak" },
    { A: "crak", B: "bam", C: "dot" },
    { A: "crak", B: "dot", C: "bam" },
    { A: "dot", B: "bam", C: "crak" },
    { A: "dot", B: "crak", C: "bam" },
  ];

  for (const mapping of permutations) {
    const label = `A-${mapping.A}, B-${mapping.B}, C-${mapping.C}`;
    test(`ev-3 with suit mapping ${label}`, () => {
      const tiles = buildTilesForHand("ev-3", mapping);
      expect(tiles).toHaveLength(14);
      const result = validateHand(tiles, card);
      expect(result).not.toBeNull();
      expect(result!.patternId).toBe("ev-3");
    });
  }
});

// ---------------------------------------------------------------------------
// 2.4 — Consecutive value boundary cases
// ---------------------------------------------------------------------------

describe("Pattern Matcher - Value Boundary Cases (Red Tests)", () => {
  test("cr-1 with N=7: values 7, 8, 9", () => {
    const tiles = buildTilesForHand("cr-1", { A: "bam", B: "crak", C: "dot" }, 7);
    expect(tiles).toHaveLength(14);
    const result = validateHand(tiles, card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe("cr-1");
  });

  test("sp-3 with N=8: values 8, 9 (N+1 only, no N+2)", () => {
    const tiles = buildTilesForHand("sp-3", { A: "bam", B: "crak", C: "dot" }, 8);
    expect(tiles).toHaveLength(14);
    const result = validateHand(tiles, card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe("sp-3");
  });

  test("cr-1 with N=1: values 1, 2, 3 (minimum boundary)", () => {
    const tiles = buildTilesForHand("cr-1", { A: "bam", B: "crak", C: "dot" }, 1);
    expect(tiles).toHaveLength(14);
    const result = validateHand(tiles, card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe("cr-1");
  });
});

// ---------------------------------------------------------------------------
// 2.5 — Mixed-tile groups (NEWS, dragon_set)
// ---------------------------------------------------------------------------

describe("Pattern Matcher - Mixed-Tile Groups (Red Tests)", () => {
  test("wd-4: hand with two NEWS groups (8 wind tiles total)", () => {
    const tiles = buildTilesForHand("wd-4");
    expect(tiles).toHaveLength(14);

    const windTiles = tiles.filter((t) => t.category === "wind");
    expect(windTiles).toHaveLength(8);

    const result = validateHand(tiles, card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe("wd-4");
  });

  test("ts-8: hand with dragon_set (3 distinct dragons)", () => {
    const tiles = buildTilesForHand("ts-8");
    expect(tiles).toHaveLength(14);

    const dragonTiles = tiles.filter((t) => t.category === "dragon");
    expect(dragonTiles.length).toBeGreaterThanOrEqual(3);

    const result = validateHand(tiles, card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe("ts-8");
  });

  test("wd-7: hand with both NEWS and dragon_set", () => {
    const tiles = buildTilesForHand("wd-7");
    expect(tiles).toHaveLength(14);

    const windTiles = tiles.filter((t) => t.category === "wind");
    expect(windTiles).toHaveLength(4);

    const dragonTiles = tiles.filter((t) => t.category === "dragon");
    expect(dragonTiles).toHaveLength(3);

    const result = validateHand(tiles, card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe("wd-7");
  });
});

// ---------------------------------------------------------------------------
// 2.6 — Quint/sextet hands requiring Joker substitution
// ---------------------------------------------------------------------------

describe("Pattern Matcher - Joker Substitution (Red Tests)", () => {
  test("q-1: double quint needs Jokers (only 4 natural copies per tile)", () => {
    const tiles = buildTilesForHand("q-1");
    expect(tiles).toHaveLength(14);

    const jokerTiles = tiles.filter((t) => t.category === "joker");
    expect(jokerTiles.length).toBeGreaterThanOrEqual(2);

    const result = validateHand(tiles, card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe("q-1");
  });

  test("ev-4: sextet needs 2 Jokers (6 copies, only 4 natural)", () => {
    const tiles = buildTilesForHand("ev-4");
    expect(tiles).toHaveLength(14);

    const jokerTiles = tiles.filter((t) => t.category === "joker");
    expect(jokerTiles.length).toBeGreaterThanOrEqual(2);

    const result = validateHand(tiles, card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe("ev-4");
  });

  test("cr-6: consecutive sextet requires Jokers", () => {
    const tiles = buildTilesForHand("cr-6");
    expect(tiles).toHaveLength(14);

    const jokerTiles = tiles.filter((t) => t.category === "joker");
    expect(jokerTiles.length).toBeGreaterThanOrEqual(2);

    const result = validateHand(tiles, card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe("cr-6");
  });
});

// ---------------------------------------------------------------------------
// 2.7 — Joker in eligible vs ineligible positions
// ---------------------------------------------------------------------------

describe("Pattern Matcher - Joker Eligibility Enforcement (Red Tests)", () => {
  test("Joker accepted in a kong position (eligible)", () => {
    const tiles = buildTilesForHand("ev-2");
    const suitedIdx = tiles.findIndex((t) => t.category === "suited");
    if (suitedIdx >= 0) {
      tiles[suitedIdx] = { id: "joker-8", category: "joker", copy: 8 } as Tile;
    }

    const result = validateHand(tiles, card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe("ev-2");
  });

  test("Joker rejected in a pair position (ineligible)", () => {
    const tiles = buildTilesForHand("ev-2");
    // Find pair-position tile by calculating offsets from hand structure
    const hand = handMap.get("ev-2")!;
    let pairStart = 0;
    for (const group of hand.groups) {
      if (group.type === "pair") break;
      pairStart += GROUP_SIZES[group.type];
    }
    tiles[pairStart] = { id: "joker-8", category: "joker", copy: 8 } as Tile;

    const result = validateHand(tiles, card);
    expect(result?.patternId).not.toBe("ev-2");
  });

  test("Joker rejected in a single position (ineligible)", () => {
    const tiles = buildTilesForHand("sp-2");
    tiles[0] = { id: "joker-8", category: "joker", copy: 8 } as Tile;

    const result = validateHand(tiles, card);
    expect(result?.patternId).not.toBe("sp-2");
  });
});

// ---------------------------------------------------------------------------
// 2.8 — Concealed hand validation
// ---------------------------------------------------------------------------

describe("Pattern Matcher - Concealed Hand Validation (Red Tests)", () => {
  test("valid concealed hand accepted (ev-5: Even Pairs, all concealed)", () => {
    const tiles = buildTilesForHand("ev-5");
    const result = validateHand(tiles, card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe("ev-5");
  });

  // Concealed hand rejection requires exposure context in validateHand signature.
  // Deferred to Story 2.5 (concealed/exposed hand validation).
  test.todo("concealed hand rejected if any group is exposed (Story 2.5)");
});

// ---------------------------------------------------------------------------
// 2.9 — Negative tests: non-matching tiles (these PASS — stub returns null)
// ---------------------------------------------------------------------------

describe("Pattern Matcher - Negative Tests", () => {
  test("14 random non-matching tiles returns null", () => {
    const tiles = buildRandomNonMatchingTiles();
    expect(tiles).toHaveLength(14);
    const result = validateHand(tiles, card);
    expect(result).toBeNull();
  });

  test("13 tiles returns null (incomplete hand)", () => {
    const tiles = buildRandomNonMatchingTiles().slice(0, 13);
    expect(tiles).toHaveLength(13);
    const result = validateHand(tiles, card);
    expect(result).toBeNull();
  });

  test("empty tile array returns null", () => {
    const result = validateHand([], card);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildTilesForHand helper validation (green tests — helper must work)
// ---------------------------------------------------------------------------

describe("buildTilesForHand helper", () => {
  test("generates exactly 14 tiles for every hand", () => {
    for (const hand of allHands) {
      const tiles = buildTilesForHand(hand.id);
      expect(tiles, `Hand ${hand.id} should produce 14 tiles`).toHaveLength(14);
    }
  });

  test("generates valid Tile objects with required fields", () => {
    const tiles = buildTilesForHand("ev-1");
    for (const tile of tiles) {
      expect(tile.id).toBeTruthy();
      expect(tile.category).toBeTruthy();
      expect(tile.copy).toBeGreaterThanOrEqual(1);
    }
  });

  test("Joker tiles are used for quint copies beyond 4", () => {
    const tiles = buildTilesForHand("ev-8");
    const jokers = tiles.filter((t) => t.category === "joker");
    expect(jokers.length).toBeGreaterThanOrEqual(2);
  });

  test("throws for unknown hand ID", () => {
    expect(() => buildTilesForHand("nonexistent-hand")).toThrow("not found");
  });
});
