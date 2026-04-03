import { describe, it, expect } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import CharlestonZone from "./CharlestonZone.vue";
import type { PlayerCharlestonView } from "@mahjong-game/shared";
import type { Tile } from "@mahjong-game/shared";

function view(over: Partial<PlayerCharlestonView> = {}): PlayerCharlestonView {
  return {
    stage: "first",
    status: "passing",
    currentDirection: "right",
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

const tiles: Tile[] = [{ id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 }];

describe("CharlestonZone", () => {
  it("shows direction label for right", () => {
    const w = mount(CharlestonZone, {
      props: {
        charleston: view({ currentDirection: "right" }),
        myRack: tiles,
        selectedTileIds: new Set<string>(),
        isComplete: false,
        progressText: "0 of 3 selected",
      },
    });
    expect(w.find("[data-testid='charleston-direction']").text()).toContain("Right");
  });

  it("shows progress text when not locked", () => {
    const w = mount(CharlestonZone, {
      props: {
        charleston: view(),
        myRack: tiles,
        selectedTileIds: new Set<string>(["a", "b"]),
        isComplete: false,
        progressText: "2 of 3 selected",
      },
    });
    expect(w.find("[data-testid='charleston-progress']").text()).toBe("2 of 3 selected");
  });

  it("disables Pass when incomplete", () => {
    const w = mount(CharlestonZone, {
      props: {
        charleston: view(),
        myRack: tiles,
        selectedTileIds: new Set<string>(["a"]),
        isComplete: false,
        progressText: "1 of 3 selected",
      },
    });
    expect(w.find("[data-testid='charleston-pass-btn']").attributes("disabled")).toBeDefined();
  });

  it("enables Pass when complete and emits tile ids", async () => {
    const w = mount(CharlestonZone, {
      props: {
        charleston: view(),
        myRack: tiles,
        selectedTileIds: new Set<string>(["a", "b", "c"]),
        isComplete: true,
        progressText: "3 of 3 selected",
      },
    });
    const btn = w.find("[data-testid='charleston-pass-btn']");
    expect(btn.attributes("disabled")).toBeUndefined();
    await btn.trigger("click");
    expect(w.emitted("pass")?.length).toBe(1);
  });

  it("shows blind pass hint and badge", () => {
    const w = mount(CharlestonZone, {
      props: {
        charleston: view({ myHiddenTileCount: 2 }),
        myRack: tiles,
        selectedTileIds: new Set<string>(),
        isComplete: false,
        progressText: "0 of 3 selected",
      },
    });
    expect(w.find("[data-testid='charleston-blind-hint']").text()).toContain(
      "before seeing received tiles",
    );
    expect(w.text()).toContain("2 hidden");
  });

  it("shows waiting state when submission locked", () => {
    const w = mount(CharlestonZone, {
      props: {
        charleston: view({ mySubmissionLocked: true }),
        myRack: tiles,
        selectedTileIds: new Set<string>(),
        isComplete: true,
        progressText: "3 of 3 selected",
      },
    });
    expect(w.find("[data-testid='charleston-waiting']").exists()).toBe(true);
    expect(w.find("[data-testid='charleston-pass-btn']").exists()).toBe(false);
  });
});
