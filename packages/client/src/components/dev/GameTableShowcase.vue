<script setup lang="ts">
import { ref } from "vue";
import GameTable from "../game/GameTable.vue";
import type { LocalPlayerSummary, OpponentPlayer } from "../game/seat-types";
import TileSprite from "../tiles/TileSprite.vue";
import type {
  SuitedTile,
  WindTile,
  DragonTile,
  FlowerTile,
  JokerTile,
  Tile,
} from "@mahjong-game/shared";

const mockTiles: Tile[] = [
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

const fourPlayers = {
  top: {
    id: "player-north",
    name: "Alice",
    initial: "A",
    connected: true,
    seatWind: "north",
    score: 30,
  },
  left: {
    id: "player-west",
    name: "Bob",
    initial: "B",
    connected: true,
    seatWind: "west",
    score: -5,
  },
  right: {
    id: "player-east",
    name: "Carol",
    initial: "C",
    connected: false,
    seatWind: "east",
    score: -25,
  },
} satisfies { top: OpponentPlayer; left: OpponentPlayer | null; right: OpponentPlayer | null };

const threePlayers = {
  top: {
    id: "player-north",
    name: "Alice",
    initial: "A",
    connected: true,
    seatWind: "north",
    score: 30,
  },
  left: null,
  right: {
    id: "player-east",
    name: "Carol",
    initial: "C",
    connected: true,
    seatWind: "east",
    score: -25,
  },
} satisfies { top: OpponentPlayer; left: OpponentPlayer | null; right: OpponentPlayer | null };

const localPlayer: LocalPlayerSummary = {
  id: "player-south",
  name: "You",
  seatWind: "south",
  score: 25,
};

type Scenario = "4-players" | "3-players";
const activeScenario = ref<Scenario>("4-players");
/** Dev-only: drive SocialOverridePanel table-talk trigger + modal (Playwright / manual QA). */
const tableTalkEligible = ref(false);

const scenarios: { key: Scenario; label: string }[] = [
  { key: "4-players", label: "4 Players (1 disconnected)" },
  { key: "3-players", label: "3 Players (1 waiting)" },
];

const opponents = {
  "4-players": fourPlayers,
  "3-players": threePlayers,
} satisfies Record<
  Scenario,
  { top: OpponentPlayer | null; left: OpponentPlayer | null; right: OpponentPlayer | null }
>;
</script>

<template>
  <TileSprite />
  <div
    class="fixed top-0 left-0 right-0 z-50 bg-chrome-surface-dark/90 p-2 flex gap-2 items-center"
  >
    <span class="text-text-on-felt text-3.5 font-semibold mr-2">GameTable Showcase</span>
    <button
      v-for="scenario in scenarios"
      :key="scenario.key"
      class="min-tap px-3 py-1 rounded-md text-3 text-text-on-felt"
      :class="activeScenario === scenario.key ? 'bg-state-success' : 'bg-chrome-surface'"
      @click="activeScenario = scenario.key"
    >
      {{ scenario.label }}
    </button>
    <button
      type="button"
      data-testid="dev-toggle-table-talk-eligible"
      class="min-tap ml-2 rounded-md border border-chrome-border px-3 py-1 text-3 text-text-on-felt"
      :class="tableTalkEligible ? 'bg-state-warning/30' : 'bg-chrome-surface'"
      @click="tableTalkEligible = !tableTalkEligible"
    >
      {{ tableTalkEligible ? "Table talk eligible: on" : "Table talk eligible: off" }}
    </button>
  </div>

  <div class="pt-12">
    <GameTable
      :opponents="opponents[activeScenario]"
      :local-player="localPlayer"
      :current-turn-seat="'south'"
      :wall-remaining="48"
      :tiles="mockTiles"
      :is-player-turn="true"
      :can-request-table-talk-report="tableTalkEligible"
    />
  </div>
</template>
