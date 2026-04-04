import { ref } from "vue";
import { defineStore } from "pinia";
import type { Tile, TileSuit, WindValue, DragonValue } from "@mahjong-game/shared";

const SUIT_ORDER: Record<TileSuit, number> = { bam: 0, crak: 1, dot: 2 };
const WIND_ORDER: Record<WindValue, number> = { north: 0, east: 1, west: 2, south: 3 };
const DRAGON_ORDER: Record<DragonValue, number> = { red: 0, green: 1, soap: 2 };
const CATEGORY_ORDER: Record<string, number> = {
  suited: 0,
  wind: 1,
  dragon: 2,
  flower: 3,
  joker: 4,
};

function tileSortKey(tile: Tile): number {
  const catBase = CATEGORY_ORDER[tile.category] * 10000;

  switch (tile.category) {
    case "suited":
      return catBase + SUIT_ORDER[tile.suit] * 100 + tile.value;
    case "wind":
      return catBase + WIND_ORDER[tile.value];
    case "dragon":
      return catBase + DRAGON_ORDER[tile.value];
    case "flower":
      return catBase + (tile.value === "a" ? 0 : 1);
    case "joker":
      return catBase + tile.copy;
  }
}

export const useRackStore = defineStore("rack", () => {
  const tileOrder = ref<string[]>([]);
  const selectedTileId = ref<string | null>(null);

  function setTileOrder(tiles: Tile[]) {
    tileOrder.value = tiles.map((t) => t.id);
  }

  function reorderTile(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    const order = [...tileOrder.value];
    const [moved] = order.splice(fromIndex, 1);
    order.splice(toIndex, 0, moved);
    tileOrder.value = order;
  }

  function sortTiles(tiles: Tile[]) {
    const tileMap = new Map(tiles.map((t) => [t.id, t]));
    const sorted = [...tileOrder.value]
      .filter((id) => tileMap.has(id))
      .sort((a, b) => tileSortKey(tileMap.get(a)!) - tileSortKey(tileMap.get(b)!));
    tileOrder.value = sorted;
  }

  function selectTile(tileId: string) {
    selectedTileId.value = selectedTileId.value === tileId ? null : tileId;
  }

  function deselectTile() {
    selectedTileId.value = null;
  }

  /** Merge server rack tiles with existing drag order (Story 3C.8). */
  function reconcileWithServerRack(tiles: Tile[]) {
    const ids = new Set(tiles.map((t) => t.id));
    const prev = tileOrder.value;
    const next: string[] = [];
    const seen = new Set<string>();
    for (const id of prev) {
      if (ids.has(id)) {
        next.push(id);
        seen.add(id);
      }
    }
    for (const t of tiles) {
      if (!seen.has(t.id)) {
        next.push(t.id);
        seen.add(t.id);
      }
    }
    tileOrder.value = next;
    const sid = selectedTileId.value;
    if (sid !== null && !ids.has(sid)) {
      selectedTileId.value = null;
    }
  }

  return {
    tileOrder,
    selectedTileId,
    setTileOrder,
    reorderTile,
    sortTiles,
    selectTile,
    deselectTile,
    reconcileWithServerRack,
  };
});
