<script setup lang="ts">
import { ref } from "vue";
import { setActivePinia, createPinia } from "pinia";
import TileSprite from "../tiles/TileSprite.vue";
import DiscardPool from "../game/DiscardPool.vue";
import DiscardConfirm from "../game/DiscardConfirm.vue";
import GameTable from "../game/GameTable.vue";
import { useRackStore } from "../../stores/rack";
import type { SuitedTile, WindTile, DragonTile, JokerTile, Tile } from "@mahjong-game/shared";

setActivePinia(createPinia());
const rackStore = useRackStore();

// --- Mock tile data ---
function makeSuitedTiles(count: number): Tile[] {
  const suits = ["bam", "crak", "dot"] as const;
  const tiles: Tile[] = [];
  for (let i = 0; i < count; i++) {
    const suit = suits[i % 3];
    const value = ((i % 9) + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
    const copy = Math.floor(i / 9) + 1;
    tiles.push({
      id: `${suit}-${value}-${copy}`,
      category: "suited",
      suit,
      value,
      copy,
    } as SuitedTile);
  }
  return tiles;
}

const emptyPool: Tile[] = [];
const partialPool = makeSuitedTiles(6);
const fullPool = makeSuitedTiles(20);
const singleTile = makeSuitedTiles(1);

// --- Rack tiles for interactive demo ---
const rackTiles: Tile[] = [
  { id: "dot-7-1", category: "suited", suit: "dot", value: 7, copy: 1 } as SuitedTile,
  { id: "bam-3-2", category: "suited", suit: "bam", value: 3, copy: 2 } as SuitedTile,
  { id: "joker-1", category: "joker", copy: 1 } as JokerTile,
  { id: "crak-5-1", category: "suited", suit: "crak", value: 5, copy: 1 } as SuitedTile,
  { id: "wind-north-1", category: "wind", value: "north", copy: 1 } as WindTile,
  { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 } as SuitedTile,
  { id: "dragon-red-1", category: "dragon", value: "red", copy: 1 } as DragonTile,
];

const discardLog = ref<string[]>([]);

function handleDiscard(tileId: string) {
  discardLog.value.push(tileId);
}

// Scenario management
type Scenario = "empty" | "partial" | "full" | "latest-highlight" | "interactive";
const activeScenario = ref<Scenario>("interactive");

const scenarios: { key: Scenario; label: string }[] = [
  { key: "empty", label: "Empty Pool" },
  { key: "partial", label: "6 Tiles (1 Row)" },
  { key: "full", label: "20 Tiles (3+ Rows)" },
  { key: "latest-highlight", label: "Latest Highlight" },
  { key: "interactive", label: "Two-Step Discard" },
];
</script>

<template>
  <TileSprite />
  <div
    class="fixed top-0 left-0 right-0 z-50 bg-chrome-surface-dark/90 p-2 flex gap-2 items-center"
  >
    <span class="text-text-on-felt text-3.5 font-semibold mr-2">Discard Showcase</span>
    <button
      v-for="scenario in scenarios"
      :key="scenario.key"
      class="min-tap px-3 py-1 rounded-md text-3 text-text-on-felt"
      :class="activeScenario === scenario.key ? 'bg-state-success' : 'bg-chrome-surface'"
      @click="activeScenario = scenario.key"
    >
      {{ scenario.label }}
    </button>
  </div>

  <div class="pt-14 p-4 bg-felt-teal min-h-screen">
    <!-- Empty Pool -->
    <div v-if="activeScenario === 'empty'" class="flex flex-col gap-4">
      <h2 class="text-text-on-felt text-5 font-semibold">Empty Discard Pool</h2>
      <DiscardPool :tiles="emptyPool" position="bottom" />
    </div>

    <!-- Partial Pool (1 row) -->
    <div v-if="activeScenario === 'partial'" class="flex flex-col gap-4">
      <h2 class="text-text-on-felt text-5 font-semibold">6 Tiles — 1 Full Row</h2>
      <div class="flex gap-8 flex-wrap">
        <div v-for="pos in ['top', 'bottom', 'left', 'right'] as const" :key="pos">
          <p class="text-text-on-felt/70 text-3.5 mb-1">{{ pos }}</p>
          <DiscardPool :tiles="partialPool" :position="pos" />
        </div>
      </div>
    </div>

    <!-- Full Pool (3+ rows) -->
    <div v-if="activeScenario === 'full'" class="flex flex-col gap-4">
      <h2 class="text-text-on-felt text-5 font-semibold">20 Tiles — 3+ Rows</h2>
      <DiscardPool :tiles="fullPool" position="bottom" />
    </div>

    <!-- Latest Highlight -->
    <div v-if="activeScenario === 'latest-highlight'" class="flex flex-col gap-4">
      <h2 class="text-text-on-felt text-5 font-semibold">Latest Discard Highlight</h2>
      <p class="text-text-on-felt/70 text-3.5">The last tile in the pool pulses gold briefly.</p>
      <DiscardPool :tiles="singleTile" position="bottom" />
      <DiscardPool :tiles="partialPool" position="bottom" />
    </div>

    <!-- Interactive Two-Step Discard -->
    <div v-if="activeScenario === 'interactive'" class="flex flex-col gap-4">
      <h2 class="text-text-on-felt text-5 font-semibold">Two-Step Discard Interaction</h2>
      <p class="text-text-on-felt/70 text-3.5">
        1. Tap a tile to select it. 2. Tap "Discard" to confirm.
      </p>
      <GameTable
        :tiles="rackTiles"
        :is-player-turn="true"
        :discard-pools="{
          top: partialPool,
          bottom: singleTile,
          left: makeSuitedTiles(3),
          right: makeSuitedTiles(4),
        }"
        @discard="handleDiscard"
      />
      <div
        v-if="discardLog.length > 0"
        class="bg-chrome-surface-dark/80 rounded-md p-3 text-text-on-felt text-3.5"
      >
        <p class="font-semibold mb-1">Discard Log:</p>
        <p v-for="(id, i) in discardLog" :key="i">{{ i + 1 }}. {{ id }}</p>
      </div>
    </div>
  </div>
</template>
