<script setup lang="ts">
import { computed, ref } from "vue";
import type { SocialOverrideState } from "@mahjong-game/shared";

const props = withDefaults(
  defineProps<{
    /** Discarder may request before a vote exists */
    canRequestSocialOverride?: boolean;
    socialOverrideState: SocialOverrideState | null;
    myPlayerId: string | null;
  }>(),
  {
    canRequestSocialOverride: false,
    socialOverrideState: null,
    myPlayerId: null,
  },
);

const emit = defineEmits<{
  socialOverrideRequest: [description: string];
  socialOverrideVote: [approve: boolean];
}>();

const description = ref("");

const pending = computed(() => props.socialOverrideState !== null);

const isRequester = computed(
  () =>
    pending.value &&
    props.myPlayerId !== null &&
    props.socialOverrideState!.requesterId === props.myPlayerId,
);

const isVoter = computed(() => {
  if (!pending.value || props.myPlayerId === null) return false;
  const req = props.socialOverrideState!.requesterId;
  return props.myPlayerId !== req;
});

const myVote = computed(() => {
  if (!props.myPlayerId || !props.socialOverrideState) return undefined;
  return props.socialOverrideState.votes[props.myPlayerId];
});

const showVoteButtons = computed(() => isVoter.value && myVote.value === undefined);

const approveCount = computed(
  () => Object.values(props.socialOverrideState?.votes ?? {}).filter((v) => v === "approve").length,
);

function submitRequest() {
  const d = description.value.trim();
  if (!d) return;
  emit("socialOverrideRequest", d);
  description.value = "";
}
</script>

<template>
  <div
    v-if="canRequestSocialOverride || pending"
    data-testid="social-override-panel"
    class="max-w-md w-full rounded-lg border border-state-turn-active/40 bg-chrome-surface-dark/95 px-3 py-2 text-3 text-text-on-felt shadow-md"
  >
    <template v-if="canRequestSocialOverride && !pending">
      <p class="mb-2 font-medium">Request undo (accidental discard)</p>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          v-model="description"
          type="text"
          maxlength="280"
          placeholder="Brief reason…"
          class="min-w-0 flex-1 rounded border border-chrome-border bg-chrome-surface px-2 py-1 text-3 text-text-primary"
          @keydown.enter.prevent="submitRequest"
        />
        <button
          type="button"
          class="min-tap rounded-md bg-state-warning px-3 py-1.5 text-3 font-medium text-text-on-felt"
          @click="submitRequest"
        >
          Request vote
        </button>
      </div>
    </template>

    <template v-else-if="pending && socialOverrideState">
      <p class="font-medium">Social override</p>
      <p class="text-text-secondary mt-1">{{ socialOverrideState.description }}</p>
      <p v-if="isRequester" class="mt-2 text-text-secondary">
        Waiting for all 3 players to approve…
      </p>
      <template v-else-if="showVoteButtons">
        <p class="mt-2">Approve undo for this discard?</p>
        <div class="mt-2 flex gap-2">
          <button
            type="button"
            class="min-tap rounded-md bg-state-success px-3 py-1.5 text-3 font-medium"
            @click="emit('socialOverrideVote', true)"
          >
            Approve
          </button>
          <button
            type="button"
            class="min-tap rounded-md bg-state-error px-3 py-1.5 text-3 font-medium text-text-on-felt"
            @click="emit('socialOverrideVote', false)"
          >
            Deny
          </button>
        </div>
      </template>
      <p v-else-if="myVote" class="mt-2 text-text-secondary">Your vote: {{ myVote }}</p>
      <p v-else class="mt-2 text-text-secondary">Vote in progress ({{ approveCount }}/3 approve)</p>
    </template>
  </div>
</template>
