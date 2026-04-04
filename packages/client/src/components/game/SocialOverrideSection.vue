<script setup lang="ts">
import { computed, ref } from "vue";
import type { SocialOverrideState } from "@mahjong-game/shared";

const props = withDefaults(
  defineProps<{
    canRequestSocialOverride?: boolean;
    socialOverrideState?: SocialOverrideState | null;
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

const socialDescription = ref("");

const pendingSocial = computed(() => props.socialOverrideState !== null);

const isSocialRequester = computed(
  () =>
    pendingSocial.value &&
    props.myPlayerId !== null &&
    props.socialOverrideState?.requesterId === props.myPlayerId,
);

const isSocialVoter = computed(() => {
  if (!pendingSocial.value || props.myPlayerId === null) return false;
  const req = props.socialOverrideState?.requesterId;
  return req !== undefined && props.myPlayerId !== req;
});

const mySocialVote = computed(() => {
  if (!props.myPlayerId || !props.socialOverrideState) return undefined;
  return props.socialOverrideState.votes[props.myPlayerId];
});

const showSocialVoteButtons = computed(
  () => isSocialVoter.value && mySocialVote.value === undefined,
);

const socialApproveCount = computed(
  () => Object.values(props.socialOverrideState?.votes ?? {}).filter((v) => v === "approve").length,
);

function submitSocialRequest() {
  const d = socialDescription.value.trim();
  if (!d) return;
  emit("socialOverrideRequest", d);
  socialDescription.value = "";
}
</script>

<template>
  <div v-if="canRequestSocialOverride || pendingSocial">
    <template v-if="canRequestSocialOverride && !pendingSocial">
      <p class="mb-2 font-medium">Social override — undo accidental discard</p>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          v-model="socialDescription"
          type="text"
          maxlength="280"
          placeholder="Brief reason…"
          class="min-w-0 flex-1 rounded border border-chrome-border bg-chrome-surface px-2 py-1 text-3 text-text-primary"
          @keydown.enter.prevent="submitSocialRequest"
        />
        <button
          type="button"
          class="min-tap rounded-md bg-state-warning px-3 py-1.5 text-3 font-medium text-text-on-felt"
          @click="submitSocialRequest"
        >
          Request vote
        </button>
      </div>
    </template>

    <template v-else-if="pendingSocial && socialOverrideState">
      <p class="font-medium">Social override</p>
      <p class="text-text-secondary mt-1">{{ socialOverrideState.description }}</p>
      <p v-if="isSocialRequester" class="mt-2 text-text-secondary">
        Waiting for all 3 players to approve…
      </p>
      <template v-else-if="showSocialVoteButtons">
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
      <p v-else-if="mySocialVote" class="mt-2 text-text-secondary">Your vote: {{ mySocialVote }}</p>
      <p v-else class="mt-2 text-text-secondary">
        Vote in progress ({{ socialApproveCount }}/3 approve)
      </p>
    </template>
  </div>
</template>
