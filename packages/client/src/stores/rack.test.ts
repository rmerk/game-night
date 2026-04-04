import { expect, test, beforeEach } from "vite-plus/test";
import { setActivePinia, createPinia } from "pinia";
import type { Tile } from "@mahjong-game/shared";
import { useRackStore } from "./rack";

function tile(id: string): Tile {
  return { id, category: "suited", suit: "dot", value: 1, copy: 1 };
}

beforeEach(() => {
  setActivePinia(createPinia());
});

test("reconcileWithServerRack preserves order for kept tiles and appends new", () => {
  const rack = useRackStore();
  rack.setTileOrder([tile("a"), tile("b"), tile("c")]);
  rack.selectTile("b");
  rack.reconcileWithServerRack([tile("b"), tile("a"), tile("d")]);
  expect(rack.tileOrder).toEqual(["a", "b", "d"]);
  expect(rack.selectedTileId).toBe("b");
});

test("reconcileWithServerRack clears selection when selected tile removed", () => {
  const rack = useRackStore();
  rack.setTileOrder([tile("a"), tile("b")]);
  rack.selectTile("a");
  rack.reconcileWithServerRack([tile("b")]);
  expect(rack.selectedTileId).toBeNull();
});
