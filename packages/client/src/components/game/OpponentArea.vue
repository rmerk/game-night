<script setup lang="ts">
export interface OpponentPlayer {
  name: string;
  initial: string;
  connected: boolean;
}

defineProps<{
  position: "top" | "left" | "right";
  player: OpponentPlayer | null;
}>();

const isDev = import.meta.env.DEV;
</script>

<template>
  <div class="opponent-area flex flex-col items-center gap-1 w-10 h-auto md:w-20 lg:w-35">
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
