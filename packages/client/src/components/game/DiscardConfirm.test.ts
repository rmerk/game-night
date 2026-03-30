import { describe, it, expect } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import DiscardConfirm from "./DiscardConfirm.vue";

describe("DiscardConfirm", () => {
  it("does not render when selectedTileId is null", () => {
    const wrapper = mount(DiscardConfirm, {
      props: { selectedTileId: null, isPlayerTurn: true },
    });
    expect(wrapper.find("[data-testid='discard-confirm']").exists()).toBe(false);
  });

  it("does not render when isPlayerTurn is false", () => {
    const wrapper = mount(DiscardConfirm, {
      props: { selectedTileId: "bam-3-1", isPlayerTurn: false },
    });
    expect(wrapper.find("[data-testid='discard-confirm']").exists()).toBe(false);
  });

  it("renders when selectedTileId is set and isPlayerTurn is true", () => {
    const wrapper = mount(DiscardConfirm, {
      props: { selectedTileId: "bam-3-1", isPlayerTurn: true },
    });
    const btn = wrapper.find("[data-testid='discard-confirm']");
    expect(btn.exists()).toBe(true);
    expect(btn.text()).toBe("Discard");
  });

  it("emits discard event with tileId on click", async () => {
    const wrapper = mount(DiscardConfirm, {
      props: { selectedTileId: "dot-5-2", isPlayerTurn: true },
    });
    await wrapper.find("[data-testid='discard-confirm']").trigger("click");
    expect(wrapper.emitted("discard")).toEqual([["dot-5-2"]]);
  });

  it("is a native button element (Enter/Space activate via built-in click)", () => {
    const wrapper = mount(DiscardConfirm, {
      props: { selectedTileId: "crak-1-1", isPlayerTurn: true },
    });
    const btn = wrapper.find("[data-testid='discard-confirm']");
    expect(btn.element.tagName).toBe("BUTTON");
  });

  it("has correct aria-label", () => {
    const wrapper = mount(DiscardConfirm, {
      props: { selectedTileId: "bam-3-1", isPlayerTurn: true },
    });
    expect(wrapper.find("[data-testid='discard-confirm']").attributes("aria-label")).toBe(
      "Discard selected tile",
    );
  });

  it("has minimum height of 44px (min-h-11)", () => {
    const wrapper = mount(DiscardConfirm, {
      props: { selectedTileId: "bam-3-1", isPlayerTurn: true },
    });
    const btn = wrapper.find("[data-testid='discard-confirm']");
    expect(btn.classes()).toContain("min-h-11");
  });
});
