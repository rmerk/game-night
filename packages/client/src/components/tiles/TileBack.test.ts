import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import TileBack from "./TileBack.vue";

describe("TileBack — size variants", () => {
  it("applies standard size class by default", () => {
    const wrapper = mount(TileBack);
    expect(wrapper.classes()).toContain("tile-back--size-standard");
    wrapper.unmount();
  });

  it("applies small size class", () => {
    const wrapper = mount(TileBack, { props: { size: "small" } });
    expect(wrapper.classes()).toContain("tile-back--size-small");
    wrapper.unmount();
  });

  it("applies celebration size class", () => {
    const wrapper = mount(TileBack, { props: { size: "celebration" } });
    expect(wrapper.classes()).toContain("tile-back--size-celebration");
    wrapper.unmount();
  });
});

describe("TileBack — accessibility", () => {
  it('has role="img"', () => {
    const wrapper = mount(TileBack);
    expect(wrapper.attributes("role")).toBe("img");
    wrapper.unmount();
  });

  it('has aria-label "Face-down tile"', () => {
    const wrapper = mount(TileBack);
    expect(wrapper.attributes("aria-label")).toBe("Face-down tile");
    wrapper.unmount();
  });
});

describe("TileBack — rendering", () => {
  it("references #tile-back sprite symbol", () => {
    const wrapper = mount(TileBack);
    const use = wrapper.find("use");
    expect(use.attributes("href")).toBe("#tile-back");
    wrapper.unmount();
  });
});
