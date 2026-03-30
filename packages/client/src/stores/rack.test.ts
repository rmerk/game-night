import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useRackStore } from "./rack";
import type {
  SuitedTile,
  WindTile,
  DragonTile,
  FlowerTile,
  JokerTile,
  Tile,
} from "@mahjong-game/shared";

// --- Test tile fixtures ---
const bam1: SuitedTile = { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 };
const bam3: SuitedTile = { id: "bam-3-2", category: "suited", suit: "bam", value: 3, copy: 2 };
const bam9: SuitedTile = { id: "bam-9-1", category: "suited", suit: "bam", value: 9, copy: 1 };
const crak2: SuitedTile = { id: "crak-2-1", category: "suited", suit: "crak", value: 2, copy: 1 };
const crak7: SuitedTile = { id: "crak-7-1", category: "suited", suit: "crak", value: 7, copy: 1 };
const dot1: SuitedTile = { id: "dot-1-1", category: "suited", suit: "dot", value: 1, copy: 1 };
const dot5: SuitedTile = { id: "dot-5-3", category: "suited", suit: "dot", value: 5, copy: 3 };
const windNorth: WindTile = { id: "wind-north-1", category: "wind", value: "north", copy: 1 };
const windEast: WindTile = { id: "wind-east-1", category: "wind", value: "east", copy: 1 };
const windWest: WindTile = { id: "wind-west-1", category: "wind", value: "west", copy: 1 };
const windSouth: WindTile = { id: "wind-south-1", category: "wind", value: "south", copy: 1 };
const dragonRed: DragonTile = { id: "dragon-red-1", category: "dragon", value: "red", copy: 1 };
const dragonGreen: DragonTile = {
  id: "dragon-green-1",
  category: "dragon",
  value: "green",
  copy: 1,
};
const dragonSoap: DragonTile = { id: "dragon-soap-1", category: "dragon", value: "soap", copy: 1 };
const flowerA: FlowerTile = { id: "flower-a-1", category: "flower", value: "a", copy: 1 };
const flowerB: FlowerTile = { id: "flower-b-1", category: "flower", value: "b", copy: 1 };
const joker1: JokerTile = { id: "joker-1", category: "joker", copy: 1 };
const joker2: JokerTile = { id: "joker-2", category: "joker", copy: 2 };

beforeEach(() => {
  setActivePinia(createPinia());
});

describe("useRackStore — initial state", () => {
  it("starts with empty tile order", () => {
    const store = useRackStore();
    expect(store.tileOrder).toEqual([]);
  });

  it("starts with no selection", () => {
    const store = useRackStore();
    expect(store.selectedTileId).toBeNull();
  });
});

describe("useRackStore — setTileOrder", () => {
  it("sets tile order from tile array", () => {
    const store = useRackStore();
    store.setTileOrder([bam3, crak7, dot1]);
    expect(store.tileOrder).toEqual(["bam-3-2", "crak-7-1", "dot-1-1"]);
  });
});

describe("useRackStore — reorderTile", () => {
  it("moves tile from one position to another", () => {
    const store = useRackStore();
    store.setTileOrder([bam1, bam3, crak2]);
    store.reorderTile(0, 2);
    expect(store.tileOrder).toEqual(["bam-3-2", "crak-2-1", "bam-1-1"]);
  });

  it("moves tile backward", () => {
    const store = useRackStore();
    store.setTileOrder([bam1, bam3, crak2]);
    store.reorderTile(2, 0);
    expect(store.tileOrder).toEqual(["crak-2-1", "bam-1-1", "bam-3-2"]);
  });

  it("no-op when from equals to", () => {
    const store = useRackStore();
    store.setTileOrder([bam1, bam3, crak2]);
    store.reorderTile(1, 1);
    expect(store.tileOrder).toEqual(["bam-1-1", "bam-3-2", "crak-2-1"]);
  });
});

describe("useRackStore — selectTile / deselectTile", () => {
  it("selects a tile by ID", () => {
    const store = useRackStore();
    store.selectTile("bam-3-2");
    expect(store.selectedTileId).toBe("bam-3-2");
  });

  it("deselects when selecting the same tile", () => {
    const store = useRackStore();
    store.selectTile("bam-3-2");
    store.selectTile("bam-3-2");
    expect(store.selectedTileId).toBeNull();
  });

  it("switches selection to a different tile", () => {
    const store = useRackStore();
    store.selectTile("bam-3-2");
    store.selectTile("crak-7-1");
    expect(store.selectedTileId).toBe("crak-7-1");
  });

  it("deselects explicitly", () => {
    const store = useRackStore();
    store.selectTile("bam-3-2");
    store.deselectTile();
    expect(store.selectedTileId).toBeNull();
  });
});

describe("useRackStore — sortTiles", () => {
  it("sorts by suit order: Bam → Crak → Dot", () => {
    const tiles: Tile[] = [dot5, crak2, bam3];
    const store = useRackStore();
    store.setTileOrder(tiles);
    store.sortTiles(tiles);
    expect(store.tileOrder).toEqual(["bam-3-2", "crak-2-1", "dot-5-3"]);
  });

  it("sorts by number within suit", () => {
    const tiles: Tile[] = [bam9, bam1, bam3];
    const store = useRackStore();
    store.setTileOrder(tiles);
    store.sortTiles(tiles);
    expect(store.tileOrder).toEqual(["bam-1-1", "bam-3-2", "bam-9-1"]);
  });

  it("places winds after suited tiles in N/E/W/S order", () => {
    const tiles: Tile[] = [windSouth, bam1, windNorth, windWest, windEast];
    const store = useRackStore();
    store.setTileOrder(tiles);
    store.sortTiles(tiles);
    expect(store.tileOrder).toEqual([
      "bam-1-1",
      "wind-north-1",
      "wind-east-1",
      "wind-west-1",
      "wind-south-1",
    ]);
  });

  it("places dragons after winds in Red/Green/Soap order", () => {
    const tiles: Tile[] = [dragonSoap, dragonRed, windNorth, dragonGreen];
    const store = useRackStore();
    store.setTileOrder(tiles);
    store.sortTiles(tiles);
    expect(store.tileOrder).toEqual([
      "wind-north-1",
      "dragon-red-1",
      "dragon-green-1",
      "dragon-soap-1",
    ]);
  });

  it("places flowers after dragons", () => {
    const tiles: Tile[] = [flowerB, dragonRed, flowerA];
    const store = useRackStore();
    store.setTileOrder(tiles);
    store.sortTiles(tiles);
    expect(store.tileOrder).toEqual(["dragon-red-1", "flower-a-1", "flower-b-1"]);
  });

  it("places jokers last", () => {
    const tiles: Tile[] = [joker1, bam1, joker2, flowerA];
    const store = useRackStore();
    store.setTileOrder(tiles);
    store.sortTiles(tiles);
    expect(store.tileOrder).toEqual(["bam-1-1", "flower-a-1", "joker-1", "joker-2"]);
  });

  it("sorts a full mixed hand correctly", () => {
    const tiles: Tile[] = [
      joker1,
      windEast,
      dot5,
      bam9,
      dragonGreen,
      crak2,
      flowerA,
      bam1,
      windNorth,
      crak7,
      dragonRed,
      dot1,
      bam3,
    ];
    const store = useRackStore();
    store.setTileOrder(tiles);
    store.sortTiles(tiles);
    expect(store.tileOrder).toEqual([
      "bam-1-1",
      "bam-3-2",
      "bam-9-1",
      "crak-2-1",
      "crak-7-1",
      "dot-1-1",
      "dot-5-3",
      "wind-north-1",
      "wind-east-1",
      "dragon-red-1",
      "dragon-green-1",
      "flower-a-1",
      "joker-1",
    ]);
  });
});
