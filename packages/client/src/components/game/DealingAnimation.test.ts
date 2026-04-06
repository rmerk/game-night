import { describe, expect, it, vi, beforeEach, afterEach } from "vite-plus/test";
import { mount, flushPromises } from "@vue/test-utils";

const { mockReducedMotion } = vi.hoisted(() => {
  const { ref } = require("vue") as typeof import("vue");
  return { mockReducedMotion: ref(false) };
});

vi.mock("@vueuse/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  return {
    ...actual,
    usePreferredReducedMotion: () => mockReducedMotion,
  };
});

import DealingAnimation from "./DealingAnimation.vue";

describe("DealingAnimation", () => {
  beforeEach(() => {
    mockReducedMotion.value = false;
    vi.useFakeTimers();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders overlay", () => {
    const wrapper = mount(DealingAnimation);
    expect(wrapper.find('[data-testid="dealing-animation-overlay"]').exists()).toBe(true);
  });

  it("emits done immediately when prefers reduced motion", async () => {
    mockReducedMotion.value = true;
    const wrapper = mount(DealingAnimation);
    await flushPromises();
    expect(wrapper.emitted("done")).toHaveLength(1);
  });

  it("emits done after sequence when motion is allowed", async () => {
    const wrapper = mount(DealingAnimation);
    await flushPromises();
    expect(wrapper.emitted("done")).toBeUndefined();
    vi.advanceTimersByTime(4500);
    await flushPromises();
    expect(wrapper.emitted("done")).toHaveLength(1);
  });
});
