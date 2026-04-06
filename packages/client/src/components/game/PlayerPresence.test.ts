import { describe, it, expect, beforeEach, vi, afterEach } from "vite-plus/test";
import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import PlayerPresence from "./PlayerPresence.vue";

const isMobileMq = ref(false);

vi.mock("@vueuse/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  return {
    ...actual,
    useMediaQuery: () => isMobileMq,
  };
});

function createMockVideoTrack() {
  const videoEl = document.createElement("video");
  const detach = vi.fn();
  const attach = vi.fn(() => videoEl);
  return { attach, detach, kind: "video" };
}

describe("PlayerPresence", () => {
  beforeEach(() => {
    isMobileMq.value = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const baseProps = {
    playerId: "p1",
    displayName: "Alice",
    initial: "A",
    position: "top" as const,
    videoTrack: null,
    isCameraEnabled: false,
  };

  it("renders avatar when no camera", () => {
    const wrapper = mount(PlayerPresence, { props: baseProps });
    expect(wrapper.find('[data-testid="avatar-fallback"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="video-thumbnail"]').exists()).toBe(false);
  });

  it("renders video when track and camera enabled", () => {
    const track = createMockVideoTrack();
    const wrapper = mount(PlayerPresence, {
      props: {
        ...baseProps,
        videoTrack: track,
        isCameraEnabled: true,
      },
    });
    expect(wrapper.find('[data-testid="video-thumbnail"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="avatar-fallback"]').exists()).toBe(false);
  });

  it("renders avatar when camera muted but track still present (AC5)", () => {
    const track = createMockVideoTrack();
    const wrapper = mount(PlayerPresence, {
      props: {
        ...baseProps,
        videoTrack: track,
        isCameraEnabled: false,
      },
    });
    expect(wrapper.find('[data-testid="avatar-fallback"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="video-thumbnail"]').exists()).toBe(false);
  });

  it("keeps container size class when toggling video to avatar", async () => {
    const track = createMockVideoTrack();
    const wrapper = mount(PlayerPresence, {
      props: {
        ...baseProps,
        videoTrack: track,
        isCameraEnabled: true,
      },
    });
    const btn = wrapper.find("button");
    const w1 = btn.element.getBoundingClientRect().width;
    await wrapper.setProps({ videoTrack: null, isCameraEnabled: false });
    await flushPromises();
    const w2 = btn.element.getBoundingClientRect().width;
    expect(w1).toBe(w2);
  });

  it("mobile tap expands and backdrop dismisses", async () => {
    isMobileMq.value = true;
    const track = createMockVideoTrack();
    const wrapper = mount(PlayerPresence, {
      props: {
        ...baseProps,
        videoTrack: track,
        isCameraEnabled: true,
      },
    });
    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="presence-expand-backdrop"]').exists()).toBe(true);
    await wrapper.find('[data-testid="presence-expand-backdrop"]').trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="presence-expand-backdrop"]').exists()).toBe(false);
  });

  it("auto-collapses after timeout on mobile", async () => {
    isMobileMq.value = true;
    const track = createMockVideoTrack();
    const wrapper = mount(PlayerPresence, {
      props: {
        ...baseProps,
        videoTrack: track,
        isCameraEnabled: true,
      },
    });
    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="presence-expand-backdrop"]').exists()).toBe(true);
    vi.advanceTimersByTime(4000);
    await flushPromises();
    expect(wrapper.find('[data-testid="presence-expand-backdrop"]').exists()).toBe(false);
  });
});
