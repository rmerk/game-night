<script setup lang="ts">
import { computed, ref } from "vue";
import type { CallType } from "@mahjong-game/shared";
import ActionZone from "../game/ActionZone.vue";
import CallButtons from "../game/CallButtons.vue";
import DiscardConfirm from "../game/DiscardConfirm.vue";
import InvalidMahjongNotification from "../game/InvalidMahjongNotification.vue";
import MahjongButton from "../game/MahjongButton.vue";

type Scenario = "default" | "call-window" | "invalid" | "discard-confirm";

const activeScenario = ref<Scenario>("default");
const eventLog = ref<string[]>([]);

const scenarios: { key: Scenario; label: string; description: string }[] = [
  {
    key: "default",
    label: "Default State",
    description: "Persistent Mahjong button by itself during regular play.",
  },
  {
    key: "call-window",
    label: "During Call Window",
    description: "Call buttons render with Mahjong priority while the persistent button hides.",
  },
  {
    key: "invalid",
    label: "After Invalid Declaration",
    description: "Private inline invalid Mahjong feedback with a cancel action.",
  },
  {
    key: "discard-confirm",
    label: "With Discard Confirm",
    description: "Mahjong and Discard buttons coexist outside a call window.",
  },
];

const validCalls = computed<CallType[]>(() => {
  if (activeScenario.value === "call-window") {
    return ["mahjong", "pung"];
  }

  return [];
});

const isCallWindowOpen = computed(() => activeScenario.value === "call-window");
const hideForCallDuplication = computed(
  () => isCallWindowOpen.value && validCalls.value.includes("mahjong"),
);
const invalidMahjongVisible = computed(() => activeScenario.value === "invalid");
const discardSelectedTileId = computed(() =>
  activeScenario.value === "discard-confirm" ? "bam-3-1" : null,
);

const activeScenarioDef = computed(
  () => scenarios.find((scenario) => scenario.key === activeScenario.value) ?? scenarios[0],
);

function pushEvent(entry: string) {
  eventLog.value.unshift(entry);
}

function clearLog() {
  eventLog.value = [];
}
</script>

<template>
  <div
    class="fixed top-0 left-0 right-0 z-50 flex flex-wrap items-center gap-2 bg-chrome-surface-dark/90 p-2"
  >
    <span class="mr-2 text-3.5 font-semibold text-text-on-felt">Mahjong Button Showcase</span>
    <button
      v-for="scenario in scenarios"
      :key="scenario.key"
      class="min-tap rounded-md px-3 py-1 text-3 text-text-on-felt"
      :class="
        activeScenario === scenario.key ? 'bg-gold-accent text-text-primary' : 'bg-chrome-surface'
      "
      @click="activeScenario = scenario.key"
    >
      {{ scenario.label }}
    </button>
    <button
      class="min-tap rounded-md bg-state-error px-3 py-1 text-3 text-text-on-felt"
      @click="clearLog"
    >
      Clear Log
    </button>
  </div>

  <div class="min-h-screen bg-felt-teal p-4 pt-18 text-text-on-felt">
    <div class="mb-6">
      <h2 class="mb-2 text-5 font-semibold">
        {{ activeScenarioDef.label }}
      </h2>
      <p class="max-w-2xl text-3.5 text-text-on-felt/75">
        {{ activeScenarioDef.description }}
      </p>
    </div>

    <div class="max-w-3xl">
      <ActionZone>
        <div class="flex flex-wrap items-center justify-center gap-2">
          <MahjongButton
            :is-call-window-open="isCallWindowOpen"
            :hide-for-call-duplication="hideForCallDuplication"
            @declare-mahjong="pushEvent('declareMahjong')"
            @call-mahjong="pushEvent('call: mahjong')"
          />
          <CallButtons
            v-if="isCallWindowOpen"
            :valid-calls="validCalls"
            call-window-status="open"
            @call="(callType) => pushEvent(`call: ${callType}`)"
            @pass="pushEvent('pass')"
          />
          <DiscardConfirm
            v-if="!isCallWindowOpen"
            :selected-tile-id="discardSelectedTileId"
            :is-player-turn="activeScenario === 'discard-confirm'"
            @discard="(tileId) => pushEvent(`discard: ${tileId}`)"
          />
          <InvalidMahjongNotification
            :visible="invalidMahjongVisible"
            message="Your hand is not a valid Mahjong."
            @cancel="pushEvent('cancelMahjong')"
          />
        </div>
      </ActionZone>
    </div>

    <div
      v-if="eventLog.length > 0"
      class="mt-6 max-w-md rounded-md bg-chrome-surface-dark/80 p-3 text-3.5"
    >
      <p class="mb-1 font-semibold">Event Log</p>
      <p v-for="(entry, index) in eventLog" :key="`${entry}-${index}`">
        {{ index + 1 }}. {{ entry }}
      </p>
    </div>
  </div>
</template>
