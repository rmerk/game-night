import { describe, it, expect } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import DiscardPool from "./DiscardPool.vue";
import type { SuitedTile, WindTile, DragonTile, Tile } from "@mahjong-game/shared";

function makeTiles(count: number): Tile[] {
  const suits = ["bam", "crak", "dot"] as const;
  const tiles: Tile[] = [];
  for (let i = 0; i < count; i++) {
    const suit = suits[i % 3];
    const value = ((i % 9) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
    const copy = Math.floor(i / 9) + 1;
    tiles.push({
      id: `${suit}-${value}-${copy}`,
      category: "suited",
      suit,
      value,
      copy,
    } as SuitedTile);
  }
  return tiles;
}

describe("DiscardPool", () => {
  it("renders empty state when no tiles", () => {
    const wrapper = mount(DiscardPool, {
      props: { tiles: [], position: "bottom" },
    });
    expect(wrapper.find("[data-testid='discard-pool']").exists()).toBe(true);
    expect(wrapper.findAll(".tile").length).toBe(0);
  });

  it("renders tiles at small size", () => {
    const tiles = makeTiles(3);
    const wrapper = mount(DiscardPool, {
      props: { tiles, position: "bottom" },
    });
    const tileEls = wrapper.findAll(".tile");
    expect(tileEls.length).toBe(3);
    tileEls.forEach((el) => {
      expect(el.classes()).toContain("tile--size-small");
    });
  });

  it("renders tiles as non-interactive (role=img)", () => {
    const tiles = makeTiles(2);
    const wrapper = mount(DiscardPool, {
      props: { tiles, position: "bottom" },
    });
    const tileEls = wrapper.findAll(".tile");
    tileEls.forEach((el) => {
      expect(el.attributes("role")).toBe("img");
    });
  });

  it("applies latest-discard class to the last tile only", () => {
    const tiles = makeTiles(4);
    const wrapper = mount(DiscardPool, {
      props: { tiles, position: "bottom" },
    });
    const tileWrappers = wrapper.findAll("[data-testid='discard-tile']");
    expect(tileWrappers.length).toBe(4);
    // Only the last one should have the latest-discard class
    for (let i = 0; i < tileWrappers.length - 1; i++) {
      expect(tileWrappers[i].classes()).not.toContain("latest-discard");
    }
    expect(tileWrappers[tileWrappers.length - 1].classes()).toContain("latest-discard");
  });

  it("wraps tiles into rows of 6", () => {
    const tiles = makeTiles(8);
    const wrapper = mount(DiscardPool, {
      props: { tiles, position: "bottom" },
    });
    const rows = wrapper.findAll("[data-testid='discard-row']");
    expect(rows.length).toBe(2);
  });

  it("handles exact multiples of 6 tiles per row", () => {
    const tiles = makeTiles(12);
    const wrapper = mount(DiscardPool, {
      props: { tiles, position: "bottom" },
    });
    const rows = wrapper.findAll("[data-testid='discard-row']");
    expect(rows.length).toBe(2);
  });

  it("renders 3+ rows for 18+ tiles", () => {
    const tiles = makeTiles(20);
    const wrapper = mount(DiscardPool, {
      props: { tiles, position: "bottom" },
    });
    const rows = wrapper.findAll("[data-testid='discard-row']");
    expect(rows.length).toBe(4);
  });

  it("has accessible label", () => {
    const wrapper = mount(DiscardPool, {
      props: { tiles: [], position: "top" },
    });
    const pool = wrapper.find("[data-testid='discard-pool']");
    expect(pool.attributes("aria-label")).toContain("discard");
  });

  it("accepts all four seat positions", () => {
    for (const position of ["top", "bottom", "left", "right"] as const) {
      const wrapper = mount(DiscardPool, {
        props: { tiles: makeTiles(1), position },
      });
      expect(wrapper.find("[data-testid='discard-pool']").exists()).toBe(true);
    }
  });
});
