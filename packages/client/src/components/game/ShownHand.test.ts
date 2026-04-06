import { describe, expect, it } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import ShownHand from "./ShownHand.vue";
import { TILE_MIN_WIDTH_PX } from "../tiles/tile-sizing";
import type { SuitedTile } from "@mahjong-game/shared";

const sampleTile: SuitedTile = {
  id: "bam-1-1",
  category: "suited",
  suit: "bam",
  value: 1,
  copy: 1,
};

describe("ShownHand", () => {
  it("renders tile row with player name", () => {
    const wrapper = mount(ShownHand, {
      props: {
        tiles: [sampleTile],
        playerName: "Alice",
        position: "top",
      },
    });
    expect(wrapper.get('[data-testid="shown-hand-top"]').text()).toContain("Alice");
    expect(wrapper.find('[data-testid="shown-hand-tiles"]').exists()).toBe(true);
  });

  it("sets minimum width on tile strip for legibility", () => {
    const wrapper = mount(ShownHand, {
      props: {
        tiles: [sampleTile],
        playerName: "Bob",
        position: "local",
      },
    });
    const strip = wrapper.get('[data-testid="shown-hand-tiles"]');
    expect(strip.attributes("style") ?? "").toContain(String(TILE_MIN_WIDTH_PX));
  });

  it("omits tile strip when tiles array is empty", () => {
    const wrapper = mount(ShownHand, {
      props: {
        tiles: [],
        playerName: "Carol",
        position: "right",
      },
    });
    expect(wrapper.find('[data-testid="shown-hand-tiles"]').exists()).toBe(false);
    expect(wrapper.text()).toContain("Carol");
  });
});
