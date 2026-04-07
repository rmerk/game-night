import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { flushPromises, mount } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import GameTable from "./GameTable.vue";
import SlideInReferencePanels from "../chat/SlideInReferencePanels.vue";
import { useRackStore } from "../../stores/rack";
import { useSlideInPanelStore } from "../../stores/slideInPanel";
import { useReactionsStore } from "../../stores/reactions";
import { useActivityTickerStore } from "../../stores/activityTicker";
import { useLiveKitStore } from "../../stores/liveKit";
import { expectHtmlElement } from "../../test-utils/expect-html-element";
import {
  DEFAULT_ROOM_SETTINGS,
  PROTOCOL_VERSION,
  WALL_WARNING_THRESHOLD,
  type SuitedTile,
  type Tile,
  type TileValue,
  type CallWindowState,
  type GameResult,
  type WallGameResult,
  type PlayerCharlestonView,
  type ResolvedAction,
} from "@mahjong-game/shared";
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

/**
 * Celebration stub that immediately emits `done` on mount, so tests that
 * focus on scoreboard content don't block on the 5–8 s animation sequence.
 */
const AutoDoneCelebrationStub = {
  name: "Celebration",
  props: ["gameResult", "playerNamesById", "winnerId", "winnerSeat"],
  emits: ["done"],
  template: "<div />",
  mounted(this: { $emit: (event: string) => void }) {
    this.$emit("done");
  },
};

function mountTable(props: Record<string, unknown> = {}, pinia?: Pinia) {
  return mount(GameTable, {
    props: {
      opponents: mockPlayers,
      ...props,
    },
    global: {
      plugins: [pinia ?? createPinia()],
      stubs: {
        TileSprite: { template: "<svg />" },
        Celebration: AutoDoneCelebrationStub,
      },
    },
  });
}

function makeNTilesForGuidanceTest(n: number): Tile[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `gt-bam-${i}-c${(i % 4) + 1}`,
    category: "suited" as const,
    suit: "bam" as const,
    value: ((i % 9) + 1) as TileValue,
    copy: ((i % 4) + 1) as 1 | 2 | 3 | 4,
  }));
}

describe("GameTable — simultaneous disconnect pause", () => {
  it("shows pause banner when paused prop is true", () => {
    const wrapper = mountTable({ paused: true });
    expect(wrapper.find('[data-testid="game-paused-banner"]').exists()).toBe(true);
  });

  it("does not render pause banner when paused is false", () => {
    const wrapper = mountTable({ paused: false });
    expect(wrapper.find('[data-testid="game-paused-banner"]').exists()).toBe(false);
  });
});

describe("GameTable — leave game (4B.5)", () => {
  it("shows leave button in play phase and opens confirm dialog", async () => {
    const wrapper = mount(GameTable, {
      attachTo: document.body,
      props: {
        opponents: mockPlayers,
        gamePhase: "play",
      },
      global: {
        plugins: [createPinia()],
        stubs: {
          TileSprite: { template: "<svg />" },
        },
      },
    });
    const leaveBtn = wrapper.find('[data-testid="leave-game-button"]');
    expect(leaveBtn.exists()).toBe(true);
    await leaveBtn.trigger("click");
    await flushPromises();
    expect(document.querySelector('[data-testid="leave-game-confirm-dialog"]')).not.toBeNull();
    wrapper.unmount();
  });
});

describe("GameTable — felt grain overlay (AC 1)", () => {
  it("renders felt-grain-overlay element with aria-hidden during playing phase", () => {
    const wrapper = mountTable({ gamePhase: "play" });
    const overlay = wrapper.find("[data-testid='felt-grain-overlay']");
    expect(overlay.exists()).toBe(true);
    expect(overlay.attributes("aria-hidden")).toBe("true");
  });

  it("does not render felt-grain-overlay during scoreboard phase", () => {
    const wrapper = mountTable({
      gamePhase: "scoreboard",
      localPlayer,
      gameResult: mockGameResult,
    });
    expect(wrapper.find("[data-testid='felt-grain-overlay']").exists()).toBe(false);
  });

  it("does not render felt-grain-overlay during rematch phase", () => {
    const wrapper = mountTable({
      gamePhase: "rematch",
      localPlayer,
      gameResult: mockGameResult,
    });
    expect(wrapper.find("[data-testid='felt-grain-overlay']").exists()).toBe(false);
  });

  it("felt-grain-overlay has pointer-events-none class", () => {
    const wrapper = mountTable({ gamePhase: "play" });
    const overlay = wrapper.find("[data-testid='felt-grain-overlay']");
    expect(overlay.classes()).toContain("pointer-events-none");
  });

  it("renders felt-grain-overlay element during charleston phase (playing mood)", () => {
    const wrapper = mountTable({ gamePhase: "charleston" });
    expect(wrapper.find("[data-testid='felt-grain-overlay']").exists()).toBe(true);
  });
});

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

describe("GameTable — reaction bubbles", () => {
  it("renders a bubble on opponent-top when anchor resolver maps player to top", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const reactions = useReactionsStore();
    reactions.pushBroadcast({
      version: PROTOCOL_VERSION,
      type: "REACTION_BROADCAST",
      playerId: "player-north",
      playerName: "Alice",
      emoji: "🎉",
      timestamp: 42,
    });

    const wrapper = mountTable(
      {
        reactionAnchorForPlayer: (id: string) => (id === "player-north" ? "top" : null),
      },
      pinia,
    );

    const top = wrapper.get('[data-testid="opponent-top"]');
    expect(top.text()).toContain("🎉");
    wrapper.unmount();
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
  it("renders a skip link that targets the gameplay region", () => {
    const wrapper = mountTable();
    const skipLink = wrapper.get("[data-testid='skip-to-game-table']");

    expect(skipLink.attributes("href")).toBe("#gameplay-region");
    expect(skipLink.text()).toBe("Skip to game table");
  });

  it("exposes gameplay focus zones in rack, actions, chat, controls order", () => {
    const wrapper = mountTable();

    const rackEntry = wrapper.get("[data-testid='rack-zone-entry']").element;
    const actionEntry = wrapper.get("[data-testid='action-zone-entry']").element;
    const chatZone = wrapper.get("[data-testid='chat-shell-anchor']").element;
    const controlsEntry = wrapper.get("[data-testid='controls-zone-entry']").element;

    expect(
      rackEntry.compareDocumentPosition(actionEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      actionEntry.compareDocumentPosition(chatZone) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      chatZone.compareDocumentPosition(controlsEntry) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("returns focus to the action zone when Escape is pressed in the chat input", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(GameTable, {
      attachTo: document.body,
      props: {
        opponents: mockPlayers,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TileSprite: { template: "<svg />" },
        },
      },
    });
    useSlideInPanelStore().openChat();
    await flushPromises();
    await wrapper.vm.$nextTick();

    const actionEntry = expectHtmlElement(wrapper.get("[data-testid='action-zone-entry']").element);
    const chatInput = wrapper.get("[data-testid='chat-panel-input']");

    expectHtmlElement(chatInput.element).focus();
    await chatInput.trigger("keydown", { key: "Escape" });

    expect(document.activeElement).toBe(actionEntry);
    wrapper.unmount();
  });

  it("keeps chat panel mounted during scoreboard phase and returns Escape focus to scoreboard sink", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(GameTable, {
      attachTo: document.body,
      props: {
        opponents: mockPlayers,
        gamePhase: "scoreboard",
        localPlayer,
        gameResult: mockGameResult,
      },
      global: {
        plugins: [pinia],
        stubs: {
          TileSprite: { template: "<svg />" },
        },
      },
    });
    useSlideInPanelStore().openChat();
    await flushPromises();
    await wrapper.vm.$nextTick();

    expect(wrapper.find("[data-testid='chat-panel-input']").exists()).toBe(true);

    const scoreboardSink = expectHtmlElement(
      wrapper.get("[data-testid='scoreboard-chat-focus-return']").element,
    );
    const chatInput = wrapper.get("[data-testid='chat-panel-input']");
    expectHtmlElement(chatInput.element).focus();
    await chatInput.trigger("keydown", { key: "Escape" });

    expect(document.activeElement).toBe(scoreboardSink);
    wrapper.unmount();
  });

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

  it("shows local voice status dot with disconnected label when LiveKit is idle", async () => {
    const wrapper = mountTable({ localPlayer });
    await flushPromises();
    const dot = wrapper.get('[data-testid="local-voice-status-dot"]');
    expect(dot.attributes("aria-label")).toBe("Voice disconnected");
    expect(dot.classes()).toContain("bg-text-secondary");
  });

  it("shows local voice status dot with connected label when LiveKit store is connected", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useLiveKitStore().setConnectionStatus("connected");
    const wrapper = mountTable({ localPlayer }, pinia);
    await flushPromises();
    const dot = wrapper.get('[data-testid="local-voice-status-dot"]');
    expect(dot.attributes("aria-label")).toBe("Voice connected");
    expect(dot.classes()).toContain("bg-state-success");
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
      wallRemaining: WALL_WARNING_THRESHOLD,
    });

    expect(wrapper.get("[data-testid='wall-counter']").text()).toContain(
      `Wall: ${WALL_WARNING_THRESHOLD}`,
    );
    expect(wrapper.get("[data-testid='wall-counter']").classes()).toContain("border-wall-warning");
  });

  it("positions the wall counter above the discard pools in the center area", () => {
    const wrapper = mountTable({
      wallRemaining: WALL_WARNING_THRESHOLD,
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

  it("renders the scoreboard breakdown only during scoreboard phase", async () => {
    const wrapper = mountTable({
      gamePhase: "scoreboard",
      localPlayer,
      gameResult: mockGameResult,
    });
    await flushPromises();

    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("You");
    expect(wrapper.find("[data-testid='wall-counter']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='rack-area']").exists()).toBe(false);
  });

  it("applies scoreboard gradient background to the table root during scoreboard phase", () => {
    const wrapper = mountTable({
      gamePhase: "scoreboard",
      localPlayer,
      gameResult: mockGameResult,
    });
    // mood-lingering is now authoritative at RoomView root level; GameTable applies gradient only
    const tableClasses = wrapper.get("[data-testid='game-table']").classes();
    expect(tableClasses).not.toContain("mood-lingering");
    expect(tableClasses.join(" ")).toContain("bg-gradient-to-b");
  });

  it("applies scoreboard gradient background to the table root during rematch phase", () => {
    const wrapper = mountTable({
      gamePhase: "rematch",
      localPlayer,
      gameResult: mockGameResult,
    });
    // mood-lingering is now authoritative at RoomView root level; GameTable applies gradient only
    const tableClasses = wrapper.get("[data-testid='game-table']").classes();
    expect(tableClasses).not.toContain("mood-lingering");
    expect(tableClasses.join(" ")).toContain("bg-gradient-to-b");
  });

  it("shows cumulative session totals (prior games + current scores) on the scoreboard", async () => {
    const wrapper = mountTable({
      gamePhase: "scoreboard",
      localPlayer,
      gameResult: mockGameResult,
      sessionScoresFromPriorGames: { "player-south": 100 },
      scoresByPlayerId: {
        "player-south": 25,
        "player-east": -10,
        "player-west": -5,
        "player-north": -10,
      },
    });
    await flushPromises();

    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("+125");
  });
});

describe("GameTable — shown hands (5B.5)", () => {
  const showTile: Tile = {
    id: "bam-1-1",
    category: "suited",
    suit: "bam",
    value: 1,
    copy: 1,
  } as SuitedTile;

  it("does not render local shown-hand strip during play phase", () => {
    const wrapper = mountTable({
      gamePhase: "play",
      localPlayer,
      shownHands: { "player-south": [showTile] },
    });
    expect(wrapper.find('[data-testid="shown-hand-local"]').exists()).toBe(false);
  });

  it("renders local shown hand during scoreboard when server included entry", async () => {
    const wrapper = mountTable({
      gamePhase: "scoreboard",
      localPlayer,
      gameResult: mockGameResult,
      shownHands: { "player-south": [showTile] },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="shown-hand-local"]').exists()).toBe(true);
    expect(wrapper.get('[data-testid="shown-hand-local"]').text()).toContain("You");
  });

  it("renders top opponent shown hand during scoreboard", () => {
    const wrapper = mountTable({
      gamePhase: "scoreboard",
      localPlayer,
      gameResult: mockGameResult,
      shownHands: { "player-north": [showTile] },
    });
    expect(
      wrapper.get('[data-testid="opponent-top"]').find('[data-testid="shown-hand-top"]').exists(),
    ).toBe(true);
    expect(wrapper.get('[data-testid="shown-hand-top"]').text()).toContain("Alice");
  });

  it("renders right opponent shown hand during scoreboard", () => {
    const wrapper = mountTable({
      gamePhase: "scoreboard",
      localPlayer,
      gameResult: mockGameResult,
      shownHands: { "player-east": [showTile] },
    });
    expect(
      wrapper
        .get('[data-testid="opponent-right"]')
        .find('[data-testid="shown-hand-right"]')
        .exists(),
    ).toBe(true);
    expect(wrapper.get('[data-testid="shown-hand-right"]').text()).toContain("Carol");
  });

  it("renders left/right shown hands in mobile fallback during scoreboard", async () => {
    const wrapper = mountTable({
      gamePhase: "scoreboard",
      localPlayer,
      gameResult: mockGameResult,
      shownHands: { "player-west": [showTile], "player-east": [showTile] },
    });
    await flushPromises();
    const mobile = wrapper.get('[data-testid="scoreboard-shown-hands-mobile-sides"]');
    expect(mobile.find('[data-testid="shown-hand-left"]').exists()).toBe(true);
    expect(mobile.find('[data-testid="shown-hand-right"]').exists()).toBe(true);
  });

  it("shows hand-shown toast when resolvedAction is HAND_SHOWN", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(GameTable, {
      props: {
        opponents: mockPlayers,
        gamePhase: "scoreboard",
        localPlayer,
        gameResult: mockGameResult,
        resolvedAction: null,
      },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });
    await wrapper.setProps({
      resolvedAction: { type: "HAND_SHOWN", playerId: "player-north" },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="hand-shown-toast"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="hand-shown-toast"]').text()).toContain("Alice");
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
    const transitions = wrapper.findAllComponents({ name: "Transition" });
    const callTransition = transitions.find((t) => t.find("[data-testid='call-pung']").exists());
    expect(callTransition).toBeDefined();
    expect(callTransition!.find("[data-testid='call-pung']").exists()).toBe(true);
  });
});

describe("GameTable — call confirmation (3C.9)", () => {
  const confirmingPungWindow: CallWindowState = {
    ...mockCallWindow,
    status: "confirming",
    confirmingPlayerId: localPlayer.id,
    confirmationExpiresAt: Date.now() + 5000,
    winningCall: {
      callType: "pung",
      playerId: localPlayer.id,
      tileIds: ["bam-1-1", "bam-1-2"],
    },
  };

  const rackTwoBam: Tile[] = [
    { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 } as SuitedTile,
    { id: "bam-1-2", category: "suited", suit: "bam", value: 1, copy: 2 } as SuitedTile,
    { id: "dot-7-1", category: "suited", suit: "dot", value: 7, copy: 1 } as SuitedTile,
  ];

  it("shows confirmation toolbar and hides CallButtons when status is confirming", () => {
    const wrapper = mountTable({
      callWindow: confirmingPungWindow,
      validCallOptions: [],
      localPlayer,
      tiles: rackTwoBam,
      isPlayerTurn: false,
    });
    expect(wrapper.find("[data-testid='call-confirmation-toolbar']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='call-pung']").exists()).toBe(false);
  });

  it("keeps rack interactive for confirming player when not player turn", () => {
    const wrapper = mountTable({
      callWindow: confirmingPungWindow,
      localPlayer,
      tiles: rackTwoBam,
      isPlayerTurn: false,
    });
    const rack = wrapper.find("[data-testid='rack-area'] [role='list']");
    expect(rack.exists()).toBe(true);
    expect(rack.attributes("aria-disabled")).toBeUndefined();
  });

  it("does not show DiscardConfirm during confirming", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useRackStore().selectTile("bam-1-1");

    const wrapper = mount(GameTable, {
      props: {
        opponents: mockPlayers,
        localPlayer,
        tiles: rackTwoBam,
        isPlayerTurn: true,
        callWindow: confirmingPungWindow,
        validCallOptions: [],
      },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });
    expect(wrapper.find("[data-testid='discard-confirm']").exists()).toBe(false);
  });

  it("emits retractCall when Retract is clicked", async () => {
    const wrapper = mountTable({
      callWindow: confirmingPungWindow,
      localPlayer,
      tiles: rackTwoBam,
      isPlayerTurn: false,
    });
    await wrapper.find("[data-testid='call-confirmation-retract']").trigger("click");
    expect(wrapper.emitted("retractCall")).toEqual([[]]);
  });

  it("disables Confirm until enough tiles are selected for pung", async () => {
    const wrapper = mountTable({
      callWindow: confirmingPungWindow,
      localPlayer,
      tiles: rackTwoBam,
      isPlayerTurn: false,
    });
    const confirmBtn = wrapper.get("[data-testid='call-confirmation-confirm']");
    expect(confirmBtn.attributes("disabled")).toBeDefined();

    const buttons = wrapper.findAll("[data-rack-tile-id] [role='button']");
    await buttons[0]?.trigger("click");
    await buttons[1]?.trigger("click");
    await flushPromises();
    expect(confirmBtn.attributes("disabled")).toBeUndefined();

    await confirmBtn.trigger("click");
    expect(wrapper.emitted("confirmCall")).toEqual([[{ tileIds: ["bam-1-1", "bam-1-2"] }]]);
  });

  it("hides MahjongButton while confirming", () => {
    const wrapper = mountTable({
      callWindow: confirmingPungWindow,
      localPlayer,
      tiles: rackTwoBam,
    });
    expect(wrapper.find("[data-testid='mahjong-button']").exists()).toBe(false);
  });

  it("Mahjong confirmation shows Confirm Mahjong and emits single tile id", async () => {
    const confirmingMj: CallWindowState = {
      ...mockCallWindow,
      status: "confirming",
      confirmingPlayerId: localPlayer.id,
      confirmationExpiresAt: Date.now() + 5000,
      winningCall: {
        callType: "mahjong",
        playerId: localPlayer.id,
        tileIds: ["dot-7-1"],
      },
    };
    const wrapper = mountTable({
      callWindow: confirmingMj,
      localPlayer,
      tiles: rackTwoBam,
      isPlayerTurn: false,
    });
    expect(wrapper.text()).toContain("Confirm your Mahjong");
    await wrapper.find("[data-testid='call-confirmation-confirm']").trigger("click");
    expect(wrapper.emitted("confirmCall")).toEqual([[{ tileIds: ["bam-1-1"] }]]);
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

describe("GameTable — action zone keyboard navigation", () => {
  const rackTiles: Tile[] = [
    { id: "dot-7-1", category: "suited", suit: "dot", value: 7, copy: 1 } as SuitedTile,
    { id: "bam-3-2", category: "suited", suit: "bam", value: 3, copy: 2 } as SuitedTile,
  ];

  it("moves focus across action controls with ArrowRight and ArrowLeft", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useRackStore().selectTile("dot-7-1");

    const wrapper = mount(GameTable, {
      attachTo: document.body,
      props: {
        opponents: mockPlayers,
        tiles: rackTiles,
        isPlayerTurn: true,
      },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });

    const mahjongButton = wrapper.get("[data-testid='mahjong-button']");
    const discardButton = wrapper.get("[data-testid='discard-confirm']");

    expectHtmlElement(mahjongButton.element).focus();
    await mahjongButton.trigger("keydown", { key: "ArrowRight" });
    expect(document.activeElement).toBe(discardButton.element);

    await discardButton.trigger("keydown", { key: "ArrowLeft" });
    expect(document.activeElement).toBe(mahjongButton.element);

    wrapper.unmount();
  });

  it("keeps focus on a valid action control when the available controls change", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useRackStore().selectTile("dot-7-1");

    const wrapper = mount(GameTable, {
      attachTo: document.body,
      props: {
        opponents: mockPlayers,
        tiles: rackTiles,
        isPlayerTurn: true,
        callWindow: mockCallWindow,
        validCallOptions: ["pung", "kong"],
      },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });

    const kongButton = wrapper.get("[data-testid='call-kong']");
    expectHtmlElement(kongButton.element).focus();

    await wrapper.setProps({
      callWindow: null,
      validCallOptions: [],
    });
    await flushPromises();

    const rawActive = document.activeElement;
    expect(rawActive).not.toBeNull();
    const activeElement = expectHtmlElement(rawActive);
    const toolbar = wrapper.get("[role='toolbar']").element;
    const validControls = [
      wrapper.get("[data-testid='mahjong-button']").element,
      wrapper.get("[data-testid='discard-confirm']").element,
    ];

    expect(toolbar.contains(activeElement)).toBe(true);
    expect(validControls).toContain(activeElement);

    wrapper.unmount();
  });

  it("skips the hidden persistent Mahjong button when the call window already exposes Mahjong", async () => {
    const wrapper = mount(GameTable, {
      attachTo: document.body,
      props: {
        opponents: mockPlayers,
        tiles: rackTiles,
        isPlayerTurn: true,
        callWindow: mockCallWindow,
        validCallOptions: ["mahjong", "pung"],
      },
      global: {
        plugins: [createPinia()],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });

    const hiddenPersistentMahjongButton = wrapper.get("[data-testid='mahjong-button']");
    const visibleCallMahjongButton = wrapper.get("[data-testid='call-mahjong']");
    const passButton = wrapper.get("[data-testid='call-pass']");

    expect(hiddenPersistentMahjongButton.attributes("style")).toContain("display: none");
    expect(hiddenPersistentMahjongButton.attributes("tabindex")).toBeUndefined();
    expect(visibleCallMahjongButton.attributes("tabindex")).toBe("0");
    expect(passButton.attributes("tabindex")).toBe("-1");

    wrapper.unmount();
  });
});

describe("GameTable — charleston", () => {
  const rackTilesCharleston: Tile[] = [
    { id: "dot-7-1", category: "suited", suit: "dot", value: 7, copy: 1 } as SuitedTile,
    { id: "bam-3-2", category: "suited", suit: "bam", value: 3, copy: 2 } as SuitedTile,
    { id: "crak-2-1", category: "suited", suit: "crak", value: 2, copy: 1 } as SuitedTile,
  ];

  const charlestonPassing: PlayerCharlestonView = {
    stage: "first",
    status: "passing",
    currentDirection: "right",
    activePlayerIds: [],
    submittedPlayerIds: [],
    votesReceivedCount: 0,
    courtesyPairings: [],
    courtesyResolvedPairCount: 0,
    myHiddenTileCount: 0,
    mySubmissionLocked: false,
    myVote: null,
    myCourtesySubmission: null,
  };

  it("renders CharlestonZone and hides discard pools during passing", () => {
    const wrapper = mountTable({
      gamePhase: "charleston",
      tiles: rackTilesCharleston,
      localPlayer,
      charleston: charlestonPassing,
    });
    expect(wrapper.find("[data-testid='charleston-zone']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='discard-pools']").exists()).toBe(false);
  });

  it("renders CourtesyPassUI when courtesy-ready", () => {
    const wrapper = mountTable({
      gamePhase: "charleston",
      tiles: rackTilesCharleston,
      localPlayer,
      charleston: {
        ...charlestonPassing,
        stage: "courtesy",
        status: "courtesy-ready",
        currentDirection: null,
      },
    });
    expect(wrapper.find("[data-testid='courtesy-pass-ui']").exists()).toBe(true);
  });

  it("renders CharlestonVote in action zone when vote-ready", () => {
    const wrapper = mountTable({
      gamePhase: "charleston",
      tiles: rackTilesCharleston,
      localPlayer,
      charleston: {
        ...charlestonPassing,
        status: "vote-ready",
        currentDirection: null,
      },
    });
    expect(wrapper.find("[data-testid='charleston-vote']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='mahjong-button']").exists()).toBe(false);
  });

  it("emits charlestonPass after selecting three tiles and clicking Pass", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(GameTable, {
      props: {
        opponents: mockPlayers,
        tiles: rackTilesCharleston,
        localPlayer,
        gamePhase: "charleston",
        charleston: charlestonPassing,
      },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });

    const tileButtons = wrapper.findAll('[data-rack-tile-id] [role="button"]');
    expect(tileButtons.length).toBe(3);
    await tileButtons[0].trigger("click");
    await tileButtons[1].trigger("click");
    await tileButtons[2].trigger("click");

    await wrapper.get("[data-testid='charleston-pass-btn']").trigger("click");
    const ev = wrapper.emitted("charlestonPass");
    expect(ev).toBeTruthy();
    expect(ev?.[0]?.[0]).toEqual(["dot-7-1", "bam-3-2", "crak-2-1"]);
  });

  it("places Charleston vote controls inside ActionZone toolbar for roving tabindex", () => {
    const wrapper = mountTable({
      gamePhase: "charleston",
      tiles: rackTilesCharleston,
      localPlayer,
      charleston: {
        ...charlestonPassing,
        status: "vote-ready",
        currentDirection: null,
      },
    });
    const toolbar = wrapper.get("[data-toolbar-controls]");
    expect(toolbar.find("[data-testid='charleston-vote']").exists()).toBe(true);
  });

  it("applies pass-out then receive-in rack classes on CHARLESTON_PHASE_COMPLETE", async () => {
    vi.useFakeTimers();
    try {
      const pinia = createPinia();
      setActivePinia(pinia);
      const resolved: ResolvedAction = {
        type: "CHARLESTON_PHASE_COMPLETE",
        direction: "right",
        nextDirection: "left",
        stage: "first",
        status: "passing",
      };
      const wrapper = mount(GameTable, {
        props: {
          opponents: mockPlayers,
          tiles: rackTilesCharleston,
          localPlayer,
          gamePhase: "charleston",
          charleston: charlestonPassing,
          resolvedAction: null,
        },
        global: {
          plugins: [pinia],
          stubs: { TileSprite: { template: "<svg />" } },
        },
      });
      const rack = () => wrapper.get("[data-testid='rack-area']");

      await wrapper.setProps({ resolvedAction: resolved });
      await flushPromises();
      expect(rack().classes()).toContain("game-table__rack-pass--right");

      vi.advanceTimersByTime(400);
      await flushPromises();
      expect(rack().classes()).toContain("game-table__rack-receive--from-left");

      vi.advanceTimersByTime(400);
      await flushPromises();
      expect(rack().classes()).not.toContain("game-table__rack-receive--from-left");
      expect(rack().classes()).not.toContain("game-table__rack-pass--right");

      wrapper.unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("GameTable — host migration toast (4B.6)", () => {
  it("shows host-promoted toast on scoreboard when resolvedAction is HOST_PROMOTED", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(GameTable, {
      attachTo: document.body,
      props: {
        opponents: mockPlayers,
        localPlayer,
        tiles: [],
        gamePhase: "scoreboard",
        gameResult: mockGameResult,
        resolvedAction: null,
      },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });
    const resolved: ResolvedAction = {
      type: "HOST_PROMOTED",
      previousHostId: "player-0",
      newHostId: "player-1",
      newHostName: "Pat",
    };
    await wrapper.setProps({ resolvedAction: resolved });
    await flushPromises();
    expect(document.querySelector('[data-testid="host-promoted-toast"]')).not.toBeNull();
    wrapper.unmount();
  });

  it("suppresses host-promoted toast during play", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(GameTable, {
      attachTo: document.body,
      props: {
        opponents: mockPlayers,
        localPlayer,
        tiles: [],
        gamePhase: "play",
        resolvedAction: null,
      },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });
    const resolved: ResolvedAction = {
      type: "HOST_PROMOTED",
      previousHostId: "player-0",
      newHostId: "player-1",
      newHostName: "Pat",
    };
    await wrapper.setProps({ resolvedAction: resolved });
    await flushPromises();
    expect(wrapper.find('[data-testid="host-promoted-toast"]').exists()).toBe(false);
    wrapper.unmount();
  });
});

describe("GameTable — room settings + rematch toasts (4B.7)", () => {
  it("shows room-settings toast for non-host when another player changed settings", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(GameTable, {
      attachTo: document.body,
      props: {
        opponents: mockPlayers,
        localPlayer,
        tiles: [],
        gamePhase: "play",
        resolvedAction: null,
      },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });
    const resolved: ResolvedAction = {
      type: "ROOM_SETTINGS_CHANGED",
      changedBy: "player-north",
      changedByName: "Alice",
      previous: DEFAULT_ROOM_SETTINGS,
      next: { ...DEFAULT_ROOM_SETTINGS, timerMode: "none" },
      changedKeys: ["timerMode"],
    };
    await wrapper.setProps({ resolvedAction: resolved });
    await flushPromises();
    expect(document.querySelector('[data-testid="room-settings-changed-toast"]')).not.toBeNull();
    wrapper.unmount();
  });

  it("suppresses room-settings toast when local player made the change", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(GameTable, {
      attachTo: document.body,
      props: {
        opponents: mockPlayers,
        localPlayer,
        tiles: [],
        gamePhase: "play",
        resolvedAction: null,
      },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });
    const resolved: ResolvedAction = {
      type: "ROOM_SETTINGS_CHANGED",
      changedBy: localPlayer.id,
      changedByName: "You",
      previous: DEFAULT_ROOM_SETTINGS,
      next: { ...DEFAULT_ROOM_SETTINGS, jokerRulesMode: "simplified" },
      changedKeys: ["jokerRulesMode"],
    };
    await wrapper.setProps({ resolvedAction: resolved });
    await flushPromises();
    expect(wrapper.find('[data-testid="room-settings-changed-toast"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("shows rematch-waiting toast for REMATCH_WAITING_FOR_PLAYERS", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mount(GameTable, {
      attachTo: document.body,
      props: {
        opponents: mockPlayers,
        localPlayer,
        tiles: [],
        gamePhase: "scoreboard",
        gameResult: mockGameResult,
        resolvedAction: null,
      },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });
    const resolved: ResolvedAction = {
      type: "REMATCH_WAITING_FOR_PLAYERS",
      missingSeats: 1,
    };
    await wrapper.setProps({ resolvedAction: resolved });
    await flushPromises();
    expect(document.querySelector('[data-testid="rematch-waiting-toast"]')).not.toBeNull();
    wrapper.unmount();
  });
});

describe("GameTable — NMJL hand guidance pool size (5B.2)", () => {
  const guidanceStorageKey = "mahjong-hand-guidance-prefs-v1";

  beforeEach(() => {
    localStorage.removeItem(guidanceStorageKey);
  });

  it("disables NMJL guidance when combined rack + exposed pool has more than 14 tiles", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mountTable(
      {
        localPlayer,
        gamePhase: "play",
        roomSettings: DEFAULT_ROOM_SETTINGS,
        tiles: makeNTilesForGuidanceTest(15),
        myExposedGroups: [],
      },
      pinia,
    );
    const panels = wrapper.findComponent(SlideInReferencePanels);
    expect(panels.props("nmjlGuidanceActive")).toBe(false);
    expect(panels.props("nmjlGuidanceByHandId")).toBeNull();
  });

  it("enables NMJL guidance when pool is exactly 14 tiles and room allows hints", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mountTable(
      {
        localPlayer,
        gamePhase: "play",
        roomSettings: DEFAULT_ROOM_SETTINGS,
        tiles: makeNTilesForGuidanceTest(14),
        myExposedGroups: [],
      },
      pinia,
    );
    const panels = wrapper.findComponent(SlideInReferencePanels);
    expect(panels.props("nmjlGuidanceActive")).toBe(true);
    expect(panels.props("nmjlGuidanceByHandId")).not.toBeNull();
  });

  it("passes room settings to SlideInReferencePanels (5B.6)", () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const wrapper = mountTable(
      {
        localPlayer,
        gamePhase: "play",
        roomSettings: DEFAULT_ROOM_SETTINGS,
        tiles: makeNTilesForGuidanceTest(14),
        myExposedGroups: [],
      },
      pinia,
    );
    const panels = wrapper.findComponent(SlideInReferencePanels);
    expect(panels.props("roomSettings")).toEqual(DEFAULT_ROOM_SETTINGS);
  });
});

describe("GameTable — dealing animation (5B.6)", () => {
  it("renders dealing overlay when animated style, play phase, empty discards", () => {
    const wrapper = mount(GameTable, {
      props: {
        opponents: mockPlayers,
        localPlayer,
        gamePhase: "play",
        roomSettings: { ...DEFAULT_ROOM_SETTINGS, dealingStyle: "animated" },
        discardPools: {},
        tiles: makeNTilesForGuidanceTest(14),
      },
      global: {
        plugins: [createPinia()],
        stubs: {
          TileSprite: { template: "<svg />" },
        },
      },
    });
    expect(wrapper.find('[data-testid="dealing-animation-overlay"]').exists()).toBe(true);
  });

  it("does not render dealing overlay when discards exist", () => {
    const t = makeNTilesForGuidanceTest(1)[0];
    const wrapper = mount(GameTable, {
      props: {
        opponents: mockPlayers,
        localPlayer,
        gamePhase: "play",
        roomSettings: { ...DEFAULT_ROOM_SETTINGS, dealingStyle: "animated" },
        discardPools: { bottom: [t] },
        tiles: makeNTilesForGuidanceTest(14),
      },
      global: {
        plugins: [createPinia()],
        stubs: {
          TileSprite: { template: "<svg />" },
        },
      },
    });
    expect(wrapper.find('[data-testid="dealing-animation-overlay"]').exists()).toBe(false);
  });
});

describe("GameTable — activity ticker (5B.7)", () => {
  it("pushes ticker text when resolvedAction updates during play", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useActivityTickerStore();
    const wrapper = mount(GameTable, {
      props: {
        opponents: mockPlayers,
        localPlayer,
        tiles: [],
        gamePhase: "play",
        resolvedAction: null,
      },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });
    const resolved: ResolvedAction = {
      type: "DISCARD_TILE",
      playerId: localPlayer.id,
      tileId: "dot-8-1",
    };
    await wrapper.setProps({ resolvedAction: resolved });
    await flushPromises();
    expect(store.items.some((i) => i.text.includes("discarded") && i.text.includes("8-Dot"))).toBe(
      true,
    );
  });

  it("does not push ticker when not in play phase", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useActivityTickerStore();
    const wrapper = mount(GameTable, {
      props: {
        opponents: mockPlayers,
        localPlayer,
        tiles: [],
        gamePhase: "scoreboard",
        gameResult: mockGameResult,
        resolvedAction: null,
      },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });
    const resolved: ResolvedAction = {
      type: "DISCARD_TILE",
      playerId: "player-north",
      tileId: "dot-8-1",
    };
    await wrapper.setProps({ resolvedAction: resolved });
    await flushPromises();
    expect(store.items).toHaveLength(0);
  });

  it("clears ticker when entering play from another phase", async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useActivityTickerStore();
    store.pushEvent("stale from prior context");
    const wrapper = mount(GameTable, {
      props: {
        opponents: mockPlayers,
        localPlayer,
        tiles: [],
        gamePhase: "scoreboard",
        gameResult: mockGameResult,
        resolvedAction: null,
      },
      global: {
        plugins: [pinia],
        stubs: { TileSprite: { template: "<svg />" } },
      },
    });
    expect(store.items.length).toBeGreaterThan(0);
    await wrapper.setProps({ gamePhase: "play" });
    await flushPromises();
    expect(store.items).toHaveLength(0);
  });
});

describe("GameTable — Celebration overlay (7.2)", () => {
  const CelebrationStub = {
    name: "Celebration",
    props: ["gameResult", "playerNamesById", "winnerId", "winnerSeat"],
    emits: ["done"],
    template: '<div data-testid="celebration-stub" />',
  };
  const ScoreboardStub = {
    name: "Scoreboard",
    props: [
      "gameResult",
      "playerNamesById",
      "playerOrder",
      "sessionScores",
      "sessionGameHistory",
      "viewerIsHost",
      "hasShownHand",
    ],
    emits: ["play-again", "end-session", "show-hand"],
    template: '<div data-testid="scoreboard" />',
  };

  it("5.4: Scoreboard is not rendered while Celebration is active", () => {
    const wrapper = mount(GameTable, {
      props: {
        opponents: mockPlayers,
        localPlayer,
        gamePhase: "scoreboard",
        gameResult: mockGameResult,
      },
      global: {
        plugins: [createPinia()],
        stubs: {
          TileSprite: { template: "<svg />" },
          Celebration: CelebrationStub,
          Scoreboard: ScoreboardStub,
        },
      },
    });

    expect(wrapper.find('[data-testid="celebration-stub"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="scoreboard"]').exists()).toBe(false);
  });

  it("5.5: Scoreboard renders after Celebration emits done", async () => {
    const wrapper = mount(GameTable, {
      props: {
        opponents: mockPlayers,
        localPlayer,
        gamePhase: "scoreboard",
        gameResult: mockGameResult,
      },
      global: {
        plugins: [createPinia()],
        stubs: {
          TileSprite: { template: "<svg />" },
          Celebration: CelebrationStub,
          Scoreboard: ScoreboardStub,
        },
      },
    });

    expect(wrapper.find('[data-testid="celebration-stub"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="scoreboard"]').exists()).toBe(false);

    // Emit done from the Celebration stub via vm.$emit (Vue emit, not DOM event)
    await wrapper.findComponent(CelebrationStub).vm.$emit("done");
    await flushPromises();

    expect(wrapper.find('[data-testid="scoreboard"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="celebration-stub"]').exists()).toBe(false);
  });

  it("shows Scoreboard immediately for wall game (no winner)", async () => {
    const wallGameResult: WallGameResult = { winnerId: null, points: 0 };
    const wrapper = mount(GameTable, {
      props: {
        opponents: mockPlayers,
        localPlayer,
        gamePhase: "scoreboard",
        gameResult: wallGameResult as GameResult,
      },
      global: {
        plugins: [createPinia()],
        stubs: {
          TileSprite: { template: "<svg />" },
          Celebration: CelebrationStub,
          Scoreboard: ScoreboardStub,
        },
      },
    });

    // No winner — Celebration must NOT appear
    expect(wrapper.find('[data-testid="celebration-stub"]').exists()).toBe(false);
    // Scoreboard must appear immediately without any done event
    expect(wrapper.find('[data-testid="scoreboard"]').exists()).toBe(true);
  });
});
