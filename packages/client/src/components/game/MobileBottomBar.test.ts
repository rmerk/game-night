import { describe, it, expect } from "vite-plus/test";
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

  it("renders A/V controls button", () => {
    const wrapper = mount(MobileBottomBar);
    const btn = wrapper.find("[aria-label='Audio video controls']");
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain("A/V");
  });

  it("placeholder buttons use aria-disabled instead of disabled so they stay focusable", () => {
    const wrapper = mount(MobileBottomBar);
    const buttons = wrapper.findAll("button");
    expect(buttons.length).toBe(2);
    for (const btn of buttons) {
      expect(btn.attributes("disabled")).toBeUndefined();
      expect(btn.attributes("aria-disabled")).toBe("true");
      expect(btn.attributes("type")).toBe("button");
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
    expect(bar.classes().some((className) => className.includes("bg-chrome-surface"))).toBe(true);
  });

  it("uses roving tabindex so the controls placeholder is a single tab stop", () => {
    const wrapper = mount(MobileBottomBar);
    const buttons = wrapper.findAll("button");

    expect(buttons[0]?.attributes("tabindex")).toBe("0");
    expect(buttons[1]?.attributes("tabindex")).toBe("-1");
  });

  it("moves focus between placeholder controls with arrow keys", async () => {
    const wrapper = mount(MobileBottomBar, {
      attachTo: document.body,
    });
    const buttons = wrapper.findAll("button");
    const cardButton = buttons[0];
    const avButton = buttons[1];

    (cardButton.element as HTMLElement).focus();
    await cardButton.trigger("keydown", { key: "ArrowRight" });

    expect(document.activeElement).toBe(avButton.element);
    expect(cardButton.attributes("tabindex")).toBe("-1");
    expect(avButton.attributes("tabindex")).toBe("0");

    await avButton.trigger("keydown", { key: "ArrowLeft" });

    expect(document.activeElement).toBe(cardButton.element);
    expect(cardButton.attributes("tabindex")).toBe("0");
    expect(avButton.attributes("tabindex")).toBe("-1");

    wrapper.unmount();
  });
});
