import { type Ref } from "vue";
import { makeDraggable, makeDroppable } from "@vue-dnd-kit/core";
import type { IDragEvent } from "@vue-dnd-kit/core";
import type { Tile } from "@mahjong-game/shared";
import { useRackStore } from "../stores/rack";

function isPlainObjectRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function extractOrderedIds(items: unknown[]): string[] | null {
  const ids: string[] = [];
  for (const el of items) {
    if (!isPlainObjectRecord(el) || typeof el.id !== "string") {
      return null;
    }
    ids.push(el.id);
  }
  return ids;
}

/**
 * Interpret DnD sort payloads as a reordering of the current rack.
 * Only the id sequence is trusted; each id must appear exactly once and match the
 * current rack tiles (no fabricated tiles or duplicate/missing ids).
 */
export function asTileArrayFromDnD(items: unknown, rackTiles: Tile[]): Tile[] | null {
  if (!Array.isArray(items)) {
    return null;
  }
  const ids = extractOrderedIds(items);
  if (ids === null) {
    return null;
  }
  if (ids.length !== rackTiles.length) {
    return null;
  }
  const byId = new Map(rackTiles.map((t) => [t.id, t]));
  const canonicalIds = new Set(rackTiles.map((t) => t.id));
  if (canonicalIds.size !== rackTiles.length) {
    return null;
  }
  const seen = new Set<string>();
  for (const id of ids) {
    if (!canonicalIds.has(id) || seen.has(id)) {
      return null;
    }
    seen.add(id);
  }
  return ids.map((id) => byId.get(id)!);
}

export interface RackDraggableResult {
  isDragging: Ref<boolean>;
  isDragOver: Ref<{ top?: boolean; bottom?: boolean; left?: boolean; right?: boolean } | undefined>;
}

export function useRackTileDraggable(
  itemRef: Ref<HTMLElement | null>,
  index: Ref<number>,
  tiles: Ref<Tile[]>,
) {
  const result = makeDraggable(
    itemRef,
    {
      activation: { distance: 10 },
      events: {},
    },
    () => [index.value, tiles.value],
  );

  return {
    isDragging: result.isDragging,
    isDragOver: result.isDragOver,
  };
}

export function useRackDroppable(rackRef: Ref<HTMLElement | null>, tiles: Ref<Tile[]>) {
  const rackStore = useRackStore();

  const result = makeDroppable(
    rackRef,
    {
      events: {
        onDrop: (e: IDragEvent) => {
          const sortResult = e.helpers.suggestSort("horizontal");
          if (sortResult) {
            const sortedTiles = asTileArrayFromDnD(sortResult.sourceItems, tiles.value);
            if (sortedTiles) {
              rackStore.tileOrder = sortedTiles.map((t) => t.id);
            }
          }
        },
      },
    },
    () => tiles.value,
  );

  return {
    isDragOver: result.isDragOver,
  };
}
