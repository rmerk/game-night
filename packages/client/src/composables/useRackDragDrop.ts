import { type Ref } from "vue";
import { makeDraggable, makeDroppable } from "@vue-dnd-kit/core";
import type { IDragEvent } from "@vue-dnd-kit/core";
import type { Tile } from "@mahjong-game/shared";
import { useRackStore } from "../stores/rack";

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
            rackStore.tileOrder = (sortResult.sourceItems as Tile[]).map((t) => t.id);
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
