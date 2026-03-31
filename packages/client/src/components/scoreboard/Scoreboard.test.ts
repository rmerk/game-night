import { describe, expect, it } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import Scoreboard from "./Scoreboard.vue";
import type { GameResult } from "@mahjong-game/shared";

const playerNamesById = {
  p1: "Alice",
  p2: "Bob",
  p3: "Carol",
  p4: "Dana",
};

const playerOrder = ["p1", "p2", "p3", "p4"];

const mahjongResult: GameResult = {
  winnerId: "p1",
  patternId: "double-run",
  patternName: "Double Run",
  points: 50,
  selfDrawn: false,
  discarderId: "p2",
  payments: {
    p1: 150,
    p2: -50,
    p3: -50,
    p4: -50,
  },
};

const wallGameResult: GameResult = {
  winnerId: null,
  points: 0,
};

function mountScoreboard(props: Partial<InstanceType<typeof Scoreboard>["$props"]> = {}) {
  return mount(Scoreboard, {
    props: {
      gameResult: mahjongResult,
      playerNamesById,
      playerOrder,
      sessionScores: {
        p1: 150,
        p2: -50,
        p3: -50,
        p4: -50,
      },
      ...props,
    },
  });
}

describe("Scoreboard", () => {
  it("renders a Mahjong win breakdown with winner, pattern, and payments", () => {
    const wrapper = mountScoreboard();

    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("Alice");
    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("Double Run");
    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("50 points");
    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("+150");
    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("-50");
  });

  it("renders a wall-game variant when winnerId is null", () => {
    const wrapper = mountScoreboard({
      gameResult: wallGameResult,
      sessionScores: {
        p1: 0,
        p2: 0,
        p3: 0,
        p4: 0,
      },
    });

    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("Wall game");
    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("No winner this hand");
    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("Session totals");
  });

  it("renders a zeroed payment breakdown for wall games", () => {
    const wrapper = mountScoreboard({
      gameResult: wallGameResult,
      sessionScores: {
        p1: 0,
        p2: 0,
        p3: 0,
        p4: 0,
      },
    });

    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("Payments");
    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("Alice");
    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("Bob");
    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("Carol");
    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("Dana");
    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("0");
  });
});
