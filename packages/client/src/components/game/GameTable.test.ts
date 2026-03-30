import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import GameTable from "./GameTable.vue";
import { useRackStore } from "../../stores/rack";
import type { SuitedTile, Tile } from "@mahjong-game/shared";

// Mock Vue DnD Kit (needed by TileRack)
vi.mock("@vue-dnd-kit/core", () => ({
  DnDProvider: {
    name: "DnDProvider",
    template: "<div><slot /></div>",
  },
  makeDraggable: () => ({
    isDragging: { value: false },
    isDragOver: { value: undefined },
  }),
  makeDroppable: () => ({ isDragOver: { value: undefined } }),
  useDnDProvider: () => ({
    keyboard: {
      keys: { forDrag: [], forMove: [], forCancel: [] },
      step: 8,
      moveFaster: 4,
    },
  }),
}));

const mockPlayers = {
  top: { name: "Alice", initial: "A", connected: true },
  left: { name: "Bob", initial: "B", connected: true },
  right: { name: "Carol", initial: "C", connected: false },
};

function mountTable(props: Record<string, unknown> = {}) {
  return mount(GameTable, {
    props: {
      opponents: mockPlayers,
      ...props,
    },
    global: {
      plugins: [createPinia()],
      stubs: {
        TileSprite: { template: "<svg />" },
      },
    },
  });
}

describe("GameTable — layout structure", () => {
  it("renders the game table container", () => {
    const wrapper = mountTable();
    expect(wrapper.find("[data-testid='game-table']").exists()).toBe(true);
  });

  it("renders with felt background class", () => {
    const wrapper = mountTable();
    const table = wrapper.find("[data-testid='game-table']");
    expect(table.classes()).toContain("bg-felt-teal");
  });

  it("renders opponent-top area", () => {
    const wrapper = mountTable();
    expect(wrapper.find("[data-testid='opponent-top']").exists()).toBe(true);
  });

  it("renders opponent-left area", () => {
    const wrapper = mountTable();
    expect(wrapper.find("[data-testid='opponent-left']").exists()).toBe(true);
  });

  it("renders opponent-right area", () => {
    const wrapper = mountTable();
    expect(wrapper.find("[data-testid='opponent-right']").exists()).toBe(true);
  });

  it("renders table-center area", () => {
    const wrapper = mountTable();
    expect(wrapper.find("[data-testid='table-center']").exists()).toBe(true);
  });

  it("renders action-zone area", () => {
    const wrapper = mountTable();
    expect(wrapper.find("[data-testid='action-zone']").exists()).toBe(true);
  });

  it("renders rack-area", () => {
    const wrapper = mountTable();
    expect(wrapper.find("[data-testid='rack-area']").exists()).toBe(true);
  });

  it("renders center area with minimum height constraint class", () => {
    const wrapper = mountTable();
    const center = wrapper.find("[data-testid='table-center']");
    // Check for min-height class (min-h-[40dvh])
    expect(center.classes().some((c: string) => c.includes("min-h-"))).toBe(true);
  });
});

describe("GameTable — max width constraint", () => {
  it("applies max-width constraint for ultra-wide viewports", () => {
    const wrapper = mountTable();
    const table = wrapper.find("[data-testid='game-table']");
    expect(table.classes().some((c: string) => c.includes("max-w-"))).toBe(true);
  });
});

describe("GameTable — layout integration", () => {
  it("renders TileRack in the rack area", () => {
    const wrapper = mountTable();
    const rackArea = wrapper.find("[data-testid='rack-area']");
    expect(rackArea.find('[role="list"]').exists()).toBe(true);
  });

  it("renders ActionZone with toolbar role", () => {
    const wrapper = mountTable();
    expect(wrapper.find("[role='toolbar']").exists()).toBe(true);
  });

  it("renders mobile bottom bar", () => {
    const wrapper = mountTable();
    expect(wrapper.find("[data-testid='mobile-bottom-bar']").exists()).toBe(true);
  });

  it("renders opponent names in opponent areas", () => {
    const wrapper = mountTable();
    expect(wrapper.text()).toContain("Alice");
    expect(wrapper.text()).toContain("Bob");
    expect(wrapper.text()).toContain("Carol");
  });
});

describe("GameTable — accessibility", () => {
  it("action zone has role='toolbar' with aria-label", () => {
    const wrapper = mountTable();
    const toolbar = wrapper.find("[role='toolbar']");
    expect(toolbar.attributes("aria-label")).toBe("Game actions");
  });

  it("rack area applies safe-area padding class for tablet+", () => {
    const wrapper = mountTable();
    const rackArea = wrapper.find("[data-testid='rack-area']");
    expect(rackArea.classes().some((c: string) => c.includes("md:pb-"))).toBe(true);
  });

  it("uses full dynamic viewport height", () => {
    const wrapper = mountTable();
    const table = wrapper.find("[data-testid='game-table']");
    expect(table.classes().some((c: string) => c.includes("min-h-"))).toBe(true);
  });
});

describe("GameTable — discard pools", () => {
  const mockDiscardTiles: Tile[] = [
    { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 } as SuitedTile,
    { id: "crak-2-1", category: "suited", suit: "crak", value: 2, copy: 1 } as SuitedTile,
  ];

  it("renders discard pools area", () => {
    const wrapper = mountTable({
      discardPools: { bottom: mockDiscardTiles },
    });
    expect(wrapper.find("[data-testid='discard-pools']").exists()).toBe(true);
  });

  it("renders discard pool tiles when provided", () => {
    const wrapper = mountTable({
      discardPools: { bottom: mockDiscardTiles },
    });
    const pools = wrapper.findAll("[data-testid='discard-pool']");
    expect(pools.length).toBe(4);
  });
});

describe("GameTable — two-step discard integration", () => {
  const rackTiles: Tile[] = [
    { id: "dot-7-1", category: "suited", suit: "dot", value: 7, copy: 1 } as SuitedTile,
    { id: "bam-3-2", category: "suited", suit: "bam", value: 3, copy: 2 } as SuitedTile,
  ];

  it("shows discard confirm button when tile is selected and it is player turn", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const rackStore = useRackStore();
    rackStore.selectTile("dot-7-1");

    const wrapper = mount(GameTable, {
      props: { opponents: mockPlayers, tiles: rackTiles, isPlayerTurn: true },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });

    expect(wrapper.find("[data-testid='discard-confirm']").exists()).toBe(true);
  });

  it("does not show discard confirm when no tile selected", () => {
    const wrapper = mountTable({ tiles: rackTiles, isPlayerTurn: true });
    expect(wrapper.find("[data-testid='discard-confirm']").exists()).toBe(false);
  });

  it("emits discard event and clears selection on confirm", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const rackStore = useRackStore();
    rackStore.selectTile("dot-7-1");

    const wrapper = mount(GameTable, {
      props: { opponents: mockPlayers, tiles: rackTiles, isPlayerTurn: true },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });

    await wrapper.find("[data-testid='discard-confirm']").trigger("click");
    expect(wrapper.emitted("discard")).toEqual([["dot-7-1"]]);
    expect(rackStore.selectedTileId).toBeNull();
  });
});
