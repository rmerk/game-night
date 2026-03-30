import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Tile from "./Tile.vue";
import TileSprite from "./TileSprite.vue";
import type { SuitedTile, WindTile, DragonTile, FlowerTile, JokerTile } from "@mahjong-game/shared";

// --- Test fixtures ---
const bam3: SuitedTile = {
  id: "bam-3-2",
  category: "suited",
  suit: "bam",
  value: 3,
  copy: 2,
};

const crak7: SuitedTile = {
  id: "crak-7-1",
  category: "suited",
  suit: "crak",
  value: 7,
  copy: 1,
};

const dot1: SuitedTile = {
  id: "dot-1-4",
  category: "suited",
  suit: "dot",
  value: 1,
  copy: 4,
};

const windNorth: WindTile = {
  id: "wind-north-1",
  category: "wind",
  value: "north",
  copy: 1,
};

const windEast: WindTile = {
  id: "wind-east-2",
  category: "wind",
  value: "east",
  copy: 2,
};

const dragonRed: DragonTile = {
  id: "dragon-red-1",
  category: "dragon",
  value: "red",
  copy: 1,
};

const dragonSoap: DragonTile = {
  id: "dragon-soap-3",
  category: "dragon",
  value: "soap",
  copy: 3,
};

const flowerA: FlowerTile = {
  id: "flower-a-1",
  category: "flower",
  value: "a",
  copy: 1,
};

const flowerB: FlowerTile = {
  id: "flower-b-2",
  category: "flower",
  value: "b",
  copy: 2,
};

const joker: JokerTile = { id: "joker-5", category: "joker", copy: 5 };

describe("Tile — SVG symbol ID mapping", () => {
  it("maps suited tile to {suit}-{value}", () => {
    const wrapper = mount(Tile, { props: { tile: bam3 } });
    const use = wrapper.find("use");
    expect(use.attributes("href")).toBe("#bam-3");
    wrapper.unmount();
  });

  it("maps all three suits correctly", () => {
    for (const [tile, expected] of [
      [bam3, "#bam-3"],
      [crak7, "#crak-7"],
      [dot1, "#dot-1"],
    ] as const) {
      const wrapper = mount(Tile, { props: { tile } });
      expect(wrapper.find("use").attributes("href")).toBe(expected);
      wrapper.unmount();
    }
  });

  it("maps wind tile to wind-{value}", () => {
    const wrapper = mount(Tile, { props: { tile: windNorth } });
    expect(wrapper.find("use").attributes("href")).toBe("#wind-north");
    wrapper.unmount();
  });

  it("maps dragon tile to dragon-{value}", () => {
    const wrapper = mount(Tile, { props: { tile: dragonRed } });
    expect(wrapper.find("use").attributes("href")).toBe("#dragon-red");
    wrapper.unmount();
  });

  it("maps flower tile to flower-{value}", () => {
    const wrapper = mount(Tile, { props: { tile: flowerA } });
    expect(wrapper.find("use").attributes("href")).toBe("#flower-a");
    wrapper.unmount();
  });

  it("maps joker to joker", () => {
    const wrapper = mount(Tile, { props: { tile: joker } });
    expect(wrapper.find("use").attributes("href")).toBe("#joker");
    wrapper.unmount();
  });
});

describe("Tile — aria-label generation", () => {
  it('labels suited tile as "N of Suit"', () => {
    const wrapper = mount(Tile, { props: { tile: bam3 } });
    expect(wrapper.attributes("aria-label")).toBe("3 of Bamboo");
    wrapper.unmount();
  });

  it("labels crak suit correctly", () => {
    const wrapper = mount(Tile, { props: { tile: crak7 } });
    expect(wrapper.attributes("aria-label")).toBe("7 of Crack");
    wrapper.unmount();
  });

  it("labels dot suit correctly", () => {
    const wrapper = mount(Tile, { props: { tile: dot1 } });
    expect(wrapper.attributes("aria-label")).toBe("1 of Dot");
    wrapper.unmount();
  });

  it('labels wind as "Direction Wind"', () => {
    const wrapper = mount(Tile, { props: { tile: windNorth } });
    expect(wrapper.attributes("aria-label")).toBe("North Wind");
    wrapper.unmount();
  });

  it('labels east wind as "East Wind"', () => {
    const wrapper = mount(Tile, { props: { tile: windEast } });
    expect(wrapper.attributes("aria-label")).toBe("East Wind");
    wrapper.unmount();
  });

  it('labels dragon as "Color Dragon"', () => {
    const wrapper = mount(Tile, { props: { tile: dragonRed } });
    expect(wrapper.attributes("aria-label")).toBe("Red Dragon");
    wrapper.unmount();
  });

  it('labels soap dragon as "Soap Dragon"', () => {
    const wrapper = mount(Tile, { props: { tile: dragonSoap } });
    expect(wrapper.attributes("aria-label")).toBe("Soap Dragon");
    wrapper.unmount();
  });

  it('labels flower as "Flower X"', () => {
    const wrapper = mount(Tile, { props: { tile: flowerA } });
    expect(wrapper.attributes("aria-label")).toBe("Flower A");
    wrapper.unmount();
  });

  it('labels flower B as "Flower B"', () => {
    const wrapper = mount(Tile, { props: { tile: flowerB } });
    expect(wrapper.attributes("aria-label")).toBe("Flower B");
    wrapper.unmount();
  });

  it('labels joker as "Joker"', () => {
    const wrapper = mount(Tile, { props: { tile: joker } });
    expect(wrapper.attributes("aria-label")).toBe("Joker");
    wrapper.unmount();
  });

  it('labels face-down tile as "Face-down tile"', () => {
    const wrapper = mount(Tile, {
      props: { tile: bam3, state: "face-down" },
    });
    expect(wrapper.attributes("aria-label")).toBe("Face-down tile");
    wrapper.unmount();
  });
});

describe("Tile — size variants", () => {
  it("applies standard size class by default", () => {
    const wrapper = mount(Tile, { props: { tile: bam3 } });
    expect(wrapper.classes()).toContain("tile--size-standard");
    wrapper.unmount();
  });

  it("applies small size class", () => {
    const wrapper = mount(Tile, { props: { tile: bam3, size: "small" } });
    expect(wrapper.classes()).toContain("tile--size-small");
    wrapper.unmount();
  });

  it("applies celebration size class", () => {
    const wrapper = mount(Tile, {
      props: { tile: bam3, size: "celebration" },
    });
    expect(wrapper.classes()).toContain("tile--size-celebration");
    wrapper.unmount();
  });
});

describe("Tile — state classes", () => {
  it("applies default state class by default", () => {
    const wrapper = mount(Tile, { props: { tile: bam3 } });
    expect(wrapper.classes()).toContain("tile--default");
    wrapper.unmount();
  });

  it("applies selected state class", () => {
    const wrapper = mount(Tile, { props: { tile: bam3, state: "selected" } });
    expect(wrapper.classes()).toContain("tile--selected");
    wrapper.unmount();
  });

  it("applies disabled state class", () => {
    const wrapper = mount(Tile, { props: { tile: bam3, state: "disabled" } });
    expect(wrapper.classes()).toContain("tile--disabled");
    wrapper.unmount();
  });

  it("applies face-down state class", () => {
    const wrapper = mount(Tile, {
      props: { tile: bam3, state: "face-down" },
    });
    expect(wrapper.classes()).toContain("tile--face-down");
    wrapper.unmount();
  });
});

describe("Tile — face-down renders tile-back", () => {
  it("uses #tile-back href when face-down", () => {
    const wrapper = mount(Tile, {
      props: { tile: bam3, state: "face-down" },
    });
    expect(wrapper.find("use").attributes("href")).toBe("#tile-back");
    wrapper.unmount();
  });

  it("uses tile symbol href when not face-down", () => {
    const wrapper = mount(Tile, { props: { tile: bam3, state: "default" } });
    expect(wrapper.find("use").attributes("href")).toBe("#bam-3");
    wrapper.unmount();
  });
});

describe("Tile — accessibility role", () => {
  it('has role="button" when interactive', () => {
    const wrapper = mount(Tile, {
      props: { tile: bam3, interactive: true },
    });
    expect(wrapper.attributes("role")).toBe("button");
    wrapper.unmount();
  });

  it('has role="img" when not interactive', () => {
    const wrapper = mount(Tile, {
      props: { tile: bam3, interactive: false },
    });
    expect(wrapper.attributes("role")).toBe("img");
    wrapper.unmount();
  });

  it("has tabindex=0 when interactive", () => {
    const wrapper = mount(Tile, {
      props: { tile: bam3, interactive: true },
    });
    expect(wrapper.attributes("tabindex")).toBe("0");
    wrapper.unmount();
  });

  it("has no tabindex when not interactive", () => {
    const wrapper = mount(Tile, {
      props: { tile: bam3, interactive: false },
    });
    expect(wrapper.attributes("tabindex")).toBeUndefined();
    wrapper.unmount();
  });

  it("sets aria-disabled when disabled", () => {
    const wrapper = mount(Tile, {
      props: { tile: bam3, state: "disabled" },
    });
    expect(wrapper.attributes("aria-disabled")).toBe("true");
    wrapper.unmount();
  });
});

describe("Tile — click and keyboard interaction", () => {
  it("emits select on click when interactive", async () => {
    const wrapper = mount(Tile, {
      props: { tile: bam3, interactive: true },
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("select")).toBeTruthy();
    expect(wrapper.emitted("select")![0]).toEqual([bam3]);
    wrapper.unmount();
  });

  it("does not emit select on click when disabled", async () => {
    const wrapper = mount(Tile, {
      props: { tile: bam3, state: "disabled", interactive: true },
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("select")).toBeFalsy();
    wrapper.unmount();
  });

  it("does not emit select on click when not interactive", async () => {
    const wrapper = mount(Tile, {
      props: { tile: bam3, interactive: false },
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("select")).toBeFalsy();
    wrapper.unmount();
  });

  it("emits select on Enter key", async () => {
    const wrapper = mount(Tile, {
      props: { tile: bam3, interactive: true },
    });
    await wrapper.trigger("keydown.enter");
    expect(wrapper.emitted("select")).toBeTruthy();
    wrapper.unmount();
  });

  it("emits select on Space key", async () => {
    const wrapper = mount(Tile, {
      props: { tile: bam3, interactive: true },
    });
    await wrapper.trigger("keydown.space");
    expect(wrapper.emitted("select")).toBeTruthy();
    wrapper.unmount();
  });
});

describe("TileSprite — symbol coverage", () => {
  it("contains all 38 expected symbol elements", () => {
    const wrapper = mount(TileSprite);
    const symbols = wrapper.findAll("symbol");
    expect(symbols.length).toBe(38);
    wrapper.unmount();
  });

  it("contains all expected symbol IDs", () => {
    const wrapper = mount(TileSprite);
    const symbolIds = wrapper.findAll("symbol").map((s) => s.attributes("id"));

    // 9 bam + 9 crak + 9 dot
    for (const suit of ["bam", "crak", "dot"]) {
      for (let v = 1; v <= 9; v++) {
        expect(symbolIds).toContain(`${suit}-${v}`);
      }
    }

    // 4 winds
    for (const w of ["north", "east", "west", "south"]) {
      expect(symbolIds).toContain(`wind-${w}`);
    }

    // 3 dragons
    for (const d of ["red", "green", "soap"]) {
      expect(symbolIds).toContain(`dragon-${d}`);
    }

    // 2 flowers
    expect(symbolIds).toContain("flower-a");
    expect(symbolIds).toContain("flower-b");

    // joker + tile-back
    expect(symbolIds).toContain("joker");
    expect(symbolIds).toContain("tile-back");

    wrapper.unmount();
  });
});

describe("SVG sprite sheet file — symbol coverage", () => {
  it("contains all 38 symbol IDs in the standalone SVG file", () => {
    const svgPath = resolve(__dirname, "tile-assets", "tiles.svg");
    const svgContent = readFileSync(svgPath, "utf-8");

    const expectedIds = [
      ...["bam", "crak", "dot"].flatMap((s) =>
        Array.from({ length: 9 }, (_, i) => `${s}-${i + 1}`),
      ),
      "wind-north",
      "wind-east",
      "wind-west",
      "wind-south",
      "dragon-red",
      "dragon-green",
      "dragon-soap",
      "flower-a",
      "flower-b",
      "joker",
      "tile-back",
    ];

    expect(expectedIds).toHaveLength(38);

    for (const id of expectedIds) {
      expect(svgContent).toContain(`id="${id}"`);
    }
  });
});
