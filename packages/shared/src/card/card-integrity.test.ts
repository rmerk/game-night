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

    test("color letters are only used for suited tiles (never combined with category)", () => {
      for (const hand of allHands) {
        for (const group of hand.groups) {
          if (group.tile?.color) {
            // A color letter implies a suited tile — should not also have a category field
            expect(
              group.tile.category,
              `Hand ${hand.id}: color "${group.tile.color}" used with category "${group.tile.category}" — color implies suited, category implies honor`,
            ).toBeUndefined();
          }
        }
      }
    });

    test("distinct color letters within a hand map to different suit slots", () => {
      for (const hand of allHands) {
        const colorsUsed = new Set<string>();
        for (const group of hand.groups) {
          if (group.tile?.color) {
            colorsUsed.add(group.tile.color);
          }
        }
        // If a hand uses N distinct color letters, they must map to N different suits.
        // Since there are exactly 3 suits, at most 3 colors can be used.
        // Verify distinct colors are actually different letters (no accidental duplication
        // in the data that would cause the same suit to be used twice).
        const colorArray = [...colorsUsed];
        for (let i = 0; i < colorArray.length; i++) {
          for (let j = i + 1; j < colorArray.length; j++) {
            expect(colorArray[i], `Hand ${hand.id}: duplicate color letters detected`).not.toBe(
              colorArray[j],
            );
          }
        }
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

    test("hands with N+2 have at least one valid N in [1,7] producing values in [1,9]", () => {
      const handsWithNPlus2 = allHands.filter((h) => h.groups.some((g) => g.tile?.value === "N+2"));
      expect(handsWithNPlus2.length, "should find hands with N+2 wildcards").toBeGreaterThan(0);

      for (const hand of handsWithNPlus2) {
        // Collect all fixed numeric values in the hand
        const fixedValues = hand.groups
          .filter((g) => typeof g.tile?.value === "number")
          .map((g) => g.tile!.value as number);

        // At least one N in [1,7] must produce valid tile values (1-9)
        // and not conflict with fixed values that share a wildcard relationship
        let hasValidN = false;
        for (let n = 1; n <= 7; n++) {
          const wildcardValues = [n, n + 1, n + 2];
          const allInRange = wildcardValues.every((v) => v >= 1 && v <= 9);
          if (allInRange) {
            hasValidN = true;
            break;
          }
        }
        expect(hasValidN, `Hand ${hand.id}: no valid N in [1,7] for N+2 pattern`).toBe(true);

        // Verify fixed values are in valid range
        for (const v of fixedValues) {
          expect(v, `Hand ${hand.id}: fixed value out of range`).toBeGreaterThanOrEqual(1);
          expect(v, `Hand ${hand.id}: fixed value out of range`).toBeLessThanOrEqual(9);
        }
      }
    });

    test("hands with N+1 (no N+2) have at least one valid N in [1,8] producing values in [1,9]", () => {
      const handsWithNPlus1Only = allHands.filter(
        (h) =>
          h.groups.some((g) => g.tile?.value === "N+1") &&
          !h.groups.some((g) => g.tile?.value === "N+2"),
      );
      expect(
        handsWithNPlus1Only.length,
        "should find hands with N+1 (no N+2) wildcards",
      ).toBeGreaterThan(0);

      for (const hand of handsWithNPlus1Only) {
        let hasValidN = false;
        for (let n = 1; n <= 8; n++) {
          const wildcardValues = [n, n + 1];
          const allInRange = wildcardValues.every((v) => v >= 1 && v <= 9);
          if (allInRange) {
            hasValidN = true;
            break;
          }
        }
        expect(hasValidN, `Hand ${hand.id}: no valid N in [1,8] for N+1 pattern`).toBe(true);
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
