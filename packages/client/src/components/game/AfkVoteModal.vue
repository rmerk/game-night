<script setup lang="ts">
import { computed } from "vue";
import { useNow } from "@vueuse/core";

const now = useNow({ interval: 1000 });

const props = withDefaults(
  defineProps<{
    open: boolean;
    targetPlayerId: string;
    targetPlayerName: string;
    isTargetLocalPlayer: boolean;
    expiresAt: number | null;
  }>(),
  {
    expiresAt: null,
  },
);

const emit = defineEmits<{
  vote: [vote: "approve" | "deny"];
}>();

const secondsLeft = computed(() => {
  if (props.expiresAt === null) return null;
  const s = Math.max(0, Math.ceil((props.expiresAt - now.value.getTime()) / 1000));
  return s;
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      data-testid="afk-vote-modal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="afk-vote-title"
    >
      <div
        class="max-w-md rounded-lg border border-chrome-border bg-chrome-surface p-6 text-text-primary shadow-lg"
      >
        <h2 id="afk-vote-title" class="mb-3 text-lg font-semibold">
          <template v-if="isTargetLocalPlayer">AFK vote</template>
          <template v-else>Vote</template>
        </h2>
        <p v-if="isTargetLocalPlayer" class="mb-4 text-3.5 text-text-secondary">
          Players are voting to mark you AFK — take an action to cancel the vote.
        </p>
        <p v-else class="mb-4 text-3.5 text-text-secondary">
          Convert {{ targetPlayerName }} to a dead seat?
        </p>
        <p
          v-if="expiresAt !== null && secondsLeft !== null"
          class="mb-4 text-3 text-text-secondary"
        >
          Time left: {{ secondsLeft }}s
        </p>
        <div v-if="!isTargetLocalPlayer" class="flex gap-3">
          <button
            type="button"
            data-testid="afk-vote-approve-btn"
            class="rounded-md bg-state-turn-active px-4 py-2 text-3.5 font-medium text-text-on-felt"
            @click="emit('vote', 'approve')"
          >
            Yes
          </button>
          <button
            type="button"
            data-testid="afk-vote-deny-btn"
            class="rounded-md border border-chrome-border bg-chrome-surface px-4 py-2 text-3.5"
            @click="emit('vote', 'deny')"
          >
            No
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
