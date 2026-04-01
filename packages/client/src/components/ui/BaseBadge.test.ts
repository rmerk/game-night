import { describe, expect, it } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import BaseBadge from "./BaseBadge.vue";

function mountBaseBadge(
  props: Partial<InstanceType<typeof BaseBadge>["$props"]> = {},
  attrs: Record<string, string> = {},
) {
  return mount(BaseBadge, {
    props: {
      variant: "pill",
      tone: "active",
      ...props,
    },
    attrs,
    slots: {
      default: "Current turn",
    },
  });
}

describe("BaseBadge", () => {
  it("renders a span by default", () => {
    const wrapper = mountBaseBadge();

    expect(wrapper.element.tagName).toBe("SPAN");
  });

  it("forwards aria, data, and extra class attributes", () => {
    const wrapper = mountBaseBadge(
      {},
      {
        "aria-label": "Connected",
        "data-testid": "seat-dot",
        class: "absolute",
      },
    );

    expect(wrapper.attributes("aria-label")).toBe("Connected");
    expect(wrapper.attributes("data-testid")).toBe("seat-dot");
    expect(wrapper.classes()).toContain("absolute");
  });

  it("applies the active turn pill styling", () => {
    const wrapper = mountBaseBadge({ variant: "pill", tone: "active" });

    expect(wrapper.classes()).toEqual(
      expect.arrayContaining([
        "rounded-full",
        "bg-state-turn-active/20",
        "font-semibold",
        "uppercase",
        "tracking-[0.12em]",
      ]),
    );
  });

  it("applies the wall-counter warning styling", () => {
    const wrapper = mountBaseBadge({ variant: "wall-counter", tone: "warning" });

    expect(wrapper.classes()).toEqual(
      expect.arrayContaining([
        "inline-flex",
        "rounded-full",
        "border",
        "bg-chrome-surface-dark/85",
        "shadow-panel",
        "border-wall-warning",
        "text-wall-warning",
      ]),
    );
  });

  it("applies the seat connection status-dot styling", () => {
    const wrapper = mountBaseBadge({ variant: "status-dot", tone: "success" });

    expect(wrapper.classes()).toEqual(
      expect.arrayContaining([
        "inline-block",
        "h-3",
        "w-3",
        "rounded-full",
        "border-2",
        "border-felt-teal",
        "bg-state-success",
      ]),
    );
  });

  it("supports the disconnected status-dot tone", () => {
    const wrapper = mountBaseBadge({ variant: "status-dot", tone: "muted" });

    expect(wrapper.classes()).toContain("bg-text-secondary");
  });
});
