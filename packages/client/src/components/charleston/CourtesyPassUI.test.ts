import { describe, it, expect } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import CourtesyPassUI from "./CourtesyPassUI.vue";
import type { PlayerCharlestonView } from "@mahjong-game/shared";

function view(over: Partial<PlayerCharlestonView> = {}): PlayerCharlestonView {
  return {
    stage: "courtesy",
    status: "courtesy-ready",
    currentDirection: null,
    activePlayerIds: [],
    submittedPlayerIds: [],
    votesReceivedCount: 0,
    courtesyPairings: [],
    courtesyResolvedPairCount: 0,
    myHiddenTileCount: 0,
    mySubmissionLocked: false,
    myVote: null,
    myCourtesySubmission: null,
    ...over,
  };
}

describe("CourtesyPassUI", () => {
  it("emits count-change when selecting count", async () => {
    const w = mount(CourtesyPassUI, {
      props: {
        charleston: view(),
        selectedTileIds: new Set<string>(),
        isComplete: false,
        progressText: "0 of 2 selected",
      },
    });
    await w.find("[data-testid='courtesy-count-2']").trigger("click");
    expect(w.emitted("count-change")?.[0]).toEqual([2]);
  });

  it("submits skip with count 0", async () => {
    const w = mount(CourtesyPassUI, {
      props: {
        charleston: view(),
        selectedTileIds: new Set<string>(),
        isComplete: true,
        progressText: "No tiles to select",
      },
    });
    await w.find("[data-testid='courtesy-skip']").trigger("click");
    expect(w.emitted("courtesy-pass")?.[0]).toEqual([0, []]);
  });

  it("submits courtesy pass with tiles when count > 0", async () => {
    const w = mount(CourtesyPassUI, {
      props: {
        charleston: view(),
        selectedTileIds: new Set<string>(["x", "y"]),
        isComplete: true,
        progressText: "2 of 2 selected",
      },
    });
    await w.find("[data-testid='courtesy-count-2']").trigger("click");
    await w.find("[data-testid='courtesy-submit']").trigger("click");
    expect(w.emitted("courtesy-pass")?.[0]).toEqual([2, ["x", "y"]]);
  });

  it("shows waiting when locked", () => {
    const w = mount(CourtesyPassUI, {
      props: {
        charleston: view({ mySubmissionLocked: true }),
        selectedTileIds: new Set<string>(),
        isComplete: false,
        progressText: "",
      },
    });
    expect(w.find("[data-testid='courtesy-waiting']").exists()).toBe(true);
  });
});
