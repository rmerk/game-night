<script setup lang="ts">
import { ref } from "vue";
import Tile from "../tiles/Tile.vue";
import type { TileSize, TileState } from "../tiles/Tile.vue";
import TileBack from "../tiles/TileBack.vue";
import TileSprite from "../tiles/TileSprite.vue";
import type {
  SuitedTile,
  WindTile,
  DragonTile,
  FlowerTile,
  JokerTile,
  Tile as TileType,
} from "@mahjong-game/shared";

// Build all unique tile faces for display
function suited(
  suit: "bam" | "crak" | "dot",
  value: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
): SuitedTile {
  return { id: `${suit}-${value}-1`, category: "suited", suit, value, copy: 1 };
}

function wind(value: "north" | "east" | "west" | "south"): WindTile {
  return { id: `wind-${value}-1`, category: "wind", value, copy: 1 };
}

function dragon(value: "red" | "green" | "soap"): DragonTile {
  return { id: `dragon-${value}-1`, category: "dragon", value, copy: 1 };
}

function flower(value: "a" | "b"): FlowerTile {
  return { id: `flower-${value}-1`, category: "flower", value, copy: 1 };
}

const jokerTile: JokerTile = { id: "joker-1", category: "joker", copy: 1 };

const bams = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((v) => suited("bam", v));
const craks = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((v) => suited("crak", v));
const dots = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map((v) => suited("dot", v));
const winds = (["north", "east", "west", "south"] as const).map(wind);
const dragons = (["red", "green", "soap"] as const).map(dragon);
const flowers = (["a", "b"] as const).map(flower);

const sizes: TileSize[] = ["standard", "small", "celebration"];
const states: TileState[] = ["default", "hover", "selected", "disabled", "face-down"];

const activeSize = ref<TileSize>("standard");
const sampleTile: TileType = suited("bam", 3);
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

    <!-- 30px Minimum Width Readability Validation -->
    <section class="mb-8 p-4 bg-felt-teal rounded-lg">
      <h2 class="text-interactive mb-3 text-text-on-felt">
        30px Readability Validation (tile-min-width)
      </h2>
      <p class="text-secondary mb-4 text-text-on-felt">
        All tiles at 30px minimum width — validate readability for 40-70+ demographic.
      </p>
      <div class="flex flex-wrap gap-1">
        <Tile
          v-for="t in [...bams, ...craks, ...dots, ...winds, ...dragons, ...flowers, jokerTile]"
          :key="'small-' + t.id"
          :tile="t"
          size="small"
          :interactive="false"
        />
        <TileBack size="small" />
      </div>
    </section>
  </div>
</template>
