import { describe, it, expect, beforeEach, vi, afterEach } from "vite-plus/test";
import { mount, flushPromises } from "@vue/test-utils";
import { ref } from "vue";
import PlayerPresence from "./PlayerPresence.vue";

const isMobileMq = ref(false);
const prefersReducedMotionMq = ref(false);

vi.mock("@vueuse/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@vueuse/core")>();
  return {
    ...actual,
    useMediaQuery: (query: string) =>
      query.includes("prefers-reduced-motion") ? prefersReducedMotionMq : isMobileMq,
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
    prefersReducedMotionMq.value = false;
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

  it("renders avatar when camera muted but track still present", () => {
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

  it("applies animated speaking class when speaking and motion is allowed", async () => {
    prefersReducedMotionMq.value = false;
    const wrapper = mount(PlayerPresence, {
      props: { ...baseProps, isSpeaking: true },
    });
    const btn = wrapper.find("button");
    expect(btn.classes()).toContain("player-presence--speaking-animated");
    expect(btn.classes()).not.toContain("ring-state-turn-active");
    await wrapper.setProps({ isSpeaking: false });
    await flushPromises();
    expect(btn.classes()).not.toContain("player-presence--speaking-animated");
  });

  it("applies static ring when speaking under prefers-reduced-motion", async () => {
    prefersReducedMotionMq.value = true;
    const wrapper = mount(PlayerPresence, {
      props: { ...baseProps, isSpeaking: true },
    });
    const btn = wrapper.find("button");
    expect(btn.classes()).toContain("ring-2");
    expect(btn.classes()).toContain("ring-state-turn-active");
    expect(btn.classes()).not.toContain("player-presence--speaking-animated");
  });

  it("uses same speaking treatment for video and avatar branches", async () => {
    const track = createMockVideoTrack();
    for (const cameraOn of [true, false]) {
      prefersReducedMotionMq.value = false;
      const wrapper = mount(PlayerPresence, {
        props: {
          ...baseProps,
          videoTrack: cameraOn ? track : null,
          isCameraEnabled: cameraOn,
          isSpeaking: true,
        },
      });
      expect(wrapper.find("button").classes()).toContain("player-presence--speaking-animated");
    }
  });

  it("aria-label includes speaking when isSpeaking", () => {
    const quiet = mount(PlayerPresence, { props: baseProps });
    expect(quiet.find("button").attributes("aria-label")).toBe("Alice's seat");

    const speaking = mount(PlayerPresence, {
      props: { ...baseProps, isSpeaking: true },
    });
    expect(speaking.find("button").attributes("aria-label")).toBe("Alice's seat, speaking");
  });

  it("swaps speaking visual from animated to static ring when reduced-motion toggles at runtime", async () => {
    prefersReducedMotionMq.value = false;
    const wrapper = mount(PlayerPresence, {
      props: { ...baseProps, isSpeaking: true },
    });
    const btn = wrapper.find("button");
    expect(btn.classes()).toContain("player-presence--speaking-animated");
    expect(btn.classes()).not.toContain("ring-state-turn-active");

    prefersReducedMotionMq.value = true;
    await flushPromises();
    expect(btn.classes()).not.toContain("player-presence--speaking-animated");
    expect(btn.classes()).toContain("ring-2");
    expect(btn.classes()).toContain("ring-state-turn-active");
  });
});
