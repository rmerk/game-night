import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { mount, flushPromises } from "@vue/test-utils";
import { setActivePinia, createPinia } from "pinia";
import FirstVisitEntrance from "./FirstVisitEntrance.vue";

// ─── Mock preferences store ────────────────────────────────────────────────────

const mockMarkEntranceSeen = vi.fn();

const mockPrefsStore = {
  hasSeenEntrance: false,
  markEntranceSeen: mockMarkEntranceSeen,
};

vi.mock("../../stores/preferences", () => ({
  usePreferencesStore: () => mockPrefsStore,
}));

// ─── Teleport stub ─────────────────────────────────────────────────────────────

const teleportStub = { template: "<div><slot /></div>" };

// ─── matchMedia helper ─────────────────────────────────────────────────────────

function stubMatchMedia(prefersReducedMotion: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? prefersReducedMotion : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("FirstVisitEntrance (Task 4 — AC 4, 5, 6)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockPrefsStore.hasSeenEntrance = false;
    stubMatchMedia(false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows overlay on first visit (hasSeenEntrance=false, no reduced-motion)", async () => {
    mockPrefsStore.hasSeenEntrance = false;

    const wrapper = mount(FirstVisitEntrance, {
      global: { stubs: { Teleport: teleportStub } },
    });
    await flushPromises();

    // Overlay div should be visible
    expect(wrapper.find("div[class*='fixed']").exists()).toBe(true);
  });

  it("does NOT show overlay when hasSeenEntrance=true", async () => {
    mockPrefsStore.hasSeenEntrance = true;

    const wrapper = mount(FirstVisitEntrance, {
      global: { stubs: { Teleport: teleportStub } },
    });
    await flushPromises();

    expect(wrapper.find("div[class*='fixed']").exists()).toBe(false);
  });

  it("does NOT show overlay under prefers-reduced-motion", async () => {
    mockPrefsStore.hasSeenEntrance = false;
    stubMatchMedia(true);

    const wrapper = mount(FirstVisitEntrance, {
      global: { stubs: { Teleport: teleportStub } },
    });
    await flushPromises();

    expect(wrapper.find("div[class*='fixed']").exists()).toBe(false);
  });

  it("calls markEntranceSeen() after the 2100ms timeout on first visit", async () => {
    mockPrefsStore.hasSeenEntrance = false;

    mount(FirstVisitEntrance, {
      global: { stubs: { Teleport: teleportStub } },
    });
    await flushPromises();

    expect(mockMarkEntranceSeen).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(2200);

    expect(mockMarkEntranceSeen).toHaveBeenCalledTimes(1);
  });

  it("calls markEntranceSeen() under reduced-motion (to prevent retry)", async () => {
    mockPrefsStore.hasSeenEntrance = false;
    stubMatchMedia(true);

    mount(FirstVisitEntrance, {
      global: { stubs: { Teleport: teleportStub } },
    });
    await flushPromises();

    expect(mockMarkEntranceSeen).toHaveBeenCalledTimes(1);
  });

  it("does NOT call markEntranceSeen() when already seen (to avoid unnecessary persist)", async () => {
    mockPrefsStore.hasSeenEntrance = true;

    mount(FirstVisitEntrance, {
      global: { stubs: { Teleport: teleportStub } },
    });
    await flushPromises();

    // Already seen — no need to call markEntranceSeen again
    expect(mockMarkEntranceSeen).not.toHaveBeenCalled();
  });

  it("unmounting before timeout does NOT call markEntranceSeen (timer cleared)", async () => {
    mockPrefsStore.hasSeenEntrance = false;

    const wrapper = mount(FirstVisitEntrance, {
      global: { stubs: { Teleport: teleportStub } },
    });
    await flushPromises();

    // Advance to 1000ms — before the 2100ms timeout fires
    await vi.advanceTimersByTimeAsync(1000);
    expect(mockMarkEntranceSeen).not.toHaveBeenCalled();

    wrapper.unmount();

    // Advance past the timeout — timer should have been cleared
    await vi.advanceTimersByTimeAsync(1200);
    expect(mockMarkEntranceSeen).not.toHaveBeenCalled();
  });

  it("hides overlay after timeout completes", async () => {
    mockPrefsStore.hasSeenEntrance = false;

    const wrapper = mount(FirstVisitEntrance, {
      global: { stubs: { Teleport: teleportStub } },
    });
    await flushPromises();

    expect(wrapper.find("div[class*='fixed']").exists()).toBe(true);

    await vi.advanceTimersByTimeAsync(2200);
    await flushPromises();

    expect(wrapper.find("div[class*='fixed']").exists()).toBe(false);
  });
});
