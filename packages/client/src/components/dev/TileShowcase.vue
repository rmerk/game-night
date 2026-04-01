<script setup lang="ts">
import { shallowRef } from "vue";
import Tile from "../tiles/Tile.vue";
import type { TileSize, TileState } from "../tiles/Tile.vue";
import TileBack from "../tiles/TileBack.vue";
import TileSprite from "../tiles/TileSprite.vue";
import type { SuitedTile, WindTile, DragonTile, FlowerTile, JokerTile } from "@mahjong-game/shared";
import { createAllTiles } from "@mahjong-game/shared";
import { TILE_MIN_WIDTH_CSS } from "../tiles/tile-sizing";

const allTiles = createAllTiles();
const uniqueTiles = allTiles.filter((tile) => tile.copy === 1);

const bams = uniqueTiles.filter(
  (tile): tile is SuitedTile => tile.category === "suited" && tile.suit === "bam",
);
const craks = uniqueTiles.filter(
  (tile): tile is SuitedTile => tile.category === "suited" && tile.suit === "crak",
);
const dots = uniqueTiles.filter(
  (tile): tile is SuitedTile => tile.category === "suited" && tile.suit === "dot",
);
const winds = uniqueTiles.filter((tile): tile is WindTile => tile.category === "wind");
const dragons = uniqueTiles.filter((tile): tile is DragonTile => tile.category === "dragon");
const flowers = uniqueTiles.filter((tile): tile is FlowerTile => tile.category === "flower");
const jokerTile =
  uniqueTiles.find((tile): tile is JokerTile => tile.category === "joker") ??
  ({ id: "joker-1", category: "joker", copy: 1 } as JokerTile);

const sizes: TileSize[] = ["standard", "small", "celebration"];
const states: TileState[] = ["default", "hover", "selected", "disabled", "face-down"];

const activeSize = shallowRef<TileSize>("standard");
const sampleTile =
  allTiles.find(
    (tile): tile is SuitedTile =>
      tile.category === "suited" && tile.suit === "bam" && tile.value === 3,
  ) ?? bams[2]!;
</script>

<template>
  <TileSprite />
  <div class="p-6 max-w-screen-xl mx-auto">
    <h1 class="text-game-critical mb-6">Tile Showcase</h1>
    <p class="text-body mb-8 text-text-secondary">
      All 34 unique tile faces + joker + tile back. Visual verification for story 5A.2.
    </p>

    <!-- Size selector -->
    <section class="mb-8">
      <h2 class="text-interactive mb-3">Display Size</h2>
      <div class="flex gap-3">
        <button
          v-for="s in sizes"
          :key="s"
          class="px-4 py-2 rounded-md text-body border border-chrome-border"
          :class="activeSize === s ? 'bg-gold-accent text-white' : 'bg-chrome-surface'"
          @click="activeSize = s"
        >
          {{ s }}
        </button>
      </div>
    </section>

    <!-- Bamboo -->
    <section class="mb-8">
      <h2 class="text-interactive mb-3" style="color: #2d8b46">Bamboo (Bam)</h2>
      <div class="flex flex-wrap gap-2">
        <Tile v-for="t in bams" :key="t.id" :tile="t" :size="activeSize" :interactive="false" />
      </div>
    </section>

    <!-- Cracks -->
    <section class="mb-8">
      <h2 class="text-interactive mb-3" style="color: #c23b22">Cracks (Crak)</h2>
      <div class="flex flex-wrap gap-2">
        <Tile v-for="t in craks" :key="t.id" :tile="t" :size="activeSize" :interactive="false" />
      </div>
    </section>

    <!-- Dots -->
    <section class="mb-8">
      <h2 class="text-interactive mb-3" style="color: #2e5fa1">Dots</h2>
      <div class="flex flex-wrap gap-2">
        <Tile v-for="t in dots" :key="t.id" :tile="t" :size="activeSize" :interactive="false" />
      </div>
    </section>

    <!-- Winds -->
    <section class="mb-8">
      <h2 class="text-interactive mb-3">Winds</h2>
      <div class="flex flex-wrap gap-2">
        <Tile v-for="t in winds" :key="t.id" :tile="t" :size="activeSize" :interactive="false" />
      </div>
    </section>

    <!-- Dragons -->
    <section class="mb-8">
      <h2 class="text-interactive mb-3">Dragons</h2>
      <div class="flex flex-wrap gap-2">
        <Tile v-for="t in dragons" :key="t.id" :tile="t" :size="activeSize" :interactive="false" />
      </div>
    </section>

    <!-- Flowers -->
    <section class="mb-8">
      <h2 class="text-interactive mb-3">Flowers</h2>
      <div class="flex flex-wrap gap-2">
        <Tile v-for="t in flowers" :key="t.id" :tile="t" :size="activeSize" :interactive="false" />
      </div>
    </section>

    <!-- Joker -->
    <section class="mb-8">
      <h2 class="text-interactive mb-3">Joker</h2>
      <div class="flex flex-wrap gap-2">
        <Tile :tile="jokerTile" :size="activeSize" :interactive="false" />
      </div>
    </section>

    <!-- Tile Back -->
    <section class="mb-8">
      <h2 class="text-interactive mb-3">Tile Back</h2>
      <div class="flex flex-wrap gap-2">
        <TileBack :size="activeSize" />
      </div>
    </section>

    <!-- Tile States -->
    <section class="mb-8">
      <h2 class="text-interactive mb-3">Tile States</h2>
      <div class="flex flex-wrap gap-4 items-end">
        <div v-for="st in states" :key="st" class="flex flex-col items-center gap-2">
          <Tile
            :tile="sampleTile"
            :size="activeSize"
            :state="st"
            :interactive="st !== 'disabled'"
          />
          <span class="text-secondary">{{ st }}</span>
        </div>
      </div>
    </section>

    <!-- Full-Wall Minimum Width Readability Validation -->
    <section class="mb-8 p-4 bg-felt-teal rounded-lg">
      <h2 class="text-interactive mb-3 text-text-on-felt">
        {{ TILE_MIN_WIDTH_CSS }} Readability Validation (tile-min-width)
      </h2>
      <p class="text-secondary mb-4 text-text-on-felt">
        Full 152-tile wall at {{ TILE_MIN_WIDTH_CSS }} minimum width for the arm's-length
        readability check.
      </p>
      <div class="flex flex-wrap gap-1">
        <Tile
          v-for="t in allTiles"
          :key="'wall-' + t.id"
          :tile="t"
          size="small"
          :interactive="false"
        />
      </div>
    </section>
  </div>
</template>
