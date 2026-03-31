<script setup lang="ts">
import type { OpponentPlayer } from "./seat-types";

const props = withDefaults(
  defineProps<{
    position: "top" | "left" | "right";
    player: OpponentPlayer | null;
    isActiveTurn?: boolean;
    score?: number | null;
  }>(),
  {
    isActiveTurn: false,
    score: null,
  },
);

const isDev = import.meta.env.DEV;
</script>

<template>
  <div
    data-testid="opponent-area-shell"
    class="opponent-area flex flex-col items-center gap-1 w-10 h-auto rounded-xl px-2 py-1 transition md:w-20 lg:w-35"
    :class="props.isActiveTurn ? 'bg-chrome-surface-dark/25 ring-2 ring-state-turn-active' : ''"
  >
    <template v-if="player">
      <!-- Avatar circle -->
      <div
        class="relative flex items-center justify-center rounded-full bg-chrome-surface-dark text-text-on-felt w-10 h-10 lg:w-16 lg:h-16 text-interactive"
        :aria-label="`${player.name}'s seat`"
      >
        <span class="text-4 lg:text-6 font-semibold">{{ player.initial }}</span>

        <!-- Connection status dot -->
        <span
          class="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-felt-teal"
          :class="player.connected ? 'bg-state-success' : 'bg-text-secondary'"
          :aria-label="player.connected ? 'Connected' : 'Disconnected'"
        />
      </div>

      <!-- Player name -->
      <span class="text-text-on-felt text-3 lg:text-3.5 truncate max-w-full text-center">
        {{ player.name }}
      </span>

      <span
        v-if="props.isActiveTurn"
        data-testid="seat-status"
        class="rounded-full bg-state-turn-active/20 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-text-on-felt"
      >
        Current turn
      </span>

      <span
        v-if="props.score !== null"
        data-testid="seat-score"
        class="text-3 text-text-on-felt/85"
      >
        Score: {{ props.score }}
      </span>

      <!-- Exposed groups placeholder (dev only) -->
      <div
        v-if="isDev"
        class="hidden lg:block border-2 border-dashed border-white/30 rounded-md w-full h-6 mt-1"
      />
    </template>

    <template v-else>
      <!-- Empty seat placeholder -->
      <div
        class="flex items-center justify-center rounded-full bg-chrome-surface-dark/50 text-text-on-felt/40 w-10 h-10 lg:w-16 lg:h-16"
      >
        <span class="text-3">?</span>
      </div>
      <span class="text-text-on-felt/40 text-3">Waiting...</span>
    </template>
  </div>
</template>
