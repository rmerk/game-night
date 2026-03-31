import { describe, expect, it } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import MahjongButton from "./MahjongButton.vue";

function mountMahjongButton(
  props: {
    isCallWindowOpen?: boolean;
    hideForCallDuplication?: boolean;
  } = {},
) {
  return mount(MahjongButton, {
    props: {
      isCallWindowOpen: props.isCallWindowOpen ?? false,
      hideForCallDuplication: props.hideForCallDuplication ?? false,
    },
  });
}

describe("MahjongButton", () => {
  it("always renders in the DOM", () => {
    const wrapper = mountMahjongButton();
    expect(wrapper.find("[data-testid='mahjong-button']").exists()).toBe(true);
  });

  it("uses Primary tier styling classes", () => {
    const wrapper = mountMahjongButton();
    const button = wrapper.get("[data-testid='mahjong-button']");

    expect(button.classes()).toEqual(
      expect.arrayContaining([
        "bg-gold-accent",
        "text-text-primary",
        "text-game-critical",
        "min-h-11",
        "px-6",
        "rounded-md",
        "shadow-tile",
      ]),
    );
  });

  it("emits declareMahjong when clicked outside a call window", async () => {
    const wrapper = mountMahjongButton({ isCallWindowOpen: false });

    await wrapper.get("[data-testid='mahjong-button']").trigger("click");

    expect(wrapper.emitted("declareMahjong")).toEqual([[]]);
    expect(wrapper.emitted("callMahjong")).toBeUndefined();
  });

  it("emits callMahjong when clicked during a call window", async () => {
    const wrapper = mountMahjongButton({ isCallWindowOpen: true });

    await wrapper.get("[data-testid='mahjong-button']").trigger("click");

    expect(wrapper.emitted("callMahjong")).toEqual([[]]);
    expect(wrapper.emitted("declareMahjong")).toBeUndefined();
  });

  it("has accessible button semantics and minimum height", () => {
    const wrapper = mountMahjongButton();
    const button = wrapper.get("[data-testid='mahjong-button']");

    expect(button.element.tagName).toBe("BUTTON");
    expect(button.attributes("aria-label")).toBe("Declare Mahjong");
    expect(button.classes()).toContain("min-h-11");
  });

  it("announces the call action during a call window", () => {
    const wrapper = mountMahjongButton({ isCallWindowOpen: true });

    expect(wrapper.get("[data-testid='mahjong-button']").attributes("aria-label")).toBe(
      "Call Mahjong",
    );
  });

  it("hides the persistent button when call duplication is active", () => {
    const wrapper = mountMahjongButton({ hideForCallDuplication: true });
    const button = wrapper.get("[data-testid='mahjong-button']");

    expect(button.attributes("style")).toContain("display: none");
  });
});
