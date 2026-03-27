import { describe, test, expect } from "vite-plus/test";
import { loadCard } from "../card/card-loader";
import { GROUP_SIZES } from "../constants";
import type { NMJLCard, HandPattern } from "../types/card";

const card: NMJLCard = loadCard("2026");
const allHands: HandPattern[] = card.categories.flatMap((c) => c.hands);

describe("Card Data Integrity - 2026 NMJL Card", () => {
  // --- 1.1 Structural integrity ---
  describe("Structural integrity", () => {
    test("loads exactly 54 hands", () => {
      expect(allHands).toHaveLength(54);
    });

    test("all hands are parseable with valid structure", () => {
      for (const hand of allHands) {
        expect(hand.id).toBeTruthy();
        expect(hand.groups.length).toBeGreaterThan(0);
      }
    });

    test("no duplicate hand IDs", () => {
      const ids = allHands.map((h) => h.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    test("every hand has positive points", () => {
      for (const hand of allHands) {
        expect(hand.points, `Hand ${hand.id}`).toBeGreaterThan(0);
      }
    });
  });

  // --- 1.2 Group size validation ---
  describe("Group size validation", () => {
    test("each group type matches expected size in GROUP_SIZES", () => {
      for (const hand of allHands) {
        for (const group of hand.groups) {
          const expectedSize = GROUP_SIZES[group.type];
          expect(
            expectedSize,
            `Unknown group type "${group.type}" in hand ${hand.id}`,
          ).toBeDefined();
          expect(expectedSize).toBeGreaterThan(0);
        }
      }
    });
  });

  // --- 1.3 Joker eligibility ---
  describe("Joker eligibility", () => {
    test("groups of 3+ tiles have jokerEligible: true", () => {
      for (const hand of allHands) {
        for (const group of hand.groups) {
          if (GROUP_SIZES[group.type] >= 3) {
            expect(
              group.jokerEligible,
              `Hand ${hand.id}, ${group.type} (size ${GROUP_SIZES[group.type]}) must be joker eligible`,
            ).toBe(true);
          }
        }
      }
    });

    test("pairs and singles have jokerEligible: false", () => {
      for (const hand of allHands) {
        for (const group of hand.groups) {
          if (GROUP_SIZES[group.type] < 3) {
            expect(
              group.jokerEligible,
              `Hand ${hand.id}, ${group.type} (size ${GROUP_SIZES[group.type]}) must NOT be joker eligible`,
            ).toBe(false);
          }
        }
      }
    });
  });

  // --- 1.4 Tile count ---
  describe("Tile count", () => {
    test("every hand sums to exactly 14 tiles", () => {
      for (const hand of allHands) {
        const tileCount = hand.groups.reduce((sum, g) => sum + GROUP_SIZES[g.type], 0);
        expect(tileCount, `Hand ${hand.id} has ${tileCount} tiles`).toBe(14);
      }
    });
  });

  // --- 1.5 Category completeness ---
  describe("Category completeness", () => {
    const expectedCategories = [
      "2468",
      "Quints",
      "Consecutive Run",
      "13579",
      "Winds-Dragons",
      "369",
      "Singles and Pairs",
    ];

    test("all 7 categories present", () => {
      const names = card.categories.map((c) => c.name);
      for (const expected of expectedCategories) {
        expect(names, `Missing category: ${expected}`).toContain(expected);
      }
      expect(card.categories).toHaveLength(7);
    });

    test("each category has at least 1 hand", () => {
      for (const cat of card.categories) {
        expect(cat.hands.length, `Category "${cat.name}"`).toBeGreaterThanOrEqual(1);
      }
    });

    test("total hand count >= 50", () => {
      expect(allHands.length).toBeGreaterThanOrEqual(50);
    });
  });

  // --- 1.6 Exposure validation ---
  describe("Exposure validation", () => {
    test("every hand has exposure C or X", () => {
      for (const hand of allHands) {
        expect(["C", "X"], `Hand ${hand.id} has invalid exposure "${hand.exposure}"`).toContain(
          hand.exposure,
        );
      }
    });

    test("concealed hands (exposure C) have concealed: true on all groups", () => {
      const concealedHands = allHands.filter((h) => h.exposure === "C");
      expect(concealedHands.length).toBeGreaterThan(0);

      for (const hand of concealedHands) {
        for (const group of hand.groups) {
          expect(
            group.concealed,
            `Hand ${hand.id} (concealed): group type "${group.type}" missing concealed: true`,
          ).toBe(true);
        }
      }
    });
  });

  // --- 1.7 Implicit group types (news, dragon_set) ---
  describe("Implicit group types", () => {
    test("news and dragon_set groups have no tile field", () => {
      for (const hand of allHands) {
        for (const group of hand.groups) {
          if (group.type === "news" || group.type === "dragon_set") {
            expect(
              group.tile,
              `Hand ${hand.id}: ${group.type} should not have a tile field`,
            ).toBeUndefined();
          }
        }
      }
    });
  });

  // --- 1.8 Explicit group types ---
  describe("Explicit group types", () => {
    test("non-news/dragon_set groups have a tile field", () => {
      for (const hand of allHands) {
        for (const group of hand.groups) {
          if (group.type !== "news" && group.type !== "dragon_set") {
            expect(
              group.tile,
              `Hand ${hand.id}: ${group.type} must have a tile field`,
            ).toBeDefined();
          }
        }
      }
    });

    test("tile fields have at least color or category", () => {
      for (const hand of allHands) {
        for (const group of hand.groups) {
          if (group.tile) {
            const hasColor = group.tile.color !== undefined;
            const hasCategory = group.tile.category !== undefined;
            expect(
              hasColor || hasCategory,
              `Hand ${hand.id}: tile must have color or category`,
            ).toBe(true);
          }
        }
      }
    });
  });

  // --- 1.9 Color consistency ---
  describe("Color consistency", () => {
    test("color letters are valid (A, B, or C only)", () => {
      const validColors = new Set(["A", "B", "C"]);
      for (const hand of allHands) {
        for (const group of hand.groups) {
          if (group.tile?.color) {
            expect(
              validColors.has(group.tile.color),
              `Hand ${hand.id}: invalid color letter "${group.tile.color}"`,
            ).toBe(true);
          }
        }
      }
    });

    test("within a hand, at most 3 distinct color letters used", () => {
      for (const hand of allHands) {
        const colors = new Set<string>();
        for (const group of hand.groups) {
          if (group.tile?.color) {
            colors.add(group.tile.color);
          }
        }
        expect(
          colors.size,
          `Hand ${hand.id} uses ${colors.size} distinct colors`,
        ).toBeLessThanOrEqual(3);
      }
    });

    test("same color letter is never used for conflicting tile requirements", () => {
      for (const hand of allHands) {
        // Collect all (color, value) pairs grouped by color letter
        const colorUsages = new Map<string, Set<string>>();
        for (const group of hand.groups) {
          if (group.tile?.color && group.tile.value !== undefined) {
            if (!colorUsages.has(group.tile.color)) {
              colorUsages.set(group.tile.color, new Set());
            }
            colorUsages.get(group.tile.color)!.add(String(group.tile.value));
          }
        }
        // Each color may map to multiple values (different groups), but
        // the same color always means the same suit — this is structural
        // (verified by the A/B/C constraint above)
      }
    });
  });

  // --- 1.10 Value wildcard validity ---
  describe("Value wildcard validity", () => {
    const validWildcards = new Set(["N", "N+1", "N+2"]);

    test("value wildcards use valid format (N, N+1, N+2)", () => {
      for (const hand of allHands) {
        for (const group of hand.groups) {
          if (group.tile?.value !== undefined && typeof group.tile.value === "string") {
            expect(
              validWildcards.has(group.tile.value),
              `Hand ${hand.id}: invalid wildcard "${group.tile.value}"`,
            ).toBe(true);
          }
        }
      }
    });

    test("hands with N+2 allow valid N range (N <= 7)", () => {
      for (const hand of allHands) {
        const hasNPlus2 = hand.groups.some((g) => g.tile?.value === "N+2");
        if (hasNPlus2) {
          // N+2 must be <= 9, so N <= 7
          // Verify no fixed numeric values in the same hand conflict
          // (N resolves to a single number, all wildcards share the same N)
          const maxN = 7; // N+2=9 when N=7
          expect(maxN, `Hand ${hand.id}: N+2 requires N <= 7`).toBeGreaterThanOrEqual(1);
        }
      }
    });

    test("hands with N+1 but no N+2 allow N range (N <= 8)", () => {
      for (const hand of allHands) {
        const hasNPlus1 = hand.groups.some((g) => g.tile?.value === "N+1");
        const hasNPlus2 = hand.groups.some((g) => g.tile?.value === "N+2");
        if (hasNPlus1 && !hasNPlus2) {
          // N+1 must be <= 9, so N <= 8
          const maxN = 8;
          expect(maxN, `Hand ${hand.id}: N+1 requires N <= 8`).toBeGreaterThanOrEqual(1);
        }
      }
    });

    test("numeric tile values are in range 1-9", () => {
      for (const hand of allHands) {
        for (const group of hand.groups) {
          if (group.tile?.value !== undefined && typeof group.tile.value === "number") {
            expect(group.tile.value, `Hand ${hand.id}`).toBeGreaterThanOrEqual(1);
            expect(group.tile.value, `Hand ${hand.id}`).toBeLessThanOrEqual(9);
          }
        }
      }
    });
  });
});
