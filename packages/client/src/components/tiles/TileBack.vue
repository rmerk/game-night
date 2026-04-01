<script setup lang="ts">
import { computed } from "vue";
import type { TileSize } from "./Tile.vue";
import { getTileSizeStyle } from "./tile-sizing";

const props = withDefaults(
  defineProps<{
    size?: TileSize;
  }>(),
  {
    size: "standard",
  },
);

const tileSizeStyle = computed(() => getTileSizeStyle(props.size));
</script>

<template>
  <div
    class="tile-back"
    :class="`tile-back--size-${size}`"
    :style="tileSizeStyle"
    role="img"
    aria-label="Face-down tile"
  >
    <svg
      class="tile-back__face"
      viewBox="0 0 60 80"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <use href="#tile-back" />
    </svg>
  </div>
</template>

<style scoped>
.tile-back {
  position: relative;
  border-radius: 12px;
  box-shadow:
    0 2px 4px rgba(107, 97, 88, 0.15),
    0 1px 2px rgba(107, 97, 88, 0.1);
  flex-shrink: 0;
  user-select: none;
  overflow: hidden;
}

.tile-back__face {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
