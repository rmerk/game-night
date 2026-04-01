import { describe, expect, it } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import BaseButton from "./BaseButton.vue";

function mountBaseButton(
  props: Partial<InstanceType<typeof BaseButton>["$props"]> = {},
  attrs: Record<string, string> = {},
) {
  return mount(BaseButton, {
    props: {
      variant: "primary",
      ...props,
    },
    attrs,
    slots: {
      default: "Action",
    },
  });
}

describe("BaseButton", () => {
  it("renders a native button with type=button by default", () => {
    const wrapper = mountBaseButton();

    expect(wrapper.element.tagName).toBe("BUTTON");
    expect(wrapper.attributes("type")).toBe("button");
  });

  it("forwards aria, data, and extra class attributes", () => {
    const wrapper = mountBaseButton(
      {},
      {
        "aria-label": "Declare Mahjong",
        "data-testid": "mahjong-button",
        class: "w-full",
      },
    );

    expect(wrapper.attributes("aria-label")).toBe("Declare Mahjong");
    expect(wrapper.attributes("data-testid")).toBe("mahjong-button");
    expect(wrapper.classes()).toContain("w-full");
  });

  it("emits click when activated", async () => {
    const wrapper = mountBaseButton();

    await wrapper.trigger("click");

    expect(wrapper.emitted("click")).toHaveLength(1);
  });

  it("applies the primary tier used by Mahjong and Discard buttons", () => {
    const wrapper = mountBaseButton({ variant: "primary" });

    expect(wrapper.classes()).toEqual(
      expect.arrayContaining([
        "min-h-11",
        "px-6",
        "rounded-md",
        "bg-gold-accent",
        "text-text-primary",
        "text-game-critical",
        "shadow-tile",
      ]),
    );
  });

  it("applies the urgent tier used by call-window actions", () => {
    const wrapper = mountBaseButton({ variant: "urgent" });

    expect(wrapper.classes()).toEqual(
      expect.arrayContaining([
        "bg-state-call-window",
        "text-white",
        "text-game-critical",
        "shadow-tile",
      ]),
    );
  });

  it("applies the secondary tier used by passive chrome actions", () => {
    const wrapper = mountBaseButton({ variant: "secondary" });

    expect(wrapper.classes()).toEqual(
      expect.arrayContaining([
        "bg-chrome-surface",
        "border",
        "border-chrome-border",
        "text-text-primary",
        "text-interactive",
        "shadow-tile",
      ]),
    );
  });

  it("supports the subtle-danger tier used by cancel actions", () => {
    const wrapper = mountBaseButton({ variant: "subtle-danger" });

    expect(wrapper.classes()).toEqual(
      expect.arrayContaining([
        "border",
        "border-state-error",
        "text-state-error",
        "hover:bg-state-error/10",
      ]),
    );
  });
});
