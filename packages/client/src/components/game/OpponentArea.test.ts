import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import OpponentArea from "./OpponentArea.vue";

interface MockPlayer {
  name: string;
  initial: string;
  connected: boolean;
}

const connectedPlayer: MockPlayer = {
  name: "Alice",
  initial: "A",
  connected: true,
};

const disconnectedPlayer: MockPlayer = {
  name: "Bob",
  initial: "B",
  connected: false,
};

function mountOpponent(props: { position: "top" | "left" | "right"; player: MockPlayer | null }) {
  return mount(OpponentArea, { props });
}

describe("OpponentArea — player present", () => {
  it("renders avatar with player initial", () => {
    const wrapper = mountOpponent({ position: "top", player: connectedPlayer });
    expect(wrapper.text()).toContain("A");
  });

  it("renders player name", () => {
    const wrapper = mountOpponent({ position: "top", player: connectedPlayer });
    expect(wrapper.text()).toContain("Alice");
  });

  it("shows connected status dot with success color", () => {
    const wrapper = mountOpponent({ position: "top", player: connectedPlayer });
    const dot = wrapper.find("[aria-label='Connected']");
    expect(dot.exists()).toBe(true);
    expect(dot.classes()).toContain("bg-state-success");
  });

  it("shows disconnected status dot with secondary color", () => {
    const wrapper = mountOpponent({ position: "left", player: disconnectedPlayer });
    const dot = wrapper.find("[aria-label='Disconnected']");
    expect(dot.exists()).toBe(true);
    expect(dot.classes()).toContain("bg-text-secondary");
  });

  it("renders avatar with aria-label including player name", () => {
    const wrapper = mountOpponent({ position: "right", player: connectedPlayer });
    const avatar = wrapper.find('[aria-label="Alice\'s seat"]');
    expect(avatar.exists()).toBe(true);
  });
});

describe("OpponentArea — null player (empty seat)", () => {
  it("renders waiting text when player is null", () => {
    const wrapper = mountOpponent({ position: "top", player: null });
    expect(wrapper.text()).toContain("Waiting...");
  });

  it("renders placeholder avatar with question mark", () => {
    const wrapper = mountOpponent({ position: "top", player: null });
    expect(wrapper.text()).toContain("?");
  });

  it("does not render connection status dot", () => {
    const wrapper = mountOpponent({ position: "top", player: null });
    expect(wrapper.find("[aria-label='Connected']").exists()).toBe(false);
    expect(wrapper.find("[aria-label='Disconnected']").exists()).toBe(false);
  });
});
