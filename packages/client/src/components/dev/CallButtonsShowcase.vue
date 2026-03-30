<script setup lang="ts">
import { ref } from "vue";
import CallButtons from "../game/CallButtons.vue";
import ActionZone from "../game/ActionZone.vue";
import type { CallType } from "@mahjong-game/shared";

const callLog = ref<string[]>([]);

function handleCall(callType: CallType) {
  callLog.value.push(`Call: ${callType}`);
}

function handlePass() {
  callLog.value.push("Pass");
}

function clearLog() {
  callLog.value = [];
}

type Scenario =
  | "single"
  | "multiple"
  | "pass-only"
  | "all-types"
  | "mobile-grid"
  | "mahjong-priority";
const activeScenario = ref<Scenario>("multiple");

const scenarios: { key: Scenario; label: string; calls: CallType[] }[] = [
  { key: "single", label: "Single Call", calls: ["pung"] },
  { key: "multiple", label: "Multiple Calls", calls: ["pung", "kong"] },
  { key: "pass-only", label: "Pass Only", calls: [] },
  {
    key: "all-types",
    label: "All Call Types",
    calls: ["pung", "kong", "quint", "news", "dragon_set", "mahjong"],
  },
  { key: "mobile-grid", label: "Mobile Grid (4+)", calls: ["pung", "kong", "mahjong"] },
  { key: "mahjong-priority", label: "Mahjong Priority", calls: ["kong", "mahjong", "pung"] },
];

const currentCalls = ref<CallType[]>(["pung", "kong"]);

function setScenario(scenario: (typeof scenarios)[number]) {
  activeScenario.value = scenario.key;
  currentCalls.value = scenario.calls;
}
</script>

<template>
  <div
    class="fixed top-0 left-0 right-0 z-50 bg-chrome-surface-dark/90 p-2 flex gap-2 items-center flex-wrap"
  >
    <span class="text-text-on-felt text-3.5 font-semibold mr-2">Call Buttons Showcase</span>
    <button
      v-for="scenario in scenarios"
      :key="scenario.key"
      class="min-tap px-3 py-1 rounded-md text-3 text-text-on-felt"
      :class="activeScenario === scenario.key ? 'bg-state-success' : 'bg-chrome-surface'"
      @click="setScenario(scenario)"
    >
      {{ scenario.label }}
    </button>
    <button
      class="min-tap px-3 py-1 rounded-md text-3 text-text-on-felt bg-state-error"
      @click="clearLog"
    >
      Clear Log
    </button>
  </div>

  <div class="pt-16 p-4 bg-felt-teal min-h-screen flex flex-col gap-6">
    <div>
      <h2 class="text-text-on-felt text-5 font-semibold mb-2">
        {{ scenarios.find((s) => s.key === activeScenario)?.label }}
      </h2>
      <p class="text-text-on-felt/70 text-3.5 mb-4">
        Valid calls: {{ currentCalls.length === 0 ? "none (pass only)" : currentCalls.join(", ") }}
      </p>
    </div>

    <!-- Call buttons in ActionZone (same as in GameTable) -->
    <div class="max-w-2xl">
      <ActionZone>
        <CallButtons
          :valid-calls="currentCalls"
          call-window-status="open"
          @call="handleCall"
          @pass="handlePass"
        />
      </ActionZone>
    </div>

    <!-- Event log -->
    <div
      v-if="callLog.length > 0"
      class="bg-chrome-surface-dark/80 rounded-md p-3 text-text-on-felt text-3.5 max-w-md"
    >
      <p class="font-semibold mb-1">Event Log:</p>
      <p v-for="(entry, i) in callLog" :key="i">{{ i + 1 }}. {{ entry }}</p>
    </div>
  </div>
</template>
