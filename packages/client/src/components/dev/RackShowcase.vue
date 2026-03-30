<script setup lang="ts">
import { ref } from "vue";
import TileRack from "../game/TileRack.vue";
import TileSprite from "../tiles/TileSprite.vue";
import type {
  SuitedTile,
  WindTile,
  DragonTile,
  FlowerTile,
  JokerTile,
  Tile,
} from "@mahjong-game/shared";

// 13-tile hand
const hand13: Tile[] = [
  { id: "dot-7-1", category: "suited", suit: "dot", value: 7, copy: 1 } as SuitedTile,
  { id: "bam-3-2", category: "suited", suit: "bam", value: 3, copy: 2 } as SuitedTile,
  { id: "joker-1", category: "joker", copy: 1 } as JokerTile,
  { id: "crak-5-1", category: "suited", suit: "crak", value: 5, copy: 1 } as SuitedTile,
  { id: "wind-north-1", category: "wind", value: "north", copy: 1 } as WindTile,
  { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 } as SuitedTile,
  { id: "dragon-red-1", category: "dragon", value: "red", copy: 1 } as DragonTile,
  { id: "dot-3-1", category: "suited", suit: "dot", value: 3, copy: 1 } as SuitedTile,
  { id: "crak-9-1", category: "suited", suit: "crak", value: 9, copy: 1 } as SuitedTile,
  { id: "flower-a-1", category: "flower", value: "a", copy: 1 } as FlowerTile,
  { id: "bam-7-1", category: "suited", suit: "bam", value: 7, copy: 1 } as SuitedTile,
  { id: "wind-east-1", category: "wind", value: "east", copy: 1 } as WindTile,
  { id: "dot-1-1", category: "suited", suit: "dot", value: 1, copy: 1 } as SuitedTile,
];

// 14-tile hand (after drawing)
const hand14: Tile[] = [
  ...hand13,
  { id: "dragon-green-1", category: "dragon", value: "green", copy: 1 } as DragonTile,
];

const isPlayerTurn = ref(true);
</script>

<template>
  <TileSprite />
  <div class="p-6 min-h-screen bg-felt-teal text-text-on-felt">
    <h1 class="mb-6 text-6">TileRack Showcase</h1>

    <div class="mb-4">
      <label class="text-4">
        <input v-model="isPlayerTurn" type="checkbox" class="mr-2" />
        Player's turn (interactive)
      </label>
    </div>

    <section class="mb-12">
      <h2 class="mb-3 text-4.5">13-tile hand</h2>
      <TileRack :tiles="hand13" :is-player-turn="isPlayerTurn" />
    </section>

    <section class="mb-12">
      <h2 class="mb-3 text-4.5">14-tile hand (after draw)</h2>
      <TileRack :tiles="hand14" :is-player-turn="isPlayerTurn" />
    </section>

    <section>
      <h2 class="mb-3 text-4.5">Phone scroll test (resize to &lt;375px)</h2>
      <div class="max-w-375px border-2 border-dashed border-white/30 p-2">
        <TileRack :tiles="hand14" :is-player-turn="isPlayerTurn" />
      </div>
    </section>
  </div>
</template>
