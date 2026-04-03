<script setup lang="ts">
import BaseButton from "../ui/BaseButton.vue";

defineProps<{
  myVote: boolean | null;
  votesReceivedCount: number;
}>();

const emit = defineEmits<{
  vote: [accept: boolean];
}>();
</script>

<template>
  <div data-testid="charleston-vote" class="charleston-vote flex flex-col items-center gap-2">
    <p class="text-interactive text-text-primary">Do a second Charleston?</p>
    <div class="flex flex-wrap items-center justify-center gap-2">
      <BaseButton
        data-testid="charleston-vote-yes"
        variant="primary"
        :disabled="myVote !== null"
        aria-label="Vote yes for second Charleston"
        @click="emit('vote', true)"
      >
        Yes
      </BaseButton>
      <BaseButton
        data-testid="charleston-vote-no"
        variant="secondary"
        :disabled="myVote !== null"
        aria-label="Vote no for second Charleston"
        @click="emit('vote', false)"
      >
        No
      </BaseButton>
    </div>
    <p
      v-if="myVote === true"
      data-testid="charleston-vote-choice"
      class="text-3.5 text-text-secondary"
    >
      You voted Yes
    </p>
    <p
      v-else-if="myVote === false"
      data-testid="charleston-vote-choice"
      class="text-3.5 text-text-secondary"
    >
      You voted No
    </p>
    <p data-testid="charleston-vote-count" class="text-3.5 text-text-secondary">
      {{ votesReceivedCount }} of 4 voted
    </p>
  </div>
</template>
