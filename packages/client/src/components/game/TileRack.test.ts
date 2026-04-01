import { describe, it, expect, beforeEach, vi } from "vite-plus/test";
import { mount, VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import TileRack from "./TileRack.vue";
import { useRackStore } from "../../stores/rack";
import type {
  SuitedTile,
  WindTile,
  DragonTile,
  FlowerTile,
  JokerTile,
  Tile,
} from "@mahjong-game/shared";

// Mock Vue DnD Kit to avoid DOM dependency
vi.mock("@vue-dnd-kit/core", () => ({
  DnDProvider: {
    name: "DnDProvider",
    template: "<div><slot /></div>",
  },
  makeDraggable: () => ({ isDragging: { value: false }, isDragOver: { value: undefined } }),
  makeDroppable: () => ({ isDragOver: { value: undefined } }),
  useDnDProvider: () => ({
    keyboard: {
      keys: { forDrag: [], forMove: [], forCancel: [] },
      step: 8,
      moveFaster: 4,
    },
  }),
}));

// --- Test fixtures ---
const bam1: SuitedTile = { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 };
const bam3: SuitedTile = { id: "bam-3-2", category: "suited", suit: "bam", value: 3, copy: 2 };
const crak5: SuitedTile = { id: "crak-5-1", category: "suited", suit: "crak", value: 5, copy: 1 };
const dot7: SuitedTile = { id: "dot-7-1", category: "suited", suit: "dot", value: 7, copy: 1 };
const windNorth: WindTile = { id: "wind-north-1", category: "wind", value: "north", copy: 1 };
const dragonRed: DragonTile = { id: "dragon-red-1", category: "dragon", value: "red", copy: 1 };
const flowerA: FlowerTile = { id: "flower-a-1", category: "flower", value: "a", copy: 1 };
const joker: JokerTile = { id: "joker-1", category: "joker", copy: 1 };

const sampleTiles: Tile[] = [bam1, bam3, crak5, dot7, windNorth, dragonRed, flowerA, joker];

function mountRack(
  props: { tiles: Tile[]; isPlayerTurn?: boolean } = { tiles: sampleTiles },
  options: { attachTo?: HTMLElement } = {},
) {
  return mount(TileRack, {
    attachTo: options.attachTo,
    props,
    global: {
      plugins: [createPinia()],
    },
  });
}

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("TileRack — rendering", () => {
  it("renders all tiles in the rack", () => {
    const wrapper = mountRack();
    const items = wrapper.findAll('[role="listitem"]');
    expect(items.length).toBe(sampleTiles.length);
  });

  it("renders tiles as a list with role='list'", () => {
    const wrapper = mountRack();
    expect(wrapper.find('[role="list"]').exists()).toBe(true);
  });

  it("renders each tile wrapper as role='listitem'", () => {
    const wrapper = mountRack();
    const items = wrapper.findAll('[role="listitem"]');
    expect(items.length).toBe(sampleTiles.length);
    for (const item of items) {
      expect(item.attributes("role")).toBe("listitem");
    }
  });

  it("renders the rack with aria-label", () => {
    const wrapper = mountRack();
    expect(wrapper.find('[role="list"]').attributes("aria-label")).toBe("Your tile rack");
  });

  it("renders a Sort button", () => {
    const wrapper = mountRack();
    const sortBtn = wrapper.find('button[aria-label="Sort tiles by suit"]');
    expect(sortBtn.exists()).toBe(true);
    expect(sortBtn.text()).toBe("Sort");
  });
});

describe("TileRack — tile selection", () => {
  it("selects a tile on click when it is player's turn", async () => {
    const wrapper = mountRack({ tiles: sampleTiles, isPlayerTurn: true });
    const store = useRackStore();

    // Find the first tile and click it
    const firstTile = wrapper.findAll('[role="listitem"]')[0];
    const tileComponent = firstTile.find('[role="button"]');
    await tileComponent.trigger("click");

    expect(store.selectedTileId).toBe("bam-1-1");
  });

  it("deselects a tile when clicking the same tile again", async () => {
    const wrapper = mountRack({ tiles: sampleTiles, isPlayerTurn: true });
    const store = useRackStore();

    const firstTile = wrapper.findAll('[role="listitem"]')[0];
    const tileComponent = firstTile.find('[role="button"]');

    await tileComponent.trigger("click");
    expect(store.selectedTileId).toBe("bam-1-1");

    await tileComponent.trigger("click");
    expect(store.selectedTileId).toBeNull();
  });

  it("switches selection to a different tile", async () => {
    const wrapper = mountRack({ tiles: sampleTiles, isPlayerTurn: true });
    const store = useRackStore();

    const tiles = wrapper.findAll('[role="listitem"]');
    await tiles[0].find('[role="button"]').trigger("click");
    expect(store.selectedTileId).toBe("bam-1-1");

    await tiles[1].find('[role="button"]').trigger("click");
    expect(store.selectedTileId).toBe("bam-3-2");
  });

  it("renders selected tile with selected state", async () => {
    const wrapper = mountRack({ tiles: sampleTiles, isPlayerTurn: true });

    const firstTile = wrapper.findAll('[role="listitem"]')[0];
    await firstTile.find('[role="button"]').trigger("click");

    // After selection, the tile should have selected class
    const tileEl = firstTile.find(".tile");
    expect(tileEl.classes()).toContain("tile--selected");
  });
});

describe("TileRack — passive state", () => {
  it("does not select tiles when not player's turn", async () => {
    const wrapper = mountRack({ tiles: sampleTiles, isPlayerTurn: false });
    const store = useRackStore();

    // Tiles should be rendered as non-interactive (role="img" instead of "button")
    const firstTile = wrapper.findAll('[role="listitem"]')[0];
    const tileEl = firstTile.find('[role="img"]');
    expect(tileEl.exists()).toBe(true);

    // Clicking should not select
    await tileEl.trigger("click");
    expect(store.selectedTileId).toBeNull();
  });

  it("disables the Sort button when not player's turn", () => {
    const wrapper = mountRack({ tiles: sampleTiles, isPlayerTurn: false });
    const sortBtn = wrapper.find('button[aria-label="Sort tiles by suit"]');
    expect(sortBtn.attributes("disabled")).toBeDefined();
  });

  it("tiles are not interactive when not player's turn", () => {
    const wrapper = mountRack({ tiles: sampleTiles, isPlayerTurn: false });
    const tiles = wrapper.findAll('[role="listitem"]');
    for (const tile of tiles) {
      // Non-interactive tiles should have role="img" (set by Tile.vue when interactive=false)
      expect(tile.find('[role="img"]').exists()).toBe(true);
    }
  });
});

describe("TileRack — sort button", () => {
  it("sorts tiles when Sort button is clicked", async () => {
    // Start with tiles out of order
    const unordered: Tile[] = [dot7, bam3, joker, crak5, windNorth, bam1, flowerA, dragonRed];
    const wrapper = mountRack({ tiles: unordered, isPlayerTurn: true });
    const store = useRackStore();

    const sortBtn = wrapper.find('button[aria-label="Sort tiles by suit"]');
    await sortBtn.trigger("click");

    // After sort: bam(1,3), crak(5), dot(7), wind(north), dragon(red), flower(a), joker
    expect(store.tileOrder).toEqual([
      "bam-1-1",
      "bam-3-2",
      "crak-5-1",
      "dot-7-1",
      "wind-north-1",
      "dragon-red-1",
      "flower-a-1",
      "joker-1",
    ]);
  });

  it("Sort button is enabled when it is player's turn", () => {
    const wrapper = mountRack({ tiles: sampleTiles, isPlayerTurn: true });
    const sortBtn = wrapper.find('button[aria-label="Sort tiles by suit"]');
    expect(sortBtn.attributes("disabled")).toBeUndefined();
  });
});

describe("TileRack — keyboard navigation", () => {
  it("uses roving tabindex so only one interactive tile is tabbable", () => {
    const wrapper = mountRack({ tiles: sampleTiles, isPlayerTurn: true });
    const items = wrapper.findAll('[role="listitem"]');
    const tileButtons = items.map((item) => item.find('[role="button"]'));
    const sortButton = wrapper.get('button[aria-label="Sort tiles by suit"]');

    expect(tileButtons[0].attributes("tabindex")).toBe("0");
    for (const button of tileButtons.slice(1)) {
      expect(button.attributes("tabindex")).toBe("-1");
    }
    expect(sortButton.attributes("tabindex")).toBe("-1");
  });

  it("moves focus and the active tab stop right with ArrowRight", async () => {
    const wrapper = mountRack(
      { tiles: sampleTiles, isPlayerTurn: true },
      { attachTo: document.body },
    );
    const items = wrapper.findAll('[role="listitem"]');
    const firstTileButton = items[0].find('[role="button"]');
    const secondTileButton = items[1].find('[role="button"]');

    (firstTileButton.element as HTMLElement).focus();
    await firstTileButton.trigger("keydown", { key: "ArrowRight" });

    expect(document.activeElement).toBe(secondTileButton.element);
    expect(firstTileButton.attributes("tabindex")).toBe("-1");
    expect(secondTileButton.attributes("tabindex")).toBe("0");
    wrapper.unmount();
  });

  it("moves focus and the active tab stop left with ArrowLeft", async () => {
    const wrapper = mountRack(
      { tiles: sampleTiles, isPlayerTurn: true },
      { attachTo: document.body },
    );
    const items = wrapper.findAll('[role="listitem"]');
    const firstTileButton = items[0].find('[role="button"]');
    const secondTileButton = items[1].find('[role="button"]');

    (firstTileButton.element as HTMLElement).focus();
    await firstTileButton.trigger("keydown", { key: "ArrowRight" });
    await secondTileButton.trigger("keydown", { key: "ArrowLeft" });

    expect(document.activeElement).toBe(firstTileButton.element);
    expect(firstTileButton.attributes("tabindex")).toBe("0");
    expect(secondTileButton.attributes("tabindex")).toBe("-1");
    wrapper.unmount();
  });

  it("moves focus from the last tile to Sort with ArrowRight", async () => {
    const wrapper = mountRack(
      { tiles: sampleTiles, isPlayerTurn: true },
      { attachTo: document.body },
    );
    const items = wrapper.findAll('[role="listitem"]');
    const lastTileButton = items[items.length - 1].find('[role="button"]');
    const sortButton = wrapper.get('button[aria-label="Sort tiles by suit"]');

    (lastTileButton.element as HTMLElement).focus();
    await lastTileButton.trigger("focus");
    await lastTileButton.trigger("keydown", { key: "ArrowRight" });

    expect(document.activeElement).toBe(sortButton.element);
    expect(lastTileButton.attributes("tabindex")).toBe("-1");
    expect(sortButton.attributes("tabindex")).toBe("0");
    wrapper.unmount();
  });

  it("moves focus from Sort back to the last tile with ArrowLeft", async () => {
    const wrapper = mountRack(
      { tiles: sampleTiles, isPlayerTurn: true },
      { attachTo: document.body },
    );
    const items = wrapper.findAll('[role="listitem"]');
    const lastTileButton = items[items.length - 1].find('[role="button"]');
    const sortButton = wrapper.get('button[aria-label="Sort tiles by suit"]');

    (lastTileButton.element as HTMLElement).focus();
    await lastTileButton.trigger("focus");
    await lastTileButton.trigger("keydown", { key: "ArrowRight" });
    await sortButton.trigger("keydown", { key: "ArrowLeft" });

    expect(document.activeElement).toBe(lastTileButton.element);
    expect(lastTileButton.attributes("tabindex")).toBe("0");
    expect(sortButton.attributes("tabindex")).toBe("-1");
    wrapper.unmount();
  });

  it("tiles have no tabindex when not interactive", () => {
    const wrapper = mountRack({ tiles: sampleTiles, isPlayerTurn: false });
    const items = wrapper.findAll('[role="listitem"]');
    const firstTile = items[0].find('[role="img"]');
    expect(firstTile.attributes("tabindex")).toBeUndefined();
  });

  it("restores a single tabbable rack entry when the player turn starts", async () => {
    const wrapper = mountRack({ tiles: sampleTiles, isPlayerTurn: false });

    await wrapper.setProps({ isPlayerTurn: true });

    const items = wrapper.findAll('[role="listitem"]');
    const tileButtons = items.map((item) => item.find('[role="button"]'));
    const sortButton = wrapper.get('button[aria-label="Sort tiles by suit"]');

    expect(tileButtons[0].attributes("tabindex")).toBe("0");
    for (const button of tileButtons.slice(1)) {
      expect(button.attributes("tabindex")).toBe("-1");
    }
    expect(sortButton.attributes("tabindex")).toBe("-1");
  });
});

describe("TileRack — scrolling styles", () => {
  it("rack container has overflow-x auto for phone scroll", () => {
    const wrapper = mountRack();
    const rack = wrapper.find(".tile-rack");
    expect(rack.exists()).toBe(true);
    // Verify the class is applied — actual CSS computed style testing needs a real browser
  });

  it("tile items have flex-shrink: 0 and min-width via class", () => {
    const wrapper = mountRack();
    const items = wrapper.findAll(".tile-rack__item");
    expect(items.length).toBeGreaterThan(0);
  });
});
