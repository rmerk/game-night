import { WALL_CRITICAL_THRESHOLD, WALL_WARNING_THRESHOLD } from "@mahjong-game/shared";
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
    const wrapper = mountWallCounter(WALL_WARNING_THRESHOLD + 1);

    expect(wrapper.get("[data-testid='wall-counter']").text()).toContain(
      `Wall: ${WALL_WARNING_THRESHOLD + 1}`,
    );
  });

  it("uses the normal state above the warning threshold", () => {
    const wrapper = mountWallCounter(WALL_WARNING_THRESHOLD + 1);

    expect(wrapper.get("[data-testid='wall-counter']").classes()).toContain("border-wall-normal");
  });

  it("applies expressive tone transition classes on the badge", () => {
    const wrapper = mountWallCounter(WALL_WARNING_THRESHOLD + 1);
    const badge = wrapper.get("[data-testid='wall-counter']");

    expect(badge.classes()).toContain("wall-counter-tone-transition");
    expect(badge.classes()).toContain("wall-counter-wash-normal");
  });

  it("switches to warning at the warning threshold remaining tiles", () => {
    const wrapper = mountWallCounter(WALL_WARNING_THRESHOLD);

    expect(wrapper.get("[data-testid='wall-counter']").classes()).toEqual(
      expect.arrayContaining(["border-wall-warning", "text-wall-warning"]),
    );
  });

  it("switches to critical at the critical threshold and below", () => {
    const criticalWrapper = mountWallCounter(WALL_CRITICAL_THRESHOLD);
    const belowCriticalWrapper = mountWallCounter(WALL_CRITICAL_THRESHOLD - 1);

    expect(criticalWrapper.get("[data-testid='wall-counter']").classes()).toEqual(
      expect.arrayContaining(["border-wall-critical", "text-wall-critical"]),
    );
    expect(belowCriticalWrapper.get("[data-testid='wall-counter']").classes()).toEqual(
      expect.arrayContaining(["border-wall-critical", "text-wall-critical"]),
    );
  });

  it("updates the inset wash class when crossing from warning to critical", async () => {
    const wrapper = mountWallCounter(WALL_WARNING_THRESHOLD);
    const badge = wrapper.get("[data-testid='wall-counter']");

    expect(badge.classes()).toContain("wall-counter-wash-warning");

    await wrapper.setProps({ wallRemaining: WALL_CRITICAL_THRESHOLD });
    expect(badge.classes()).toContain("wall-counter-wash-critical");
    expect(badge.classes()).not.toContain("wall-counter-wash-warning");
  });

  it("announces only threshold state changes with aria-live polite messaging", async () => {
    const wrapper = mountWallCounter(WALL_WARNING_THRESHOLD + 1);
    const liveRegion = wrapper.get("[data-testid='wall-counter-live']");

    expect(liveRegion.attributes("aria-live")).toBe("polite");
    expect(liveRegion.text()).toBe("");

    await wrapper.setProps({ wallRemaining: WALL_WARNING_THRESHOLD });
    expect(liveRegion.text()).toContain("warning");

    await wrapper.setProps({ wallRemaining: WALL_WARNING_THRESHOLD - 1 });
    expect(liveRegion.text()).toContain("warning");

    await wrapper.setProps({ wallRemaining: WALL_CRITICAL_THRESHOLD });
    expect(liveRegion.text()).toContain("critical");
  });

  it("keeps the live-region count in sync after entering the warning state", async () => {
    const wrapper = mountWallCounter(WALL_WARNING_THRESHOLD + 1);
    const liveRegion = wrapper.get("[data-testid='wall-counter-live']");

    await wrapper.setProps({ wallRemaining: WALL_WARNING_THRESHOLD });
    expect(liveRegion.text()).toBe(`Wall warning: ${WALL_WARNING_THRESHOLD} tiles remain.`);

    await wrapper.setProps({ wallRemaining: WALL_WARNING_THRESHOLD - 1 });
    expect(liveRegion.text()).toBe(`Wall warning: ${WALL_WARNING_THRESHOLD - 1} tiles remain.`);
  });
});
