import { describe, test, expect } from "vite-plus/test";
import type { GroupType, NMJLCard } from "../types/card";
import type { TileValue, WindValue, DragonValue } from "../types/tiles";
import type { ExposedGroup } from "../types/game-state";
import { GROUP_SIZES } from "../constants";
import { loadCard } from "./card-loader";
import { validateHand } from "./pattern-matcher";
import {
  suitedTile,
  windTile,
  dragonTile,
  jokerTile,
  buildTilesForHand,
} from "../testing/tile-builders";
import {
  isJokerEligibleGroup,
  canSubstituteJoker,
  validateJokerExchange,
} from "./joker-eligibility";

// ---------------------------------------------------------------------------
// Helpers — thin wrappers for test readability
// ---------------------------------------------------------------------------

function makeSuitedTile(suit: "bam" | "crak" | "dot", value: TileValue, copy: number) {
  return suitedTile(suit, value, copy);
}

function makeWindTile(value: WindValue, copy: number) {
  return windTile(value, copy);
}

function makeDragonTile(value: DragonValue, copy: number) {
  return dragonTile(value, copy);
}

function makeJoker(copy: number) {
  return jokerTile(copy);
}

// ---------------------------------------------------------------------------
// Task 1: isJokerEligibleGroup
// ---------------------------------------------------------------------------

describe("isJokerEligibleGroup", () => {
  test("pung (3) is eligible", () => {
    expect(isJokerEligibleGroup("pung")).toBe(true);
  });

  test("kong (4) is eligible", () => {
    expect(isJokerEligibleGroup("kong")).toBe(true);
  });

  test("quint (5) is eligible", () => {
    expect(isJokerEligibleGroup("quint")).toBe(true);
  });

  test("sextet (6) is eligible", () => {
    expect(isJokerEligibleGroup("sextet")).toBe(true);
  });

  test("news (4) is eligible", () => {
    expect(isJokerEligibleGroup("news")).toBe(true);
  });

  test("dragon_set (3) is eligible", () => {
    expect(isJokerEligibleGroup("dragon_set")).toBe(true);
  });

  test("pair (2) is NOT eligible", () => {
    expect(isJokerEligibleGroup("pair")).toBe(false);
  });

  test("single (1) is NOT eligible", () => {
    expect(isJokerEligibleGroup("single")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Task 1: canSubstituteJoker
// ---------------------------------------------------------------------------

describe("canSubstituteJoker", () => {
  test("returns true for eligible group at valid position", () => {
    const group = {
      type: "kong" as GroupType,
      jokerEligible: true,
      tile: { color: "A", value: 3 },
    };
    expect(canSubstituteJoker(group, 0)).toBe(true);
    expect(canSubstituteJoker(group, 3)).toBe(true);
  });

  test("returns false for ineligible group (pair)", () => {
    const group = {
      type: "pair" as GroupType,
      jokerEligible: false,
      tile: { color: "A", value: 3 },
    };
    expect(canSubstituteJoker(group, 0)).toBe(false);
  });

  test("returns false for position out of group size", () => {
    const group = {
      type: "pung" as GroupType,
      jokerEligible: true,
      tile: { color: "A", value: 3 },
    };
    expect(canSubstituteJoker(group, 3)).toBe(false); // pung size=3, positions 0-2
    expect(canSubstituteJoker(group, -1)).toBe(false);
  });

  test("returns false for negative position", () => {
    const group = {
      type: "kong" as GroupType,
      jokerEligible: true,
      tile: { color: "A", value: 3 },
    };
    expect(canSubstituteJoker(group, -1)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Task 2: validateJokerExchange
// ---------------------------------------------------------------------------

describe("validateJokerExchange", () => {
  test("valid exchange: suited kong with Joker, matching natural tile offered", () => {
    const group: ExposedGroup = {
      type: "kong",
      tiles: [
        makeSuitedTile("bam", 3, 1),
        makeSuitedTile("bam", 3, 2),
        makeSuitedTile("bam", 3, 3),
        makeJoker(1),
      ],
      identity: { type: "kong", suit: "bam", value: 3 },
    };
    const offered = makeSuitedTile("bam", 3, 4);
    const result = validateJokerExchange(group, offered);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.jokerTile.category).toBe("joker");
    }
  });

  test("rejects exchange: offered tile does not match group identity (wrong value)", () => {
    const group: ExposedGroup = {
      type: "kong",
      tiles: [
        makeSuitedTile("bam", 3, 1),
        makeSuitedTile("bam", 3, 2),
        makeSuitedTile("bam", 3, 3),
        makeJoker(1),
      ],
      identity: { type: "kong", suit: "bam", value: 3 },
    };
    const offered = makeSuitedTile("bam", 5, 1);
    const result = validateJokerExchange(group, offered);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBeTruthy();
    }
  });

  test("rejects exchange: offered tile does not match group identity (wrong suit)", () => {
    const group: ExposedGroup = {
      type: "kong",
      tiles: [
        makeSuitedTile("bam", 3, 1),
        makeSuitedTile("bam", 3, 2),
        makeSuitedTile("bam", 3, 3),
        makeJoker(1),
      ],
      identity: { type: "kong", suit: "bam", value: 3 },
    };
    const offered = makeSuitedTile("crak", 3, 1);
    const result = validateJokerExchange(group, offered);
    expect(result.valid).toBe(false);
  });

  test("rejects exchange: group has no Jokers (AC 4)", () => {
    const group: ExposedGroup = {
      type: "kong",
      tiles: [
        makeSuitedTile("bam", 3, 1),
        makeSuitedTile("bam", 3, 2),
        makeSuitedTile("bam", 3, 3),
        makeSuitedTile("bam", 3, 4),
      ],
      identity: { type: "kong", suit: "bam", value: 3 },
    };
    const offered = makeSuitedTile("bam", 3, 1);
    const result = validateJokerExchange(group, offered);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("no Joker");
    }
  });

  test("multi-Joker group: returns first Joker found (AC 5)", () => {
    const group: ExposedGroup = {
      type: "quint",
      tiles: [
        makeSuitedTile("dot", 7, 1),
        makeSuitedTile("dot", 7, 2),
        makeSuitedTile("dot", 7, 3),
        makeJoker(1),
        makeJoker(2),
      ],
      identity: { type: "quint", suit: "dot", value: 7 },
    };
    const offered = makeSuitedTile("dot", 7, 4);
    const result = validateJokerExchange(group, offered);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.jokerTile.id).toBe("joker-1");
    }
  });

  test("valid exchange: wind group with Joker", () => {
    const group: ExposedGroup = {
      type: "pung",
      tiles: [makeWindTile("north", 1), makeWindTile("north", 2), makeJoker(3)],
      identity: { type: "pung", wind: "north" },
    };
    const offered = makeWindTile("north", 3);
    const result = validateJokerExchange(group, offered);
    expect(result.valid).toBe(true);
  });

  test("rejects exchange: wrong wind offered", () => {
    const group: ExposedGroup = {
      type: "pung",
      tiles: [makeWindTile("north", 1), makeWindTile("north", 2), makeJoker(3)],
      identity: { type: "pung", wind: "north" },
    };
    const offered = makeWindTile("south", 1);
    const result = validateJokerExchange(group, offered);
    expect(result.valid).toBe(false);
  });

  test("valid exchange: dragon group with Joker", () => {
    const group: ExposedGroup = {
      type: "pung",
      tiles: [makeDragonTile("red", 1), makeDragonTile("red", 2), makeJoker(4)],
      identity: { type: "pung", dragon: "red" },
    };
    const offered = makeDragonTile("red", 3);
    const result = validateJokerExchange(group, offered);
    expect(result.valid).toBe(true);
  });

  test("rejects exchange: wrong dragon offered", () => {
    const group: ExposedGroup = {
      type: "pung",
      tiles: [makeDragonTile("red", 1), makeDragonTile("red", 2), makeJoker(4)],
      identity: { type: "pung", dragon: "red" },
    };
    const offered = makeDragonTile("green", 1);
    const result = validateJokerExchange(group, offered);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Task 4: Integration with pattern matcher — Joker eligibility enforcement
// ---------------------------------------------------------------------------

const card: NMJLCard = loadCard("2026");
const allHands = card.categories.flatMap((c) => c.hands);
const handMap = new Map(allHands.map((h) => [h.id, h]));

describe("Integration: Joker eligibility with pattern matcher", () => {
  test("hand with Joker in eligible kong position passes validateHand", () => {
    // ev-2 has kongs (eligible). Replace one natural tile with a Joker.
    const tiles = buildTilesForHand(card, "ev-2");
    const suitedIdx = tiles.findIndex((t) => t.category === "suited");
    if (suitedIdx >= 0) {
      tiles[suitedIdx] = makeJoker(8);
    }
    const result = validateHand(tiles, card);
    expect(result).not.toBeNull();
    expect(result!.patternId).toBe("ev-2");
  });

  test("hand with Joker in ineligible pair position fails for that pattern", () => {
    // ev-2 has a pair (ineligible). Replace pair tile with Joker.
    const tiles = buildTilesForHand(card, "ev-2");
    const hand = handMap.get("ev-2")!;
    let pairStart = 0;
    for (const group of hand.groups) {
      if (group.type === "pair") break;
      pairStart += GROUP_SIZES[group.type];
    }
    tiles[pairStart] = makeJoker(8);
    const result = validateHand(tiles, card);
    // Should NOT match ev-2 because Joker cannot go in a pair
    expect(result?.patternId).not.toBe("ev-2");
  });

  test("hand with Joker in ineligible single position fails for that pattern", () => {
    // sp-2 has singles (ineligible). Replace a single with Joker.
    const tiles = buildTilesForHand(card, "sp-2");
    tiles[0] = makeJoker(8);
    const result = validateHand(tiles, card);
    expect(result?.patternId).not.toBe("sp-2");
  });

  test("isJokerEligibleGroup agrees with card data jokerEligible flags", () => {
    // Verify all hands: groups of 3+ have jokerEligible=true, pairs/singles have false
    for (const hand of allHands) {
      for (const group of hand.groups) {
        const eligible = isJokerEligibleGroup(group.type);
        expect(group.jokerEligible, `${hand.id} group ${group.type} jokerEligible mismatch`).toBe(
          eligible,
        );
      }
    }
  });
});
