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
  <div style="padding: 24px; background: #2a6b6b; min-height: 100vh; color: #e8e0d4">
    <h1 style="margin-bottom: 24px; font-size: 24px">TileRack Showcase</h1>

    <div style="margin-bottom: 16px">
      <label style="font-size: 16px">
        <input v-model="isPlayerTurn" type="checkbox" style="margin-right: 8px" />
        Player's turn (interactive)
      </label>
    </div>

    <section style="margin-bottom: 48px">
      <h2 style="margin-bottom: 12px; font-size: 18px">13-tile hand</h2>
      <TileRack :tiles="hand13" :is-player-turn="isPlayerTurn" />
    </section>

    <section style="margin-bottom: 48px">
      <h2 style="margin-bottom: 12px; font-size: 18px">14-tile hand (after draw)</h2>
      <TileRack :tiles="hand14" :is-player-turn="isPlayerTurn" />
    </section>

    <section>
      <h2 style="margin-bottom: 12px; font-size: 18px">Phone scroll test (resize to &lt;375px)</h2>
      <div style="max-width: 375px; border: 2px dashed rgba(255, 255, 255, 0.3); padding: 8px">
        <TileRack :tiles="hand14" :is-player-turn="isPlayerTurn" />
      </div>
    </section>
  </div>
</template>
