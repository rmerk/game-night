<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { CallType, CallWindowState, SuitedTile, Tile } from "@mahjong-game/shared";
import GameTable from "../game/GameTable.vue";
import TileSprite from "../tiles/TileSprite.vue";
import { useRackStore } from "../../stores/rack";
import type { LocalPlayerSummary, OpponentPlayer } from "../game/seat-types";

type Scenario = "normal-play" | "call-window" | "invalid-mahjong";

const rackStore = useRackStore();
const activeScenario = ref<Scenario>("normal-play");

const scenarioOptions: { key: Scenario; label: string }[] = [
  { key: "normal-play", label: "Normal play" },
  { key: "call-window", label: "Call window" },
  { key: "invalid-mahjong", label: "Invalid Mahjong" },
];

const mockTiles: Tile[] = [
  { id: "dot-7-1", category: "suited", suit: "dot", value: 7, copy: 1 } as SuitedTile,
  { id: "bam-3-2", category: "suited", suit: "bam", value: 3, copy: 2 } as SuitedTile,
  { id: "crak-5-1", category: "suited", suit: "crak", value: 5, copy: 1 } as SuitedTile,
  { id: "dot-3-1", category: "suited", suit: "dot", value: 3, copy: 1 } as SuitedTile,
  { id: "bam-1-1", category: "suited", suit: "bam", value: 1, copy: 1 } as SuitedTile,
  { id: "crak-9-1", category: "suited", suit: "crak", value: 9, copy: 1 } as SuitedTile,
];

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
    connected: true,
    seatWind: "east",
    score: -25,
  },
} satisfies { top: OpponentPlayer; left: OpponentPlayer; right: OpponentPlayer };

const localPlayer: LocalPlayerSummary = {
  id: "player-south",
  name: "You",
  seatWind: "south",
  score: 25,
};

const mockCallWindow: CallWindowState = {
  status: "open",
  discardedTile: {
    id: "bam-1-1",
    category: "suited",
    suit: "bam",
    value: 1,
    copy: 1,
  } as SuitedTile,
  discarderId: "player-west",
  passes: [],
  calls: [],
  openedAt: Date.now(),
  confirmingPlayerId: null,
  confirmationExpiresAt: null,
  remainingCallers: [],
  winningCall: null,
};

const validCallOptions = computed<CallType[]>(() =>
  activeScenario.value === "call-window" ? ["mahjong", "pung", "kong"] : [],
);
const callWindow = computed<CallWindowState | null>(() =>
  activeScenario.value === "call-window" ? mockCallWindow : null,
);
const invalidMahjongMessage = computed(() =>
  activeScenario.value === "invalid-mahjong" ? "Not a valid Mahjong hand." : null,
);

watch(
  activeScenario,
  (scenario) => {
    if (scenario === "call-window") {
      rackStore.deselectTile();
      return;
    }

    rackStore.selectTile("dot-7-1");
  },
  { immediate: true },
);
</script>

<template>
  <TileSprite />
  <div class="min-h-screen bg-felt-teal">
    <div
      class="sticky top-0 z-50 border-b border-chrome-border bg-chrome-surface-dark/95 px-4 py-3"
    >
      <div
        class="mx-auto flex max-w-screen-xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"
      >
        <div class="space-y-1 text-text-on-felt">
          <h1 class="text-5 font-semibold">Keyboard Accessibility Showcase</h1>
          <p class="text-3.5 text-text-on-felt/80">
            Verify skip link, rack roving focus, action-zone arrow navigation, chat Escape, and
            controls placeholder traversal.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="scenario in scenarioOptions"
            :key="scenario.key"
            type="button"
            class="min-tap rounded-md px-3 py-2 text-3 text-text-on-felt focus-visible:focus-ring-on-dark"
            :class="activeScenario === scenario.key ? 'bg-state-success' : 'bg-chrome-surface'"
            @click="activeScenario = scenario.key"
          >
            {{ scenario.label }}
          </button>
        </div>
      </div>
      <div
        class="mx-auto mt-3 max-w-screen-xl rounded-lg border border-chrome-border bg-chrome-surface px-4 py-3 text-3.5 text-text-primary"
      >
        <p>
          <strong>Suggested checks:</strong> Tab from the skip link through rack, actions, chat, and
          controls.
        </p>
        <p>
          Use ArrowLeft/ArrowRight inside the rack and action zone, then press Escape inside chat to
          return to actions.
        </p>
      </div>
    </div>

    <GameTable
      :opponents="opponents"
      :local-player="localPlayer"
      :current-turn-seat="'south'"
      :wall-remaining="48"
      :tiles="mockTiles"
      :is-player-turn="true"
      :call-window="callWindow"
      :valid-call-options="validCallOptions"
      :invalid-mahjong-message="invalidMahjongMessage"
    />
  </div>
</template>
