import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import { ref } from "vue";
import RoomView from "./RoomView.vue";
import { useRoomConnection } from "../composables/useRoomConnection";
import { useAvReconnectUi } from "../composables/useAvReconnectUi";

const { mockAnimate } = vi.hoisted(() => {
  const mockAnimate = vi.fn(() => ({ finished: Promise.resolve() }));
  return { mockAnimate };
});

vi.mock("motion-v", () => ({
  animate: mockAnimate,
}));

vi.mock("../composables/apiBaseUrl", () => ({
  getApiBaseUrl: () => "http://127.0.0.1:3001",
}));

vi.mock("../composables/useRoomConnection", async (importOriginal) => {
  const real = await importOriginal<typeof import("../composables/useRoomConnection")>();
  return { useRoomConnection: vi.fn(real.useRoomConnection) };
});

vi.mock("../composables/useAvReconnectUi", async (importOriginal) => {
  const real = await importOriginal<typeof import("../composables/useAvReconnectUi")>();
  return { useAvReconnectUi: vi.fn(real.useAvReconnectUi) };
});

const stubs = {
  GameTable: true,
  RoomSettingsPanel: true,
  SlideInReferencePanels: true,
  ReactionBar: true,
  ReactionBubbleStack: true,
  BaseToast: true,
};

describe("RoomView (4B.7)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Clear any mockReturnValue overrides from mood tests while keeping the vi.fn() wrapper intact
    vi.mocked(useRoomConnection).mockReset();
    vi.mocked(useAvReconnectUi).mockReset();
  });

  it("shows table-full when status returns full: true and does not open WebSocket", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ full: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const pinia = createPinia();
    setActivePinia(pinia);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", name: "home", component: { template: "<div />" } },
        { path: "/room/:code", name: "room", component: RoomView },
        {
          path: "/room/:code/spectate",
          name: "room-spectate",
          component: { template: '<div data-testid="spectator-placeholder" />' },
        },
      ],
    });
    await router.push("/room/TEST01");
    await router.isReady();

    const wrapper = mount(
      { template: "<router-view />" },
      {
        global: {
          plugins: [pinia, router],
          stubs,
        },
      },
    );

    await wrapper.get("input").setValue("Visitor");
    await wrapper.get("button.bg-state-turn-active").trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-testid="table-full-view"]').exists()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:3001/api/rooms/TEST01/status");

    vi.unstubAllGlobals();
  });

  it("T15: shows room-not-found when status returns 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    vi.stubGlobal("fetch", fetchMock);

    const pinia = createPinia();
    setActivePinia(pinia);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", name: "home", component: { template: "<div />" } },
        { path: "/room/:code", name: "room", component: RoomView },
        {
          path: "/room/:code/spectate",
          name: "room-spectate",
          component: { template: "<div />" },
        },
      ],
    });
    await router.push("/room/TEST02");
    await router.isReady();

    const wrapper = mount(
      { template: "<router-view />" },
      {
        global: {
          plugins: [pinia, router],
          stubs,
        },
      },
    );

    await wrapper.get("input").setValue("Visitor");
    await wrapper.get("button.bg-state-turn-active").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Room not found");
    expect(wrapper.find('[data-testid="table-full-view"]').exists()).toBe(false);

    vi.unstubAllGlobals();
  });

  it("T16: shows network error with Retry when fetch throws", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("network failure"));
    vi.stubGlobal("fetch", fetchMock);

    const pinia = createPinia();
    setActivePinia(pinia);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", name: "home", component: { template: "<div />" } },
        { path: "/room/:code", name: "room", component: RoomView },
        {
          path: "/room/:code/spectate",
          name: "room-spectate",
          component: { template: "<div />" },
        },
      ],
    });
    await router.push("/room/TEST03");
    await router.isReady();

    const wrapper = mount(
      { template: "<router-view />" },
      {
        global: {
          plugins: [pinia, router],
          stubs,
        },
      },
    );

    await wrapper.get("input").setValue("Visitor");
    await wrapper.get("button.bg-state-turn-active").trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Could not reach the server");
    const retryBtn = wrapper.findAll("button").find((b) => b.text().includes("Retry"));
    expect(retryBtn).toBeDefined();

    vi.unstubAllGlobals();
  });

  it("T13: ROOM_FULL error from server pivots to table-full view", async () => {
    // Status check returns not full, but then server sends ROOM_FULL error
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ full: false }),
    });
    vi.stubGlobal("fetch", fetchMock);

    // Mock WebSocket as a class constructor — simulate ROOM_FULL error after open
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    class MockWebSocket {
      static readonly OPEN = 1;
      static readonly CLOSED = 3;
      readyState = 0;
      private _listeners: Record<string, Array<(ev: unknown) => void>> = {};
      addEventListener(event: string, handler: (ev: unknown) => void) {
        (this._listeners[event] ??= []).push(handler);
      }
      send = vi.fn();
      close = vi.fn().mockImplementation(() => {
        this.readyState = 3;
        for (const h of this._listeners["close"] ?? []) h({});
      });
      constructor() {
        queueMicrotask(() => {
          this.readyState = 1;
          for (const h of this._listeners["open"] ?? []) h({});
          queueMicrotask(() => {
            const errorMsg = JSON.stringify({
              version: 1,
              type: "ERROR",
              code: "ROOM_FULL",
              message: "Room is full",
            });
            for (const h of this._listeners["message"] ?? []) h({ data: errorMsg });
          });
        });
      }
    }
    vi.stubGlobal("WebSocket", MockWebSocket);

    const pinia = createPinia();
    setActivePinia(pinia);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", name: "home", component: { template: "<div />" } },
        { path: "/room/:code", name: "room", component: RoomView },
        {
          path: "/room/:code/spectate",
          name: "room-spectate",
          component: { template: "<div />" },
        },
      ],
    });
    await router.push("/room/RACE01");
    await router.isReady();

    const wrapper = mount(
      { template: "<router-view />" },
      {
        global: {
          plugins: [pinia, router],
          stubs,
        },
      },
    );

    await wrapper.get("input").setValue("Visitor");
    await wrapper.get("button.bg-state-turn-active").trigger("click");
    await flushPromises();
    // Allow WebSocket microtasks to fire
    await flushPromises();
    await flushPromises();

    expect(wrapper.find('[data-testid="table-full-view"]').exists()).toBe(true);

    vi.unstubAllGlobals();
  });

  it("navigates to spectator placeholder when Watch as spectator is clicked", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ full: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const pinia = createPinia();
    setActivePinia(pinia);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", name: "home", component: { template: "<div />" } },
        { path: "/room/:code", name: "room", component: RoomView },
        {
          path: "/room/:code/spectate",
          name: "room-spectate",
          component: { template: '<div data-testid="spectator-placeholder" />' },
        },
      ],
    });
    await router.push("/room/ABCD12");
    await router.isReady();

    const wrapper = mount(
      { template: "<router-view />" },
      {
        global: {
          plugins: [pinia, router],
          stubs,
        },
      },
    );

    await wrapper.get("input").setValue("Visitor");
    await wrapper.get("button.bg-state-turn-active").trigger("click");
    await flushPromises();

    const pushSpy = vi.spyOn(router, "push");
    await wrapper.get('[data-testid="table-full-spectate"]').trigger("click");
    expect(pushSpy).toHaveBeenCalledWith({ name: "room-spectate", params: { code: "ABCD12" } });

    vi.unstubAllGlobals();
  });
});

function makeRoomConnection(overrides: Partial<ReturnType<typeof useRoomConnection>> = {}) {
  return {
    status: ref("open" as const),
    lobbyState: ref(null),
    playerGameView: ref(null),
    resolvedAction: ref(null),
    systemNotice: ref(null),
    clearLastError: vi.fn(),
    roomFullError: ref(false),
    clearRoomFullError: vi.fn(),
    retryLiveKitConnection: vi.fn(),
    lastErrorMessage: ref(null),
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendGameAction: vi.fn(),
    clearTokenForRoom: vi.fn(),
    sendChat: vi.fn(),
    sendReaction: vi.fn(),
    sendStartGame: vi.fn(),
    sendSetRoomSettings: vi.fn(),
    sendRematch: vi.fn(),
    sendEndSession: vi.fn(),
    sendLeaveRoom: vi.fn(),
    sendAfkVote: vi.fn(),
    sendDepartureVote: vi.fn(),
    sendShowHand: vi.fn(),
    ...overrides,
  };
}

describe("RoomView mood classes (Task 2.5)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(useAvReconnectUi).mockReturnValue({
      showReconnecting: ref(false),
      showReconnectButton: ref(false),
      manualPhase: ref("idle"),
      onReconnectAv: vi.fn(),
    } as unknown as ReturnType<typeof useAvReconnectUi>);
  });

  async function mountRoomView(conn: ReturnType<typeof makeRoomConnection>) {
    vi.mocked(useRoomConnection).mockReturnValue(conn as ReturnType<typeof useRoomConnection>);
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", name: "home", component: { template: "<div />" } },
        { path: "/room/:code", name: "room", component: RoomView },
        { path: "/room/:code/spectate", name: "room-spectate", component: { template: "<div />" } },
      ],
    });
    await router.push("/room/MOODTEST");
    await router.isReady();
    const wrapper = mount(
      { template: "<router-view />" },
      {
        global: {
          plugins: [pinia, router],
          stubs: {
            GameTable: true,
            RoomSettingsPanel: true,
            SlideInReferencePanels: true,
            ReactionBar: true,
            ReactionBubbleStack: true,
            BaseToast: true,
          },
        },
      },
    );
    await flushPromises();
    return wrapper;
  }

  it("applies mood-arriving class when in lobby state", async () => {
    const conn = makeRoomConnection({
      lobbyState: ref({ myPlayerId: "p1", players: [], settings: {} as never }) as never,
      playerGameView: ref(null),
    });
    const wrapper = await mountRoomView(conn);
    const rootDiv = wrapper.find('[data-testid="room-view-root"]');
    expect(rootDiv.exists()).toBe(true);
    expect(rootDiv.classes()).toContain("mood-arriving");
  });

  it("applies mood-playing class when game phase is play", async () => {
    const conn = makeRoomConnection({
      lobbyState: ref(null),
      playerGameView: ref({
        myPlayerId: "p1",
        gamePhase: "play",
        players: [],
        myRack: [],
        settings: {} as never,
      } as never),
    });
    const wrapper = await mountRoomView(conn);
    const rootDiv = wrapper.find('[data-testid="room-view-root"]');
    expect(rootDiv.exists()).toBe(true);
    expect(rootDiv.classes()).toContain("mood-playing");
  });

  it("applies mood-lingering class when game phase is scoreboard", async () => {
    const conn = makeRoomConnection({
      lobbyState: ref(null),
      playerGameView: ref({
        myPlayerId: "p1",
        gamePhase: "scoreboard",
        players: [],
        myRack: [],
        settings: {} as never,
      } as never),
    });
    const wrapper = await mountRoomView(conn);
    const rootDiv = wrapper.find('[data-testid="room-view-root"]');
    expect(rootDiv.exists()).toBe(true);
    expect(rootDiv.classes()).toContain("mood-lingering");
  });

  it("applies mood-lingering class during rematch phase", async () => {
    const conn = makeRoomConnection({
      lobbyState: ref(null),
      playerGameView: ref({
        myPlayerId: "p1",
        gamePhase: "rematch",
        players: [],
        myRack: [],
        settings: {} as never,
      } as never),
    });
    const wrapper = await mountRoomView(conn);
    const rootDiv = wrapper.find('[data-testid="room-view-root"]');
    expect(rootDiv.exists()).toBe(true);
    expect(rootDiv.classes()).toContain("mood-lingering");
  });
});

describe("RoomView crossfade transitions (Task 4)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockAnimate.mockClear();
    vi.mocked(useAvReconnectUi).mockReturnValue({
      showReconnecting: ref(false),
      showReconnectButton: ref(false),
      manualPhase: ref("idle"),
      onReconnectAv: vi.fn(),
    } as unknown as ReturnType<typeof useAvReconnectUi>);
  });

  async function mountRoomViewForCrossfade(conn: ReturnType<typeof makeRoomConnection>) {
    vi.mocked(useRoomConnection).mockReturnValue(conn as ReturnType<typeof useRoomConnection>);
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", name: "home", component: { template: "<div />" } },
        { path: "/room/:code", name: "room", component: RoomView },
        { path: "/room/:code/spectate", name: "room-spectate", component: { template: "<div />" } },
      ],
    });
    await router.push("/room/XFADETEST");
    await router.isReady();
    const wrapper = mount(
      { template: "<router-view />" },
      {
        global: {
          plugins: [pinia, router],
          stubs: {
            GameTable: true,
            RoomSettingsPanel: true,
            SlideInReferencePanels: true,
            ReactionBar: true,
            ReactionBubbleStack: true,
            BaseToast: true,
          },
        },
      },
    );
    await flushPromises();
    return wrapper;
  }

  it("4.4: calls motion-v animate() when mood changes (not setTimeout)", async () => {
    const playerGameView = ref<null | {
      myPlayerId: string;
      gamePhase: string;
      players: never[];
      myRack: never[];
      settings: never;
    }>(null);
    const lobbyState = ref<null | { myPlayerId: string; players: never[]; settings: never }>({
      myPlayerId: "p1",
      players: [],
      settings: {} as never,
    });

    const conn = makeRoomConnection({
      lobbyState: lobbyState as never,
      playerGameView: playerGameView as never,
    });
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    await mountRoomViewForCrossfade(conn);
    mockAnimate.mockClear();
    setTimeoutSpy.mockClear();

    // Transition from lobby → play (mood-arriving → mood-playing)
    lobbyState.value = null;
    playerGameView.value = {
      myPlayerId: "p1",
      gamePhase: "play",
      players: [],
      myRack: [],
      settings: {} as never,
    };
    await flushPromises();

    expect(mockAnimate).toHaveBeenCalled();
    // animate should have been called for fade-out and fade-in with opacity keyframes
    const calls = mockAnimate.mock.calls as unknown as Array<
      [unknown, Record<string, unknown>, unknown?]
    >;
    const opacityCalls = calls.filter((call) => call[1] && typeof call[1].opacity !== "undefined");
    expect(opacityCalls.length).toBeGreaterThanOrEqual(1);

    setTimeoutSpy.mockRestore();
  });

  it("4.5: mood class changes immediately when prefers-reduced-motion is active", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const playerGameView = ref<null | {
      myPlayerId: string;
      gamePhase: string;
      players: never[];
      myRack: never[];
      settings: never;
    }>(null);
    const lobbyState = ref<null | { myPlayerId: string; players: never[]; settings: never }>({
      myPlayerId: "p1",
      players: [],
      settings: {} as never,
    });

    const conn = makeRoomConnection({
      lobbyState: lobbyState as never,
      playerGameView: playerGameView as never,
    });
    const wrapper = await mountRoomViewForCrossfade(conn);

    // Verify initial state
    expect(wrapper.find('[data-testid="room-view-root"]').classes()).toContain("mood-arriving");

    // Transition to play mood
    lobbyState.value = null;
    playerGameView.value = {
      myPlayerId: "p1",
      gamePhase: "play",
      players: [],
      myRack: [],
      settings: {} as never,
    };

    // With motion-v handling reduced-motion natively (resolves synchronously),
    // the class should update after flushing microtasks
    await flushPromises();

    expect(wrapper.find('[data-testid="room-view-root"]').classes()).toContain("mood-playing");

    vi.unstubAllGlobals();
  });
});
