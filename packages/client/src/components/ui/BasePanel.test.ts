import { describe, expect, it } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import BasePanel from "./BasePanel.vue";

function mountBasePanel(
  props: Partial<InstanceType<typeof BasePanel>["$props"]> = {},
  attrs: Record<string, string> = {},
) {
  return mount(BasePanel, {
    props: {
      variant: "dark-raised",
      ...props,
    },
    attrs,
    slots: {
      default: "Panel content",
    },
  });
}

describe("BasePanel", () => {
  it("renders a div by default", () => {
    const wrapper = mountBasePanel();

    expect(wrapper.element.tagName).toBe("DIV");
  });

  it("supports semantic tag overrides", () => {
    const wrapper = mountBasePanel({ tag: "section" });

    expect(wrapper.element.tagName).toBe("SECTION");
  });

  it("forwards aria, data, and extra class attributes", () => {
    const wrapper = mountBasePanel(
      {},
      {
        "aria-label": "Scoreboard shell",
        "data-testid": "scoreboard-shell",
        class: "rounded-2xl p-4",
      },
    );

    expect(wrapper.attributes("aria-label")).toBe("Scoreboard shell");
    expect(wrapper.attributes("data-testid")).toBe("scoreboard-shell");
    expect(wrapper.classes()).toEqual(expect.arrayContaining(["rounded-2xl", "p-4"]));
  });

  it("applies the dark raised surface used by scoreboard and status shells", () => {
    const wrapper = mountBasePanel({ variant: "dark-raised" });

    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(["bg-chrome-surface-dark/85", "text-text-on-felt", "shadow-panel"]),
    );
  });

  it("applies the dark muted surface used by scoreboard rows", () => {
    const wrapper = mountBasePanel({ variant: "dark-muted" });

    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(["bg-chrome-surface-dark/50", "text-text-on-felt"]),
    );
  });

  it("applies the chrome raised surface used by mobile control shells", () => {
    const wrapper = mountBasePanel({ variant: "chrome-raised" });

    expect(wrapper.classes()).toEqual(
      expect.arrayContaining(["bg-chrome-surface/85", "text-text-primary", "shadow-panel"]),
    );
  });
});
