import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MobileBottomBar from "./MobileBottomBar.vue";

describe("MobileBottomBar", () => {
  it("renders the bottom bar", () => {
    const wrapper = mount(MobileBottomBar);
    expect(wrapper.find("[data-testid='mobile-bottom-bar']").exists()).toBe(true);
  });

  it("renders NMJL card button", () => {
    const wrapper = mount(MobileBottomBar);
    const btn = wrapper.find("[aria-label='Show NMJL card']");
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain("Card");
  });

  it("renders chat button", () => {
    const wrapper = mount(MobileBottomBar);
    const btn = wrapper.find("[aria-label='Open chat']");
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain("Chat");
  });

  it("renders A/V controls button", () => {
    const wrapper = mount(MobileBottomBar);
    const btn = wrapper.find("[aria-label='Audio video controls']");
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain("A/V");
  });

  it("all buttons are disabled (placeholders)", () => {
    const wrapper = mount(MobileBottomBar);
    const buttons = wrapper.findAll("button");
    expect(buttons.length).toBe(3);
    for (const btn of buttons) {
      expect(btn.attributes("disabled")).toBeDefined();
    }
  });

  it("buttons have min-tap class for 44px tap targets", () => {
    const wrapper = mount(MobileBottomBar);
    const buttons = wrapper.findAll("button");
    for (const btn of buttons) {
      expect(btn.classes()).toContain("min-tap");
    }
  });

  it("uses chrome-surface background", () => {
    const wrapper = mount(MobileBottomBar);
    const bar = wrapper.find("[data-testid='mobile-bottom-bar']");
    expect(bar.classes()).toContain("bg-chrome-surface");
  });
});
