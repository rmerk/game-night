import { describe, it, expect } from "vite-plus/test";
import type { SuitedTile, Tile } from "@mahjong-game/shared";
import { asTileArrayFromDnD } from "./useRackDragDrop";

// Vue DnD Kit composables (makeDraggable/makeDroppable) require DnDProvider context
// and real DOM interaction to test meaningfully. Unit testing the composable wrappers
// in isolation with happy-dom would require extensive mocking that wouldn't provide
// meaningful coverage. The drag-drop behavior is verified via:
// 1. The RackShowcase dev page for manual visual verification
// 2. E2E tests (Playwright) when those are added
//
// This file tests module exports and asTileArrayFromDnD permutation logic.

const a: SuitedTile = { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 };
const b: SuitedTile = { id: "bam-3-2", category: "suited", suit: "bam", value: 3, copy: 2 };
const rack: Tile[] = [a, b];

describe("useRackDragDrop — module exports", () => {
  it("exports useRackTileDraggable", async () => {
    const mod = await import("./useRackDragDrop");
    expect(mod.useRackTileDraggable).toBeDefined();
    expect(typeof mod.useRackTileDraggable).toBe("function");
  });

  it("exports useRackDroppable", async () => {
    const mod = await import("./useRackDragDrop");
    expect(mod.useRackDroppable).toBeDefined();
    expect(typeof mod.useRackDroppable).toBe("function");
  });
});

describe("asTileArrayFromDnD", () => {
  it("returns null for non-array items", () => {
    expect(asTileArrayFromDnD({}, rack)).toBeNull();
    expect(asTileArrayFromDnD("x", rack)).toBeNull();
  });

  it("returns null when an element lacks a string id", () => {
    expect(asTileArrayFromDnD([{ id: 1 }], rack)).toBeNull();
    expect(asTileArrayFromDnD([{}], rack)).toBeNull();
  });

  it("returns null when length does not match rack", () => {
    expect(asTileArrayFromDnD([{ id: a.id }], rack)).toBeNull();
    expect(asTileArrayFromDnD([{ id: a.id }, { id: b.id }, { id: "extra" }], rack)).toBeNull();
  });

  it("returns null on duplicate ids in payload", () => {
    expect(asTileArrayFromDnD([{ id: a.id }, { id: a.id }], rack)).toBeNull();
  });

  it("returns null when payload references unknown id", () => {
    expect(asTileArrayFromDnD([{ id: a.id }, { id: "unknown" }], rack)).toBeNull();
  });

  it("returns null when rack has duplicate tile ids", () => {
    const dupRack: Tile[] = [a, a];
    expect(asTileArrayFromDnD([{ id: a.id }, { id: a.id }], dupRack)).toBeNull();
  });

  it("returns reordered tiles matching payload id order", () => {
    expect(asTileArrayFromDnD([{ id: b.id }, { id: a.id }], rack)).toEqual([b, a]);
    expect(asTileArrayFromDnD([{ id: a.id }, { id: b.id }], rack)).toEqual([a, b]);
  });

  it("accepts minimal plain objects with id only", () => {
    const minimal = [{ id: b.id, extra: true }, { id: a.id }];
    expect(asTileArrayFromDnD(minimal, rack)).toEqual([b, a]);
  });

  it("returns empty array for empty rack and empty payload", () => {
    expect(asTileArrayFromDnD([], [])).toEqual([]);
  });
});
