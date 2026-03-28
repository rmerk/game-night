import { describe, test, expect } from "vite-plus/test";
import type { GroupType, NMJLCard, HandPattern } from "../types/card";
import type { Tile, TileValue, WindValue, DragonValue, FlowerValue } from "../types/tiles";
import type { ExposedGroup } from "../types/game-state";
import { GROUP_SIZES } from "../constants";
import { loadCard } from "./card-loader";
import { validateHand } from "./pattern-matcher";
import {
  validateExposure,
  validateHandWithExposure,
  filterAchievableByExposure,
} from "./exposure-validation";
import type { ExposureResult } from "./exposure-validation";

// ---------------------------------------------------------------------------
// Helpers (reused from joker-eligibility.test.ts pattern)
// ---------------------------------------------------------------------------

function makeSuitedTile(suit: "bam" | "crak" | "dot", value: TileValue, copy: number): Tile {
  return { id: `${suit}-${value}-${copy}`, category: "suited", suit, value, copy };
}

function makeWindTile(value: WindValue, copy: number): Tile {
  return { id: `wind-${value}-${copy}`, category: "wind", value, copy };
}

function makeDragonTile(value: DragonValue, copy: number): Tile {
  return { id: `dragon-${value}-${copy}`, category: "dragon", value, copy };
}

function makeFlowerTile(value: FlowerValue, copy: number): Tile {
  return { id: `flower-${value}-${copy}`, category: "flower", value, copy };
}

function makeJoker(copy: number): Tile {
  return { id: `joker-${copy}`, category: "joker", copy } as Tile;
}

// ---------------------------------------------------------------------------
// Card data and helpers
// ---------------------------------------------------------------------------

const card: NMJLCard = loadCard("2026");
const allHands = card.categories.flatMap((c) => c.hands);
const handMap = new Map(allHands.map((h) => [h.id, h]));

const concealedHands = allHands.filter((h) => h.exposure === "C");
const exposedHands = allHands.filter((h) => h.exposure === "X");

type SuitMapping = Record<string, "bam" | "crak" | "dot">;

const CATEGORY_POOL: Record<string, string[]> = {
  dragon: ["red", "green", "soap"],
  wind: ["north", "east", "west", "south"],
  flower: ["a", "b"],
};

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

// ---------------------------------------------------------------------------
// Task 1: validateExposure
// ---------------------------------------------------------------------------

describe("validateExposure", () => {
  test("concealed hand with no exposed groups → valid (4.2)", () => {
    const pattern = concealedHands[0];
    const result = validateExposure([], pattern);
    expect(result.valid).toBe(true);
  });

  test("concealed hand with exposed groups → rejected (4.3)", () => {
    const pattern = concealedHands[0];
    const exposedGroups: ExposedGroup[] = [
      {
        type: "kong",
        tiles: [
          makeSuitedTile("bam", 3, 1),
          makeSuitedTile("bam", 3, 2),
          makeSuitedTile("bam", 3, 3),
          makeSuitedTile("bam", 3, 4),
        ],
        identity: { type: "kong", suit: "bam", value: 3 },
      },
    ];
    const result = validateExposure(exposedGroups, pattern);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBeTruthy();
    }
  });

  test("exposed hand with any mix of groups → valid (4.4)", () => {
    const pattern = exposedHands[0];
    const exposedGroups: ExposedGroup[] = [
      {
        type: "kong",
        tiles: [
          makeSuitedTile("bam", 3, 1),
          makeSuitedTile("bam", 3, 2),
          makeSuitedTile("bam", 3, 3),
          makeSuitedTile("bam", 3, 4),
        ],
        identity: { type: "kong", suit: "bam", value: 3 },
      },
    ];
    const result = validateExposure(exposedGroups, pattern);
    expect(result.valid).toBe(true);
  });

  test("exposed hand with no exposed groups → valid", () => {
    const pattern = exposedHands[0];
    const result = validateExposure([], pattern);
    expect(result.valid).toBe(true);
  });

  test("group-level concealed: concealed groups are exposed → rejected (4.5)", () => {
    // Create a synthetic pattern with mixed concealed/exposed groups
    const pattern: HandPattern = {
      id: "test-mixed",
      points: 25,
      exposure: "X",
      groups: [
        { type: "kong", jokerEligible: true, concealed: true, tile: { color: "A", value: 1 } },
        { type: "kong", jokerEligible: true, concealed: false, tile: { color: "A", value: 2 } },
        { type: "pung", jokerEligible: true, concealed: false, tile: { color: "A", value: 3 } },
        { type: "pair", jokerEligible: false, tile: { color: "A", value: 4 } },
      ],
    };
    // The first group (kong of A-1) is concealed: true, but player exposed it
    const exposedGroups: ExposedGroup[] = [
      {
        type: "kong",
        tiles: [
          makeSuitedTile("bam", 1, 1),
          makeSuitedTile("bam", 1, 2),
          makeSuitedTile("bam", 1, 3),
          makeSuitedTile("bam", 1, 4),
        ],
        identity: { type: "kong", suit: "bam", value: 1 },
      },
    ];
    const result = validateExposure(exposedGroups, pattern);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBeTruthy();
    }
  });

  test("group-level concealed: concealed groups NOT exposed → valid (4.6)", () => {
    // Same pattern but the exposed group doesn't match the concealed group
    const pattern: HandPattern = {
      id: "test-mixed",
      points: 25,
      exposure: "X",
      groups: [
        { type: "kong", jokerEligible: true, concealed: true, tile: { color: "A", value: 1 } },
        { type: "kong", jokerEligible: true, concealed: false, tile: { color: "A", value: 2 } },
        { type: "pung", jokerEligible: true, concealed: false, tile: { color: "A", value: 3 } },
        { type: "pair", jokerEligible: false, tile: { color: "A", value: 4 } },
      ],
    };
    // The exposed group is kong of A-2 (concealed: false) — no conflict
    const exposedGroups: ExposedGroup[] = [
      {
        type: "kong",
        tiles: [
          makeSuitedTile("bam", 2, 1),
          makeSuitedTile("bam", 2, 2),
          makeSuitedTile("bam", 2, 3),
          makeSuitedTile("bam", 2, 4),
        ],
        identity: { type: "kong", suit: "bam", value: 2 },
      },
    ];
    const result = validateExposure(exposedGroups, pattern);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Task 2: validateHandWithExposure
// ---------------------------------------------------------------------------

describe("validateHandWithExposure", () => {
  test("valid tiles + valid exposure → MatchResult (4.7)", () => {
    // Pick an exposed hand and build valid tiles
    const hand = exposedHands[0];
    const tiles = buildTilesForHand(hand.id);
    const result = validateHandWithExposure(tiles, [], card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe(hand.id);
  });

  test("valid tiles but exposure violation → null (4.8)", () => {
    // Pick a concealed hand, build valid tiles, but provide exposed groups
    const hand = concealedHands[0];
    const tiles = buildTilesForHand(hand.id);
    const exposedGroups: ExposedGroup[] = [
      {
        type: "kong",
        tiles: [
          makeSuitedTile("bam", 9, 1),
          makeSuitedTile("bam", 9, 2),
          makeSuitedTile("bam", 9, 3),
          makeSuitedTile("bam", 9, 4),
        ],
        identity: { type: "kong", suit: "bam", value: 9 },
      },
    ];
    // With exposed groups, all concealed patterns should be filtered out
    // The tiles may still match an exposed pattern by coincidence, but not the concealed one
    const result = validateHandWithExposure(tiles, exposedGroups, card);
    // If it matches anything, it should NOT be the concealed hand
    if (result) {
      expect(result.patternId).not.toBe(hand.id);
    }
  });

  test("concealed hand with no exposed groups validates successfully", () => {
    const hand = concealedHands[0];
    const tiles = buildTilesForHand(hand.id);
    const result = validateHandWithExposure(tiles, [], card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe(hand.id);
  });
});

// ---------------------------------------------------------------------------
// Task 3: filterAchievableByExposure
// ---------------------------------------------------------------------------

describe("filterAchievableByExposure", () => {
  test("concealed hands removed when player has exposed groups (4.9)", () => {
    const exposedGroups: ExposedGroup[] = [
      {
        type: "pung",
        tiles: [
          makeSuitedTile("bam", 1, 1),
          makeSuitedTile("bam", 1, 2),
          makeSuitedTile("bam", 1, 3),
        ],
        identity: { type: "pung", suit: "bam", value: 1 },
      },
    ];
    const achievable = filterAchievableByExposure(exposedGroups, card);
    // None of the achievable hands should be concealed
    for (const hand of achievable) {
      expect(hand.exposure).toBe("X");
    }
    // Should still have exposed hands
    expect(achievable.length).toBeGreaterThan(0);
  });

  test("no exposed groups → all hands achievable", () => {
    const achievable = filterAchievableByExposure([], card);
    expect(achievable.length).toBe(allHands.length);
  });

  test("returns fewer hands than total when exposed groups exist", () => {
    const exposedGroups: ExposedGroup[] = [
      {
        type: "pung",
        tiles: [
          makeSuitedTile("bam", 1, 1),
          makeSuitedTile("bam", 1, 2),
          makeSuitedTile("bam", 1, 3),
        ],
        identity: { type: "pung", suit: "bam", value: 1 },
      },
    ];
    const achievable = filterAchievableByExposure(exposedGroups, card);
    // At minimum, all concealed hands (10) should be excluded
    expect(achievable.length).toBeLessThan(allHands.length);
    expect(achievable.length).toBeLessThanOrEqual(exposedHands.length);
  });
});

// ---------------------------------------------------------------------------
// Integration tests with real 2026 card data
// ---------------------------------------------------------------------------

describe("Integration: exposure validation with 2026 card data", () => {
  test("known concealed hand validates with no exposed groups (4.10)", () => {
    const hand = concealedHands[0];
    const tiles = buildTilesForHand(hand.id);
    // Should validate successfully
    const result = validateHandWithExposure(tiles, [], card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe(hand.id);
  });

  test("known concealed hand rejected with exposed groups (4.10)", () => {
    const hand = concealedHands[0];
    const tiles = buildTilesForHand(hand.id);
    const exposedGroups: ExposedGroup[] = [
      {
        type: "pung",
        tiles: [
          makeSuitedTile("dot", 5, 1),
          makeSuitedTile("dot", 5, 2),
          makeSuitedTile("dot", 5, 3),
        ],
        identity: { type: "pung", suit: "dot", value: 5 },
      },
    ];
    const result = validateHandWithExposure(tiles, exposedGroups, card);
    // Should not match the concealed hand
    if (result) {
      expect(result.patternId).not.toBe(hand.id);
    }
  });

  test("known exposed hand validates with exposed groups (4.11)", () => {
    const hand = exposedHands[0];
    const tiles = buildTilesForHand(hand.id);
    const exposedGroups: ExposedGroup[] = [
      {
        type: "pung",
        tiles: [
          makeSuitedTile("dot", 5, 1),
          makeSuitedTile("dot", 5, 2),
          makeSuitedTile("dot", 5, 3),
        ],
        identity: { type: "pung", suit: "dot", value: 5 },
      },
    ];
    const result = validateHandWithExposure(tiles, exposedGroups, card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe(hand.id);
  });

  test("known exposed hand validates with no exposed groups (4.11)", () => {
    const hand = exposedHands[0];
    const tiles = buildTilesForHand(hand.id);
    const result = validateHandWithExposure(tiles, [], card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe(hand.id);
  });

  test("all concealed hands in 2026 card have concealed: true on ALL groups", () => {
    for (const hand of concealedHands) {
      for (const group of hand.groups) {
        expect(group.concealed, `${hand.id} group ${group.type} should be concealed`).toBe(true);
      }
    }
  });

  test("some exposed hands in 2026 card have mixed concealed/exposed groups", () => {
    // sp-1 is an exposed hand with group-level concealed constraints
    const sp1 = handMap.get("sp-1");
    expect(sp1).toBeDefined();
    expect(sp1!.exposure).toBe("X");
    const concealedGroups = sp1!.groups.filter((g) => g.concealed);
    expect(concealedGroups.length).toBeGreaterThan(0);
  });
});
