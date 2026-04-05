import { describe, expect, it } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import OpponentArea from "./OpponentArea.vue";
import type { OpponentPlayer } from "./seat-types";

const connectedPlayer: OpponentPlayer = {
  id: "player-south",
  name: "Alice",
  initial: "A",
  connected: true,
  seatWind: "south",
};

const disconnectedPlayer: OpponentPlayer = {
  id: "player-west",
  name: "Bob",
  initial: "B",
  connected: false,
  seatWind: "west",
};

function mountOpponentArea(props: Partial<InstanceType<typeof OpponentArea>["$props"]> = {}) {
  return mount(OpponentArea, {
    props: {
      position: "top",
      player: connectedPlayer,
      isActiveTurn: false,
      score: null,
      ...props,
    },
  });
}

describe("OpponentArea — player present", () => {
  it("renders avatar with player initial", () => {
    const wrapper = mountOpponentArea();
    expect(wrapper.text()).toContain("A");
  });

  it("renders player name", () => {
    const wrapper = mountOpponentArea();
    expect(wrapper.text()).toContain("Alice");
  });

  it("shows connected status dot with success color", () => {
    const wrapper = mountOpponentArea();
    const dot = wrapper.find("[aria-label='Connected']");
    expect(dot.exists()).toBe(true);
    expect(dot.classes()).toContain("bg-state-success");
  });

  it("shows disconnected status dot with secondary color", () => {
    const wrapper = mountOpponentArea({ player: disconnectedPlayer });
    const dot = wrapper.find("[aria-label='Disconnected']");
    expect(dot.exists()).toBe(true);
    expect(dot.classes()).toContain("bg-text-secondary");
  });

  it("shows reconnecting label when player is disconnected", () => {
    const wrapper = mountOpponentArea({ player: disconnectedPlayer });
    const label = wrapper.find("[data-testid='seat-reconnecting-label']");
    expect(label.exists()).toBe(true);
    expect(label.text()).toContain("Bob");
    expect(label.text()).toContain("reconnecting");
  });

  it("does not show reconnecting label when player is connected", () => {
    const wrapper = mountOpponentArea({ player: connectedPlayer });
    expect(wrapper.find("[data-testid='seat-reconnecting-label']").exists()).toBe(false);
  });

  it("renders avatar with aria-label including player name", () => {
    const wrapper = mountOpponentArea();
    const avatar = wrapper.find('[aria-label="Alice\'s seat"]');
    expect(avatar.exists()).toBe(true);
  });

  it("renders a compact score label when score data is provided", () => {
    const wrapper = mountOpponentArea({ score: 35 });

    expect(wrapper.get("[data-testid='seat-score']").text()).toBe("Score: 35");
  });

  it("shows active turn styling and text only for the active seat", () => {
    const activeWrapper = mountOpponentArea({ isActiveTurn: true });
    const inactiveWrapper = mountOpponentArea({ isActiveTurn: false });

    expect(activeWrapper.get("[data-testid='seat-status']").text()).toContain("Current turn");
    expect(activeWrapper.get("[data-testid='opponent-area-shell']").classes()).toContain(
      "ring-state-turn-active",
    );
    expect(inactiveWrapper.find("[data-testid='seat-status']").exists()).toBe(false);
    expect(inactiveWrapper.get("[data-testid='opponent-area-shell']").classes()).not.toContain(
      "ring-state-turn-active",
    );
  });
});

describe("OpponentArea — null player (empty seat)", () => {
  it("renders waiting text when player is null", () => {
    const wrapper = mountOpponentArea({ player: null });
    expect(wrapper.text()).toContain("Waiting...");
  });

  it("renders placeholder avatar with question mark", () => {
    const wrapper = mountOpponentArea({ player: null });
    expect(wrapper.text()).toContain("?");
  });

  it("does not render connection status dot", () => {
    const wrapper = mountOpponentArea({ player: null });
    expect(wrapper.find("[aria-label='Connected']").exists()).toBe(false);
    expect(wrapper.find("[aria-label='Disconnected']").exists()).toBe(false);
  });
});
