import { describe, expect, it } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import Scoreboard from "./Scoreboard.vue";
import BaseButton from "../ui/BaseButton.vue";
import type { GameResult, SessionGameHistoryEntry } from "@mahjong-game/shared";

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

  it("shows host actions when viewerIsHost is true", () => {
    const wrapper = mountScoreboard({ viewerIsHost: true });
    expect(wrapper.find('[data-testid="scoreboard-play-again"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="scoreboard-end-session"]').exists()).toBe(true);
  });

  it("does not show host actions when viewerIsHost is false", () => {
    const wrapper = mountScoreboard({ viewerIsHost: false });
    expect(wrapper.find('[data-testid="scoreboard-play-again"]').exists()).toBe(false);
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

    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("This game");
    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("Alice");
    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("Bob");
    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("Carol");
    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("Dana");
    expect(wrapper.get("[data-testid='scoreboard']").text()).toContain("0");
  });

  it("renders earlier games from sessionGameHistory with Mahjong and wall summaries", () => {
    const sessionGameHistory: SessionGameHistoryEntry[] = [
      {
        gameNumber: 1,
        finalScores: { p1: 10, p2: -3, p3: -3, p4: -4 },
        gameResult: {
          winnerId: "p2",
          patternId: "pung",
          patternName: "Pung Hand",
          points: 25,
          selfDrawn: true,
          payments: { p1: 0, p2: 0, p3: 0, p4: 0 },
        },
      },
      {
        gameNumber: 2,
        finalScores: { p1: 0, p2: 0, p3: 0, p4: 0 },
        gameResult: { winnerId: null, points: 0 },
      },
    ];
    const wrapper = mountScoreboard({ sessionGameHistory });

    const text = wrapper.get("[data-testid='scoreboard']").text();
    expect(text).toContain("Earlier games");
    expect(text).toContain("Game 1");
    expect(text).toContain("Bob — Pung Hand (25 pts)");
    expect(text).toContain("Game 2");
    expect(text).toContain("Wall game — no winner");
  });

  it("emits playAgain and endSession when host clicks actions", async () => {
    const wrapper = mountScoreboard({ viewerIsHost: true });

    await wrapper.get('[data-testid="scoreboard-play-again"]').trigger("click");
    await wrapper.get('[data-testid="scoreboard-end-session"]').trigger("click");

    expect(wrapper.emitted("playAgain")?.length).toBe(1);
    expect(wrapper.emitted("endSession")?.length).toBe(1);
  });

  it("uses primary variant for Play again and secondary for End session", () => {
    const wrapper = mountScoreboard({ viewerIsHost: true });

    const buttons = wrapper.findAllComponents(BaseButton);
    const playAgain = buttons.find((b) => b.attributes("data-testid") === "scoreboard-play-again");
    const endSession = buttons.find(
      (b) => b.attributes("data-testid") === "scoreboard-end-session",
    );

    expect(playAgain?.props("variant")).toBe("primary");
    expect(endSession?.props("variant")).toBe("secondary");
  });

  it("renders Show My Hand for all viewers", () => {
    const wrapper = mountScoreboard();
    const btn = wrapper.get('[data-testid="scoreboard-show-hand"]');
    expect(btn.text()).toContain("Show My Hand");
    expect(btn.attributes("disabled")).toBeUndefined();
  });

  it("emits showHand when Show My Hand is clicked", async () => {
    const wrapper = mountScoreboard({ hasShownHand: false });
    await wrapper.get('[data-testid="scoreboard-show-hand"]').trigger("click");
    expect(wrapper.emitted("showHand")?.length).toBe(1);
  });

  it("disables button and shows Hand Shown when hasShownHand is true", () => {
    const wrapper = mountScoreboard({ hasShownHand: true });
    const btn = wrapper.get('[data-testid="scoreboard-show-hand"]');
    expect(btn.text()).toContain("Hand Shown");
    expect(btn.attributes("disabled")).toBeDefined();
  });
});
