import { describe, it, expect, beforeEach, vi } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import VideoThumbnail from "./VideoThumbnail.vue";

function createMockTrack() {
  const videoEl = document.createElement("video");
  const detach = vi.fn();
  const attach = vi.fn(() => videoEl);
  return { attach, detach, kind: "video" };
}

describe("VideoThumbnail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls attach and mounts video in container", () => {
    const track = createMockTrack();
    const wrapper = mount(VideoThumbnail, {
      props: { videoTrack: track },
    });
    expect(track.attach).toHaveBeenCalled();
    const mountEl = wrapper.find('[data-testid="video-thumbnail"]');
    expect(mountEl.exists()).toBe(true);
    const inner = mountEl.find("div").element;
    expect(inner.querySelector("video")).toBe(track.attach.mock.results[0]?.value);
  });

  it("disconnects on unmount", () => {
    const track = createMockTrack();
    const wrapper = mount(VideoThumbnail, {
      props: { videoTrack: track },
    });
    wrapper.unmount();
    expect(track.detach).toHaveBeenCalled();
  });

  it("detaches previous track when videoTrack prop changes", async () => {
    const t1 = createMockTrack();
    const t2 = createMockTrack();
    const wrapper = mount(VideoThumbnail, {
      props: { videoTrack: t1 },
    });
    await wrapper.setProps({ videoTrack: t2 });
    expect(t1.detach).toHaveBeenCalled();
    expect(t2.attach).toHaveBeenCalled();
  });
});
