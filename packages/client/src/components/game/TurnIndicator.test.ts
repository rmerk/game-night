import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import TurnIndicator from "./TurnIndicator.vue";
import type { SeatWind } from "@mahjong-game/shared";

const playerNamesBySeat: Record<SeatWind, string> = {
  east: "You",
  south: "Alice",
  west: "Bob",
  north: "Carol",
};

function mountTurnIndicator(props: Partial<InstanceType<typeof TurnIndicator>["$props"]> = {}) {
  return mount(TurnIndicator, {
    props: {
      activeSeat: "east",
      playerNamesBySeat,
      ...props,
    },
  });
}

describe("TurnIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the active player's name in a persistent badge", () => {
    const wrapper = mountTurnIndicator({ activeSeat: "south" });

    expect(wrapper.get("[data-testid='turn-indicator']").text()).toContain("Alice");
    expect(wrapper.get("[data-testid='turn-indicator']").text()).toContain("Turn");
  });

  it("uses an aria-live polite region for turn narration", () => {
    const wrapper = mountTurnIndicator();

    expect(wrapper.get("[data-testid='turn-indicator']").attributes("aria-live")).toBe("polite");
  });

  it("narrates skipped seats before settling on the new active seat", async () => {
    const wrapper = mountTurnIndicator({ activeSeat: "east" });

    await wrapper.setProps({ activeSeat: "north" });

    expect(wrapper.get("[data-testid='turn-indicator']").text()).toContain("Alice");

    vi.advanceTimersByTime(400);
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[data-testid='turn-indicator']").text()).toContain("Bob");

    vi.advanceTimersByTime(400);
    await wrapper.vm.$nextTick();
    expect(wrapper.get("[data-testid='turn-indicator']").text()).toContain("Carol");
  });
});
