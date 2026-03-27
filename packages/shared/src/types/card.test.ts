import { describe, test, expect } from "vite-plus/test";
import type {
  NMJLCard,
  CardCategory,
  HandPattern,
  GroupPattern,
  TileRequirement,
  TileSpecific,
  GroupType,
} from "./card";

describe("Card schema types", () => {
  test("NMJLCard accepts valid structure", () => {
    const card: NMJLCard = {
      year: 2026,
      categories: [
        {
          name: "2468",
          hands: [
            {
              id: "ev-1",
              points: 25,
              exposure: "C",
              groups: [
                {
                  type: "kong",
                  tile: { color: "A", value: 2 },
                  jokerEligible: true,
                  concealed: true,
                },
              ],
            },
          ],
        },
      ],
    };
    expect(card.year).toBe(2026);
    expect(card.categories).toHaveLength(1);
  });

  test("HandPattern accepts optional name field", () => {
    const hand: HandPattern = {
      id: "cr-1",
      name: "Three-Suit Run Kongs",
      points: 25,
      exposure: "X",
      groups: [{ type: "kong", tile: { color: "A", value: "N" }, jokerEligible: true }],
    };
    expect(hand.name).toBe("Three-Suit Run Kongs");
  });

  test("GroupPattern accepts all valid group types", () => {
    const types: GroupType[] = [
      "single",
      "pair",
      "pung",
      "kong",
      "quint",
      "sextet",
      "news",
      "dragon_set",
    ];
    expect(types).toHaveLength(8);
  });

  test("GroupPattern accepts news without tile field", () => {
    const group: GroupPattern = {
      type: "news",
      jokerEligible: true,
    };
    expect(group.type).toBe("news");
    expect(group.tile).toBeUndefined();
  });

  test("GroupPattern accepts dragon_set without tile field", () => {
    const group: GroupPattern = {
      type: "dragon_set",
      jokerEligible: true,
    };
    expect(group.type).toBe("dragon_set");
    expect(group.tile).toBeUndefined();
  });

  test("TileRequirement accepts color+value for suited tiles", () => {
    const tile: TileRequirement = { color: "A", value: 3 };
    expect(tile.color).toBe("A");
    expect(tile.value).toBe(3);
  });

  test("TileRequirement accepts value wildcards", () => {
    const tile: TileRequirement = { color: "B", value: "N+1" };
    expect(tile.value).toBe("N+1");
  });

  test("TileRequirement accepts category+specific for honor tiles", () => {
    const tile: TileRequirement = { category: "dragon", specific: "soap" };
    expect(tile.category).toBe("dragon");
    expect(tile.specific).toBe("soap");
  });

  test("TileSpecific accepts wind values", () => {
    const specifics: TileSpecific[] = ["north", "south", "east", "west"];
    expect(specifics).toHaveLength(4);
  });

  test("TileSpecific accepts dragon values", () => {
    const specifics: TileSpecific[] = ["red", "green", "soap"];
    expect(specifics).toHaveLength(3);
  });

  test("TileSpecific accepts any", () => {
    const specific: TileSpecific = "any";
    expect(specific).toBe("any");
  });

  test("TileSpecific accepts any_different:N template literal", () => {
    const specific: TileSpecific = "any_different:1";
    expect(specific).toBe("any_different:1");
    const specific2: TileSpecific = "any_different:2";
    expect(specific2).toBe("any_different:2");
  });

  test("exposure only accepts X or C", () => {
    const exposed: HandPattern["exposure"] = "X";
    const concealed: HandPattern["exposure"] = "C";
    expect(exposed).toBe("X");
    expect(concealed).toBe("C");
  });

  test("CardCategory has name and hands", () => {
    const cat: CardCategory = {
      name: "Quints",
      hands: [],
    };
    expect(cat.name).toBe("Quints");
    expect(cat.hands).toEqual([]);
  });

  test("invalid exposure rejected at compile time", () => {
    // @ts-expect-error — exposure must be 'X' or 'C', not arbitrary string
    const _hand: HandPattern["exposure"] = "Z";
    void _hand;
  });

  test("invalid group type rejected at compile time", () => {
    // @ts-expect-error — group type must be a valid GroupType
    const _group: GroupType = "invalid_type";
    void _group;
  });
});
