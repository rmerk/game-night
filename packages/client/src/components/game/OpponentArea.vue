<script setup lang="ts">
import type { OpponentPlayer } from "./seat-types";
import BaseBadge from "../ui/BaseBadge.vue";
import PlayerPresence from "./PlayerPresence.vue";

const props = withDefaults(
  defineProps<{
    position: "top" | "left" | "right";
    player: OpponentPlayer | null;
    isActiveTurn?: boolean;
    score?: number | null;
    isDeadSeat?: boolean;
    videoTrack?: unknown | null;
    isCameraEnabled?: boolean;
    isSpeaking?: boolean;
  }>(),
  {
    isActiveTurn: false,
    score: null,
    isDeadSeat: false,
    isCameraEnabled: false,
    isSpeaking: false,
  },
);

const isDev = import.meta.env.DEV;
</script>

<template>
  <div
    data-testid="opponent-area-shell"
    class="opponent-area flex max-w-[140px] flex-col items-center gap-1 rounded-xl px-2 py-1 transition md:max-w-[120px] lg:max-w-[140px]"
    :class="{ 'bg-chrome-surface-dark/25 ring-2 ring-state-turn-active': isActiveTurn }"
  >
    <template v-if="player">
      <div class="relative flex flex-col items-center gap-1">
        <div class="relative">
          <PlayerPresence
            :player-id="player.id"
            :display-name="player.name"
            :initial="player.initial"
            :position="position"
            :is-active-turn="isActiveTurn"
            :video-track="videoTrack ?? null"
            :is-camera-enabled="isCameraEnabled"
            :is-speaking="isSpeaking"
          />
          <BaseBadge
            class="absolute -bottom-0.5 -right-0.5 z-[60]"
            variant="status-dot"
            :tone="player.connected ? 'success' : 'muted'"
            :aria-label="player.connected ? 'Connected' : 'Disconnected'"
          />
        </div>

        <span class="max-w-full truncate text-center text-3 text-text-on-felt lg:text-3.5">
          {{ player.name }}
        </span>
        <span
          v-if="isDeadSeat"
          :data-testid="`dead-seat-badge-${player.id}`"
          class="text-2.5 text-text-on-felt/60"
        >
          Dead Seat
        </span>

        <p
          v-if="!player.connected"
          data-testid="seat-reconnecting-label"
          class="max-w-full truncate text-center text-2.5 text-text-on-felt/70 lg:text-3"
        >
          {{ player.name }} is reconnecting…
        </p>

        <BaseBadge
          v-if="isActiveTurn"
          data-testid="seat-status"
          variant="pill"
          tone="active"
          class="text-text-on-felt"
        >
          Current turn
        </BaseBadge>

        <span
          v-if="props.score !== null"
          data-testid="seat-score"
          class="text-3 text-text-on-felt/85"
        >
          Score: {{ props.score }}
        </span>

        <div
          v-if="isDev"
          class="mt-1 hidden h-6 w-full rounded-md border-2 border-dashed border-white/30 lg:block"
        />
      </div>
    </template>

    <template v-else>
      <div
        class="flex h-10 w-10 items-center justify-center rounded-full bg-chrome-surface-dark/50 text-text-on-felt/40 lg:h-16 lg:w-16"
      >
        <span class="text-3">?</span>
      </div>
      <span class="text-3 text-text-on-felt/40">Waiting...</span>
    </template>
  </div>
</template>
