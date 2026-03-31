<script setup lang="ts">
import { ref } from "vue";
import type { GameResult, SeatWind, SuitedTile, Tile } from "@mahjong-game/shared";
import GameTable from "../game/GameTable.vue";
import type { LocalPlayerSummary, OpponentPlayer } from "../game/seat-types";
import TileSprite from "../tiles/TileSprite.vue";

type Scenario = "normal" | "warning" | "critical" | "scoreboard" | "skip-ahead";

const activeScenario = ref<Scenario>("normal");
const currentTurnSeat = ref<SeatWind>("south");

const scenarios: { key: Scenario; label: string; description: string }[] = [
  {
    key: "normal",
    label: "Normal play",
    description: "Standard turn-state UI with a healthy wall count and visible session scores.",
  },
  {
    key: "warning",
    label: "Warning wall",
    description: "Wall counter enters the warning state at 20 remaining tiles.",
  },
  {
    key: "critical",
    label: "Critical wall",
    description: "Wall counter enters the critical state at 10 remaining tiles.",
  },
  {
    key: "scoreboard",
    label: "Scoreboard",
    description: "Completed-hand breakdown with winner, payments, and session totals.",
  },
  {
    key: "skip-ahead",
    label: "Skip-ahead turn",
    description: "Trigger a narrated east-to-north jump to verify skipped-seat animation.",
  },
];

const localPlayer: LocalPlayerSummary = {
  id: "player-south",
  name: "You",
  seatWind: "south",
  score: 25,
};

const opponents = {
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
} satisfies { top: OpponentPlayer; left: OpponentPlayer; right: OpponentPlayer };

const mockTiles: Tile[] = [
  { id: "dot-7-1", category: "suited", suit: "dot", value: 7, copy: 1 } as SuitedTile,
  { id: "bam-3-2", category: "suited", suit: "bam", value: 3, copy: 2 } as SuitedTile,
  { id: "crak-5-1", category: "suited", suit: "crak", value: 5, copy: 1 } as SuitedTile,
  { id: "dot-3-1", category: "suited", suit: "dot", value: 3, copy: 1 } as SuitedTile,
];

const scoreboardResult: GameResult = {
  winnerId: "player-south",
  patternId: "double-run",
  patternName: "Double Run",
  points: 50,
  selfDrawn: false,
  discarderId: "player-east",
  payments: {
    "player-south": 150,
    "player-east": -50,
    "player-west": -50,
    "player-north": -50,
  },
};

function setScenario(scenario: Scenario) {
  activeScenario.value = scenario;
  currentTurnSeat.value = scenario === "skip-ahead" ? "east" : "south";
}

function triggerSkipAhead() {
  currentTurnSeat.value = "east";
  window.setTimeout(() => {
    currentTurnSeat.value = "north";
  }, 50);
}
</script>

<template>
  <TileSprite />
  <div
    class="fixed top-0 left-0 right-0 z-50 flex flex-wrap items-center gap-2 bg-chrome-surface-dark/90 p-2"
  >
    <span class="mr-2 text-3.5 font-semibold text-text-on-felt">Game Status Showcase</span>
    <button
      v-for="scenario in scenarios"
      :key="scenario.key"
      class="min-tap rounded-md px-3 py-1 text-3 text-text-on-felt"
      :class="
        activeScenario === scenario.key ? 'bg-gold-accent text-text-primary' : 'bg-chrome-surface'
      "
      @click="setScenario(scenario.key)"
    >
      {{ scenario.label }}
    </button>
    <button
      v-if="activeScenario === 'skip-ahead'"
      class="min-tap rounded-md bg-state-success px-3 py-1 text-3 text-text-on-felt"
      @click="triggerSkipAhead"
    >
      Trigger Skip
    </button>
  </div>

  <div class="min-h-screen bg-felt-teal p-4 pt-18 text-text-on-felt">
    <div class="mb-4 max-w-2xl">
      <h2 class="mb-2 text-5 font-semibold">
        {{ scenarios.find((scenario) => scenario.key === activeScenario)?.label }}
      </h2>
      <p class="text-3.5 text-text-on-felt/75">
        {{ scenarios.find((scenario) => scenario.key === activeScenario)?.description }}
      </p>
    </div>

    <GameTable
      :opponents="opponents"
      :local-player="localPlayer"
      :current-turn-seat="currentTurnSeat"
      :wall-remaining="activeScenario === 'warning' ? 20 : activeScenario === 'critical' ? 10 : 48"
      :game-phase="activeScenario === 'scoreboard' ? 'scoreboard' : 'play'"
      :game-result="activeScenario === 'scoreboard' ? scoreboardResult : null"
      :tiles="mockTiles"
      :is-player-turn="true"
    />
  </div>
</template>
