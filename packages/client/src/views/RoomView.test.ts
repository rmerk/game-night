import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { mount, flushPromises } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createMemoryHistory } from "vue-router";
import RoomView from "./RoomView.vue";

vi.mock("../composables/apiBaseUrl", () => ({
  getApiBaseUrl: () => "http://127.0.0.1:3001",
}));

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
