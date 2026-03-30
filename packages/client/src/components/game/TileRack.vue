<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import { DnDProvider, makeDraggable, makeDroppable, useDnDProvider } from "@vue-dnd-kit/core";
import type { IDragEvent } from "@vue-dnd-kit/core";
import type { Tile } from "@mahjong-game/shared";
import TileComponent from "../tiles/Tile.vue";
import type { TileState } from "../tiles/Tile.vue";
import { useRackStore } from "../../stores/rack";

const props = withDefaults(
  defineProps<{
    tiles: Tile[];
    isPlayerTurn?: boolean;
  }>(),
  {
    isPlayerTurn: true,
  },
);

const rackStore = useRackStore();

// Initialize tile order from props when tiles change
watch(
  () => props.tiles,
  (newTiles) => {
    if (newTiles.length > 0 && rackStore.tileOrder.length === 0) {
      rackStore.setTileOrder(newTiles);
    }
  },
  { immediate: true },
);

// Ordered tiles based on rack store order
const orderedTiles = computed(() => {
  const tileMap = new Map(props.tiles.map((t) => [t.id, t]));
  return rackStore.tileOrder.map((id) => tileMap.get(id)).filter((t): t is Tile => t !== undefined);
});

function getTileState(tile: Tile): TileState {
  if (!props.isPlayerTurn) return "default";
  if (rackStore.selectedTileId === tile.id) return "selected";
  return "default";
}

function handleTileSelect(tile: Tile) {
  if (!props.isPlayerTurn) return;
  rackStore.selectTile(tile.id);
}

function handleSort() {
  rackStore.sortTiles(props.tiles);
}

// Keyboard navigation within rack
function handleRackKeydown(event: KeyboardEvent) {
  if (!props.isPlayerTurn) return;

  const target = event.target as HTMLElement;
  const items = Array.from(
    target.closest('[role="list"]')?.querySelectorAll('[role="listitem"]') ?? [],
  );
  const currentIndex = items.indexOf(target.closest('[role="listitem"]') as Element);

  if (currentIndex === -1) return;

  if (event.key === "ArrowRight" && currentIndex < items.length - 1) {
    event.preventDefault();
    const nextItem = items[currentIndex + 1] as HTMLElement;
    const focusable = nextItem.querySelector('[tabindex="0"]') as HTMLElement;
    focusable?.focus();
  } else if (event.key === "ArrowLeft" && currentIndex > 0) {
    event.preventDefault();
    const prevItem = items[currentIndex - 1] as HTMLElement;
    const focusable = prevItem.querySelector('[tabindex="0"]') as HTMLElement;
    focusable?.focus();
  }
}

// Drop handler for rack container
const rackRef = useTemplateRef<HTMLElement>("rackRef");

const handleDrop = (e: IDragEvent) => {
  const sortResult = e.helpers.suggestSort("horizontal");
  if (sortResult) {
    rackStore.tileOrder = (sortResult.sourceItems as Tile[]).map((t: Tile) => t.id);
  }
};
</script>

<template>
  <DnDProvider>
    <div class="tile-rack-container">
      <div
        ref="rackRef"
        role="list"
        aria-label="Your tile rack"
        class="tile-rack"
        @keydown="handleRackKeydown"
      >
        <div
          v-for="(tile, index) in orderedTiles"
          :key="tile.id"
          role="listitem"
          class="tile-rack__item"
        >
          <TileComponent
            :tile="tile"
            :state="getTileState(tile)"
            :interactive="isPlayerTurn"
            size="standard"
            @select="handleTileSelect"
          />
        </div>
      </div>
      <button
        type="button"
        class="tile-rack__sort-btn"
        :disabled="!isPlayerTurn"
        aria-label="Sort tiles by suit"
        @click="handleSort"
      >
        Sort
      </button>
    </div>
  </DnDProvider>
</template>

<style scoped>
.tile-rack-container {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.tile-rack {
  display: flex;
  flex-direction: row;
  gap: 4px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  padding: 4px 0;
}

.tile-rack::-webkit-scrollbar {
  display: none;
}

.tile-rack__item {
  flex-shrink: 0;
  min-width: 30px;
}

.tile-rack__sort-btn {
  min-height: 44px;
  min-width: 44px;
  padding: 8px 12px;
  border: 1px solid var(--chrome-border);
  border-radius: 8px;
  background: var(--chrome-surface);
  color: var(--text-primary);
  font-size: 18px;
  font-weight: 600;
  cursor: pointer;
  flex-shrink: 0;
  transition:
    background var(--timing-tactile) var(--ease-tactile),
    border-color var(--timing-tactile) var(--ease-tactile);
}

.tile-rack__sort-btn:hover:not(:disabled) {
  background: var(--chrome-elevated);
}

.tile-rack__sort-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.tile-rack__sort-btn:focus-visible {
  outline: 2px solid var(--focus-ring-on-felt);
  outline-offset: 2px;
}

/* TransitionGroup for smooth reordering */
.rack-move {
  transition: transform var(--timing-tactile) var(--ease-tactile);
}
</style>
