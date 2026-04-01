<script setup lang="ts">
import { ref, computed } from "vue";
import type { Tile } from "@mahjong-game/shared";
import TileComponent from "../tiles/Tile.vue";
import type { TileState } from "../tiles/Tile.vue";
import { useRackTileDraggable } from "../../composables/useRackDragDrop";

const props = defineProps<{
  tile: Tile;
  index: number;
  tiles: Tile[];
  isPlayerTurn: boolean;
  state: TileState;
  tabIndex?: number;
}>();

defineEmits<{
  select: [tile: Tile];
}>();

const itemRef = ref<HTMLElement | null>(null);
const indexRef = computed(() => props.index);
const tilesRef = computed(() => props.tiles);

const { isDragging } = useRackTileDraggable(itemRef, indexRef, tilesRef);
</script>

<template>
  <div
    ref="itemRef"
    role="listitem"
    class="tile-rack__item"
    :class="{ 'tile-rack__item--dragging': isDragging }"
    :style="{ pointerEvents: isPlayerTurn ? undefined : 'none' }"
  >
    <TileComponent
      :tile="tile"
      :state="state"
      :interactive="isPlayerTurn"
      :tab-index="tabIndex"
      size="standard"
      @select="$emit('select', tile)"
    />
  </div>
</template>

<style scoped>
.tile-rack__item {
  flex-shrink: 0;
  min-width: 30px;
}

.tile-rack__item--dragging {
  opacity: 0.5;
}
</style>
