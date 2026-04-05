<script setup lang="ts">
import { computed } from "vue";
import { useNow } from "@vueuse/core";

const now = useNow({ interval: 1000 });

const props = withDefaults(
  defineProps<{
    open: boolean;
    targetPlayerName: string;
    expiresAt: number | null;
  }>(),
  {
    expiresAt: null,
  },
);

const emit = defineEmits<{
  vote: [choice: "dead_seat" | "end_game"];
}>();

const secondsLeft = computed(() => {
  if (props.expiresAt === null) return null;
  return Math.max(0, Math.ceil((props.expiresAt - now.value.getTime()) / 1000));
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      data-testid="departure-vote-modal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="departure-vote-title"
    >
      <div
        class="max-w-md rounded-lg border border-chrome-border bg-chrome-surface p-6 text-text-primary shadow-lg"
      >
        <h2 id="departure-vote-title" class="mb-3 text-lg font-semibold">Player left</h2>
        <p class="mb-4 text-3.5 text-text-secondary">
          {{ targetPlayerName }} has left the game. Continue with them as a dead seat, or end the
          game?
        </p>
        <p
          v-if="expiresAt !== null && secondsLeft !== null"
          class="mb-4 text-3 text-text-secondary"
        >
          Time left: {{ secondsLeft }}s
        </p>
        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            data-testid="departure-vote-dead-seat-btn"
            class="rounded-md bg-state-turn-active px-4 py-2 text-3.5 font-medium text-text-on-felt"
            @click="emit('vote', 'dead_seat')"
          >
            Continue (dead seat)
          </button>
          <button
            type="button"
            data-testid="departure-vote-end-game-btn"
            class="rounded-md border border-chrome-border bg-chrome-surface px-4 py-2 text-3.5"
            @click="emit('vote', 'end_game')"
          >
            End game
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
