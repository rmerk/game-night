import { describe, it, expect } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import MobileBottomBar from "./MobileBottomBar.vue";

describe("MobileBottomBar", () => {
  function mountBar(options?: Parameters<typeof mount>[1]) {
    setActivePinia(createPinia());
    return mount(MobileBottomBar, options);
  }

  it("renders the bottom bar", () => {
    const wrapper = mountBar();
    expect(wrapper.find("[data-testid='mobile-bottom-bar']").exists()).toBe(true);
  });

  it("renders NMJL card button", () => {
    const wrapper = mountBar();
    const btn = wrapper.find("[aria-label='Show NMJL card']");
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain("Card");
  });

  it("renders chat toggle", () => {
    const wrapper = mountBar();
    const btn = wrapper.find("[data-testid='chat-toggle-mobile']");
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain("Chat");
  });

  it("renders settings toggle", () => {
    const wrapper = mountBar();
    const btn = wrapper.find("[data-testid='settings-toggle-mobile']");
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain("Settings");
  });

  it("renders A/V controls button", () => {
    const wrapper = mountBar();
    const btn = wrapper.find("[aria-label='Audio video controls']");
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toContain("A/V");
  });

  it("only the disabled placeholder uses aria-disabled so Card/Chat/Settings stay activatable", () => {
    const wrapper = mountBar();
    const buttons = wrapper.findAll("button");
    expect(buttons.length).toBe(4);
    expect(buttons[0]?.attributes("aria-disabled")).toBeUndefined();
    expect(buttons[1]?.attributes("aria-disabled")).toBeUndefined();
    expect(buttons[2]?.attributes("aria-disabled")).toBeUndefined();
    expect(buttons[3]?.attributes("aria-disabled")).toBe("true");
    for (const btn of buttons) {
      expect(btn.attributes("disabled")).toBeUndefined();
      expect(btn.attributes("type")).toBe("button");
    }
  });

  it("buttons have min-tap class for 44px tap targets", () => {
    const wrapper = mountBar();
    const buttons = wrapper.findAll("button");
    for (const btn of buttons) {
      expect(btn.classes()).toContain("min-tap");
    }
  });

  it("uses chrome-surface background", () => {
    const wrapper = mountBar();
    const bar = wrapper.find("[data-testid='mobile-bottom-bar']");
    expect(bar.classes().some((className) => className.includes("bg-chrome-surface"))).toBe(true);
  });

  it("uses roving tabindex so the bottom bar is a single tab stop", () => {
    const wrapper = mountBar();
    const buttons = wrapper.findAll("button");

    expect(buttons[0]?.attributes("tabindex")).toBe("0");
    expect(buttons[1]?.attributes("tabindex")).toBe("-1");
    expect(buttons[2]?.attributes("tabindex")).toBe("-1");
    expect(buttons[3]?.attributes("tabindex")).toBe("-1");
  });

  it("moves focus between controls with arrow keys", async () => {
    const wrapper = mountBar({ attachTo: document.body });
    const buttons = wrapper.findAll("button");
    const cardButton = buttons[0];
    const chatButton = buttons[1];
    const settingsButton = buttons[2];
    const avButton = buttons[3];

    (cardButton.element as HTMLElement).focus();
    await cardButton.trigger("keydown", { key: "ArrowRight" });

    expect(document.activeElement).toBe(chatButton.element);
    expect(cardButton.attributes("tabindex")).toBe("-1");
    expect(chatButton.attributes("tabindex")).toBe("0");

    await chatButton.trigger("keydown", { key: "ArrowRight" });
    expect(document.activeElement).toBe(settingsButton.element);

    await settingsButton.trigger("keydown", { key: "ArrowRight" });
    expect(document.activeElement).toBe(avButton.element);

    await avButton.trigger("keydown", { key: "ArrowLeft" });
    expect(document.activeElement).toBe(settingsButton.element);

    await settingsButton.trigger("keydown", { key: "ArrowLeft" });
    expect(document.activeElement).toBe(chatButton.element);

    await chatButton.trigger("keydown", { key: "ArrowLeft" });
    expect(document.activeElement).toBe(cardButton.element);

    wrapper.unmount();
  });
});
