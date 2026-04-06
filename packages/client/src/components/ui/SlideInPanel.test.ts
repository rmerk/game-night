import { describe, it, expect } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import SlideInPanel from "./SlideInPanel.vue";

describe("SlideInPanel", () => {
  it("uses partial-height bottom sheet classes when mobilePlacement is bottom", () => {
    const wrapper = mount(SlideInPanel, {
      props: { open: true, label: "Test", mobilePlacement: "bottom" },
    });
    const surface = wrapper.find('[role="dialog"]');
    expect(surface.classes().join(" ")).toMatch(/max-h-\[48dvh\]/);
    expect(surface.classes().join(" ")).toMatch(/slide-in-panel__surface--mobile-bottom/);
  });

  it("uses top split max-height when mobilePlacement is top", () => {
    const wrapper = mount(SlideInPanel, {
      props: { open: true, label: "Test", mobilePlacement: "top" },
    });
    const surface = wrapper.find('[role="dialog"]');
    expect(surface.classes().join(" ")).toMatch(/max-h-\[58dvh\]/);
    expect(surface.classes().join(" ")).toMatch(/slide-in-panel__surface--mobile-top/);
  });
});
