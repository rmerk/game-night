import { describe, expect, it } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import WallCounter from "./WallCounter.vue";

function mountWallCounter(wallRemaining = 40) {
  return mount(WallCounter, {
    props: { wallRemaining },
  });
}

describe("WallCounter", () => {
  it("renders the current wall count in an always-visible badge", () => {
    const wrapper = mountWallCounter(21);

    expect(wrapper.get("[data-testid='wall-counter']").text()).toContain("Wall: 21");
  });

  it("uses the normal state above the warning threshold", () => {
    const wrapper = mountWallCounter(21);

    expect(wrapper.get("[data-testid='wall-counter']").classes()).toContain("wall-normal");
  });

  it("switches to warning at 20 remaining tiles", () => {
    const wrapper = mountWallCounter(20);

    expect(wrapper.get("[data-testid='wall-counter']").classes()).toContain("wall-warning");
  });

  it("switches to critical at 10 remaining tiles and below", () => {
    const criticalWrapper = mountWallCounter(10);
    const belowCriticalWrapper = mountWallCounter(9);

    expect(criticalWrapper.get("[data-testid='wall-counter']").classes()).toContain(
      "wall-critical",
    );
    expect(belowCriticalWrapper.get("[data-testid='wall-counter']").classes()).toContain(
      "wall-critical",
    );
  });

  it("announces only threshold state changes with aria-live polite messaging", async () => {
    const wrapper = mountWallCounter(21);
    const liveRegion = wrapper.get("[data-testid='wall-counter-live']");

    expect(liveRegion.attributes("aria-live")).toBe("polite");
    expect(liveRegion.text()).toBe("");

    await wrapper.setProps({ wallRemaining: 20 });
    expect(liveRegion.text()).toContain("warning");

    await wrapper.setProps({ wallRemaining: 19 });
    expect(liveRegion.text()).toContain("warning");

    await wrapper.setProps({ wallRemaining: 10 });
    expect(liveRegion.text()).toContain("critical");
  });
});
