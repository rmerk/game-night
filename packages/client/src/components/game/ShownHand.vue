<script setup lang="ts">
import type { Tile } from "@mahjong-game/shared";
import TileFace from "../tiles/Tile.vue";
import { TILE_MIN_WIDTH_PX } from "../tiles/tile-sizing";

defineProps<{
  tiles: Tile[];
  playerName: string;
  position: "top" | "left" | "right" | "local";
}>();
</script>

<template>
  <div
    class="shown-hand flex max-w-full flex-col gap-1"
    :data-testid="`shown-hand-${position}`"
    :data-player-label="playerName"
  >
    <p class="max-w-full truncate text-center text-2.5 text-text-on-felt/80">{{ playerName }}</p>
    <div
      v-if="tiles.length > 0"
      data-testid="shown-hand-tiles"
      class="flex max-w-full flex-wrap justify-center gap-0.5 overflow-x-auto pb-1"
      :style="{ minWidth: `${TILE_MIN_WIDTH_PX}px` }"
    >
      <TileFace
        v-for="tile in tiles"
        :key="tile.id"
        :tile="tile"
        size="small"
        state="default"
        :interactive="false"
      />
    </div>
  </div>
</template>
