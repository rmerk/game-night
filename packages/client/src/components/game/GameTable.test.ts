import { describe, it, expect, vi } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import GameTable from "./GameTable.vue";
import { useRackStore } from "../../stores/rack";
import type { SuitedTile, Tile, CallWindowState, GameResult } from "@mahjong-game/shared";
import type { LocalPlayerSummary, OpponentPlayer } from "./seat-types";

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

const mockPlayers: { top: OpponentPlayer; left: OpponentPlayer; right: OpponentPlayer } = {
  top: {
    id: "player-north",
    name: "Alice",
    initial: "A",
    connected: true,
    seatWind: "north",
    score: 30,
  },
  left: {
    id: "player-west",
    name: "Bob",
    initial: "B",
    connected: true,
    seatWind: "west",
    score: -5,
  },
  right: {
    id: "player-east",
    name: "Carol",
    initial: "C",
    connected: false,
    seatWind: "east",
    score: -25,
  },
};

const localPlayer: LocalPlayerSummary = {
  id: "player-south",
  name: "You",
  seatWind: "south",
  score: 25,
};

const mockGameResult: GameResult = {
  winnerId: "player-south",
  patternId: "double-run",
  patternName: "Double Run",
  points: 50,
  selfDrawn: false,
  discarderId: "player-east",
  payments: {
    "player-south": 150,
    "player-east": -50,
    "player-west": -50,
    "player-north": -50,
  },
};

const mockCallWindow: CallWindowState = {
  status: "open",
  discardedTile: {
    id: "bam-1-1",
    category: "suited",
    suit: "bam",
    value: 1,
    copy: 1,
  } as SuitedTile,
  discarderId: "player-2",
  passes: [],
  calls: [],
  openedAt: Date.now(),
  confirmingPlayerId: null,
  confirmationExpiresAt: null,
  remainingCallers: [],
  winningCall: null,
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

  it("renders a turn indicator badge with the active player's name", () => {
    const wrapper = mountTable({
      localPlayer,
      currentTurnSeat: "south",
    });

    expect(wrapper.get("[data-testid='turn-indicator']").text()).toContain("You");
  });

  it("shows compact local player score and highlights only the active seat", () => {
    const wrapper = mountTable({
      localPlayer,
      currentTurnSeat: "north",
    });

    expect(wrapper.get("[data-testid='local-player-score']").text()).toBe("Score: 25");
    expect(wrapper.get("[data-testid='opponent-area-shell']").classes()).toContain(
      "ring-state-turn-active",
    );
    expect(wrapper.get("[data-testid='local-player-status-shell']").classes()).not.toContain(
      "ring-state-turn-active",
    );
  });

  it("replaces the wall placeholder with the real wall counter component", () => {
    const wrapper = mountTable({
      wallRemaining: 20,
    });

    expect(wrapper.get("[data-testid='wall-counter']").text()).toContain("Wall: 20");
    expect(wrapper.get("[data-testid='wall-counter']").classes()).toContain("wall-warning");
  });

  it("positions the wall counter above the discard pools in the center area", () => {
    const wrapper = mountTable({
      wallRemaining: 20,
    });
    const center = wrapper.get("[data-testid='table-center']").element;
    const wallCounter = center.querySelector("[data-testid='wall-counter']");
    const discardPools = center.querySelector("[data-testid='discard-pools']");

    expect(wallCounter).not.toBeNull();
    expect(discardPools).not.toBeNull();
    expect(
      Boolean(
        wallCounter &&
        discardPools &&
        wallCounter.compareDocumentPosition(discardPools) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  it("renders the scoreboard breakdown only during scoreboard phase", () => {
    const wrapper = mountTable({
      gamePhase: "scoreboard",
      localPlayer,
      gameResult: mockGameResult,
    });

    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("You");
    expect(wrapper.find("[data-testid='wall-counter']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='rack-area']").exists()).toBe(false);
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

describe("GameTable — call buttons integration", () => {
  it("renders CallButtons when callWindow is open", () => {
    const wrapper = mountTable({
      callWindow: mockCallWindow,
      validCallOptions: ["pung", "kong"],
    });
    expect(wrapper.find("[data-testid='call-pung']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='call-kong']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='call-pass']").exists()).toBe(true);
  });

  it("renders DiscardConfirm when callWindow is null", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const rackStore = useRackStore();
    rackStore.selectTile("dot-7-1");

    const wrapper = mount(GameTable, {
      props: {
        opponents: mockPlayers,
        tiles: [
          { id: "dot-7-1", category: "suited", suit: "dot", value: 7, copy: 1 } as SuitedTile,
        ],
        isPlayerTurn: true,
        callWindow: null,
      },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });

    expect(wrapper.find("[data-testid='discard-confirm']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='call-pung']").exists()).toBe(false);
  });

  it("does not show DiscardConfirm when callWindow is open", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const rackStore = useRackStore();
    rackStore.selectTile("dot-7-1");

    const wrapper = mount(GameTable, {
      props: {
        opponents: mockPlayers,
        tiles: [
          { id: "dot-7-1", category: "suited", suit: "dot", value: 7, copy: 1 } as SuitedTile,
        ],
        isPlayerTurn: true,
        callWindow: mockCallWindow,
        validCallOptions: ["pung"],
      },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });

    expect(wrapper.find("[data-testid='discard-confirm']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='call-pung']").exists()).toBe(true);
  });

  it("emits call event when call button clicked", async () => {
    const wrapper = mountTable({
      callWindow: mockCallWindow,
      validCallOptions: ["pung"],
    });

    await wrapper.find("[data-testid='call-pung']").trigger("click");
    expect(wrapper.emitted("call")).toEqual([["pung"]]);
  });

  it("emits pass event when pass button clicked", async () => {
    const wrapper = mountTable({
      callWindow: mockCallWindow,
      validCallOptions: ["pung"],
    });

    await wrapper.find("[data-testid='call-pass']").trigger("click");
    expect(wrapper.emitted("pass")).toHaveLength(1);
  });

  it("wraps CallButtons in a Transition for exit animation", () => {
    const wrapper = mountTable({
      callWindow: mockCallWindow,
      validCallOptions: ["pung"],
    });
    const transition = wrapper.findComponent({ name: "Transition" });
    expect(transition.exists()).toBe(true);
    expect(transition.find("[data-testid='call-pung']").exists()).toBe(true);
  });
});

describe("GameTable — Mahjong button integration", () => {
  it("always renders the Mahjong button when no call window is open", () => {
    const wrapper = mountTable();
    expect(wrapper.find("[data-testid='mahjong-button']").exists()).toBe(true);
  });

  it("hides the persistent Mahjong button when the call window already offers Mahjong", () => {
    const wrapper = mountTable({
      callWindow: mockCallWindow,
      validCallOptions: ["mahjong", "pung"],
    });

    const button = wrapper.get("[data-testid='mahjong-button']");
    expect(button.attributes("style")).toContain("display: none");
    expect(wrapper.find("[data-testid='call-mahjong']").exists()).toBe(true);
  });

  it("keeps the persistent Mahjong button visible when the call window does not offer Mahjong", () => {
    const wrapper = mountTable({
      callWindow: mockCallWindow,
      validCallOptions: ["pung"],
    });

    const button = wrapper.get("[data-testid='mahjong-button']");
    expect(button.attributes("style")).toBeUndefined();
    expect(wrapper.find("[data-testid='call-pung']").exists()).toBe(true);
  });

  it("emits declareMahjong when the persistent button is clicked outside a call window", async () => {
    const wrapper = mountTable();

    await wrapper.get("[data-testid='mahjong-button']").trigger("click");

    expect(wrapper.emitted("declareMahjong")).toEqual([[]]);
  });

  it("emits call('mahjong') when the persistent button is clicked during a call window", async () => {
    const wrapper = mountTable({
      callWindow: mockCallWindow,
      validCallOptions: ["pung"],
    });

    await wrapper.get("[data-testid='mahjong-button']").trigger("click");

    expect(wrapper.emitted("call")).toContainEqual(["mahjong"]);
  });

  it("renders invalid Mahjong feedback only when a message is provided", () => {
    const hiddenWrapper = mountTable();
    expect(hiddenWrapper.find("[data-testid='invalid-mahjong-notification']").exists()).toBe(false);

    const visibleWrapper = mountTable({
      invalidMahjongMessage: "Not a valid Mahjong hand.",
    });
    expect(visibleWrapper.find("[data-testid='invalid-mahjong-notification']").exists()).toBe(true);
  });

  it("emits cancelMahjong when the invalid Mahjong notification is cancelled", async () => {
    const wrapper = mountTable({
      invalidMahjongMessage: "Not a valid Mahjong hand.",
    });

    await wrapper.get("[data-testid='cancel-mahjong']").trigger("click");

    expect(wrapper.emitted("cancelMahjong")).toEqual([[]]);
  });
});
