import { describe, test, expect } from "vite-plus/test";
import { loadCard } from "./card-loader";
import { buildTilesForHand } from "../testing/tile-builders";
import { suitedTile } from "../testing/tile-builders";
import type { ExposedGroup } from "../types/game-state";
import { rankHandsForGuidance } from "./hand-guidance";
import { minAdditionalTilesForPattern, matchesSpecificPattern } from "./pattern-matcher";

const card = loadCard("2026");

describe("minAdditionalTilesForPattern / matchesSpecificPattern", () => {
  test("14-tile winning ev-2 → distance 0", () => {
    const tiles = buildTilesForHand(card, "ev-2", { A: "bam", B: "crak", C: "dot" });
    expect(tiles).toHaveLength(14);
    expect(
      minAdditionalTilesForPattern(
        tiles,
        card.categories.flatMap((c) => c.hands).find((h) => h.id === "ev-2")!,
      ),
    ).toBe(0);
    const pattern = card.categories.flatMap((c) => c.hands).find((h) => h.id === "ev-2")!;
    expect(matchesSpecificPattern(tiles, pattern)).toBe(true);
  });

  test("13 tiles one away from ev-2 pair → distance 1", () => {
    const full = buildTilesForHand(card, "ev-2", { A: "bam", B: "crak", C: "dot" });
    const bam8 = full.filter((t) => t.category === "suited" && t.suit === "bam" && t.value === 8);
    const removeId = bam8[0].id;
    const thirteen = full.filter((t) => t.id !== removeId);
    expect(thirteen).toHaveLength(13);
    const pattern = card.categories.flatMap((c) => c.hands).find((h) => h.id === "ev-2")!;
    expect(minAdditionalTilesForPattern(thirteen, pattern)).toBe(1);
  });

  test("14 tiles that match no pattern → null distance for that pattern", () => {
    const specs: { suit: "bam"; value: number }[] = [
      { suit: "bam", value: 1 },
      { suit: "bam", value: 3 },
      { suit: "bam", value: 5 },
      { suit: "bam", value: 7 },
      { suit: "bam", value: 9 },
      { suit: "bam", value: 2 },
      { suit: "bam", value: 4 },
    ];
    const tiles = specs.flatMap((s, i) => [
      suitedTile(s.suit, s.value as 1, i * 2 + 1),
      suitedTile(s.suit, s.value as 1, i * 2 + 2),
    ]);
    expect(tiles).toHaveLength(14);
    const pattern = card.categories.flatMap((c) => c.hands).find((h) => h.id === "ev-2")!;
    expect(minAdditionalTilesForPattern(tiles, pattern)).toBeNull();
  });
});

describe("rankHandsForGuidance", () => {
  test("full ev-2 rack: ev-2 achievable distance 0", () => {
    const tiles = buildTilesForHand(card, "ev-2", { A: "bam", B: "crak", C: "dot" });
    const rows = rankHandsForGuidance(tiles, [], card);
    const ev2 = rows.find((r) => r.patternId === "ev-2");
    expect(ev2?.achievable).toBe(true);
    expect(ev2?.distance).toBe(0);
  });

  test("concealed-only pattern excluded when player has exposures (FR63)", () => {
    const concealed = card.categories.flatMap((c) => c.hands).find((h) => h.exposure === "C");
    expect(concealed).toBeDefined();
    const exposedGroups: ExposedGroup[] = [
      {
        type: "pung",
        tiles: [suitedTile("bam", 1, 1), suitedTile("bam", 1, 2), suitedTile("bam", 1, 3)],
        identity: { type: "pung", suit: "bam", value: 1 },
      },
    ];
    const tiles = buildTilesForHand(card, "ev-2", { A: "bam", B: "crak", C: "dot" });
    const rows = rankHandsForGuidance(tiles, exposedGroups, card);
    const cRow = rows.find((r) => r.patternId === concealed!.id);
    expect(cRow?.achievable).toBe(false);
  });
});

describe("hand-guidance NFR8 note (non-regression)", () => {
  test("full 2026 card ranking completes within generous ceiling", () => {
    const tiles = buildTilesForHand(card, "ev-2", { A: "bam", B: "crak", C: "dot" });
    const t0 = performance.now();
    rankHandsForGuidance(tiles, [], card);
    const ms = performance.now() - t0;
    // Loose bound — product SLA is manual <100ms (AC2); avoid CI flakes on slow runners.
    expect(ms).toBeLessThanOrEqual(5000);
  });
});
