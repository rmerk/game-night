import { describe, it, expect } from "vite-plus/test";
import { ref } from "vue";
import { useTileSelection } from "./useTileSelection";

describe("useTileSelection", () => {
  it("toggles select and deselect", () => {
    const target = ref(3);
    const sel = useTileSelection(target);
    sel.toggleTile("a");
    sel.toggleTile("b");
    expect(sel.selectedIds.value.has("a")).toBe(true);
    expect(sel.selectedIds.value.has("b")).toBe(true);
    sel.toggleTile("a");
    expect(sel.selectedIds.value.has("a")).toBe(false);
    expect(sel.progressText.value).toBe("1 of 3 selected");
  });

  it("updates progress text as selection grows", () => {
    const sel = useTileSelection(2);
    expect(sel.progressText.value).toBe("0 of 2 selected");
    sel.toggleTile("x");
    expect(sel.progressText.value).toBe("1 of 2 selected");
    sel.toggleTile("y");
    expect(sel.progressText.value).toBe("2 of 2 selected");
    expect(sel.isComplete.value).toBe(true);
  });

  it("ignores toggle when at max and tile is not selected", () => {
    const sel = useTileSelection(2);
    sel.toggleTile("a");
    sel.toggleTile("b");
    sel.toggleTile("c");
    expect(sel.selectedIds.value.has("c")).toBe(false);
    expect(sel.selectedIds.value.size).toBe(2);
  });

  it("reset clears state", () => {
    const sel = useTileSelection(3);
    sel.toggleTile("a");
    sel.reset();
    expect(sel.selectedIds.value.size).toBe(0);
    expect(sel.confirmedIds.value).toEqual([]);
  });

  it("target count zero completes immediately with empty confirmedIds", () => {
    const sel = useTileSelection(0);
    expect(sel.isComplete.value).toBe(true);
    sel.toggleTile("nope");
    expect(sel.selectedIds.value.size).toBe(0);
    expect(sel.confirmedIds.value).toEqual([]);
  });

  it("confirmedIds is populated only when complete", () => {
    const sel = useTileSelection(2);
    sel.toggleTile("p");
    expect(sel.confirmedIds.value).toEqual([]);
    sel.toggleTile("q");
    expect(sel.confirmedIds.value).toEqual(["p", "q"]);
  });

  it("reacts to targetCount ref changes", () => {
    const target = ref(3);
    const sel = useTileSelection(target);
    sel.toggleTile("a");
    sel.toggleTile("b");
    sel.toggleTile("c");
    expect(sel.isComplete.value).toBe(true);
    target.value = 4;
    expect(sel.isComplete.value).toBe(false);
    expect(sel.progressText.value).toBe("3 of 4 selected");
  });
});
