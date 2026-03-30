<script setup lang="ts">
import { computed } from "vue";
import TileComponent from "../tiles/Tile.vue";
import type { Tile } from "@mahjong-game/shared";

export type SeatPosition = "top" | "bottom" | "left" | "right";

const TILES_PER_ROW = 6;

const props = defineProps<{
  tiles: Tile[];
  position: SeatPosition;
}>();

const rows = computed(() => {
  const result: Tile[][] = [];
  for (let i = 0; i < props.tiles.length; i += TILES_PER_ROW) {
    result.push(props.tiles.slice(i, i + TILES_PER_ROW));
  }
  return result;
});

const lastTileId = computed(() => {
  if (props.tiles.length === 0) return null;
  return props.tiles[props.tiles.length - 1].id;
});
</script>

<template>
  <div
    data-testid="discard-pool"
    class="discard-pool flex flex-col gap-0.5"
    :class="`discard-pool--${position}`"
    :aria-label="`${position} player discard pool`"
    role="region"
  >
    <div
      v-for="(row, rowIndex) in rows"
      :key="rowIndex"
      data-testid="discard-row"
      class="flex gap-0.5"
    >
      <div
        v-for="tile in row"
        :key="tile.id"
        data-testid="discard-tile"
        class="discard-tile"
        :class="{ 'latest-discard': tile.id === lastTileId }"
      >
        <TileComponent :tile="tile" size="small" state="default" :interactive="false" />
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes discard-pulse {
  0% {
    box-shadow:
      0 2px 4px rgba(107, 97, 88, 0.15),
      0 0 0 0 rgba(196, 163, 90, 0.6);
  }
  50% {
    box-shadow:
      0 2px 4px rgba(107, 97, 88, 0.15),
      0 0 8px 3px rgba(196, 163, 90, 0.4);
  }
  100% {
    box-shadow:
      0 2px 4px rgba(107, 97, 88, 0.15),
      0 0 0 0 rgba(196, 163, 90, 0);
  }
}

.latest-discard :deep(.tile) {
  animation: discard-pulse 600ms var(--ease-expressive, ease-out) 1;
}

@media (prefers-reduced-motion: reduce) {
  .latest-discard :deep(.tile) {
    animation: none;
    opacity: 0.9;
  }
}

/* Responsive: compress on small viewports */
.discard-pool {
  max-width: 200px;
}

@media (min-width: 768px) {
  .discard-pool {
    max-width: none;
  }
}
</style>
