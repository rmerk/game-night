<script setup lang="ts">
import { computed, shallowRef, watch } from "vue";

const props = defineProps<{
  wallRemaining: number;
}>();

type WallTone = "normal" | "warning" | "critical";

const tone = computed<WallTone>(() => {
  if (props.wallRemaining <= 10) {
    return "critical";
  }

  if (props.wallRemaining <= 20) {
    return "warning";
  }

  return "normal";
});

const liveMessage = shallowRef("");

watch(
  tone,
  (nextTone, previousTone) => {
    if (!previousTone || previousTone === nextTone) {
      return;
    }

    if (nextTone === "warning") {
      liveMessage.value = `Wall warning: ${props.wallRemaining} tiles remain.`;
      return;
    }

    if (nextTone === "critical") {
      liveMessage.value = `Wall critical: only ${props.wallRemaining} tiles remain.`;
    }
  },
  { immediate: true },
);

const counterClasses = computed(() => ({
  "wall-normal": tone.value === "normal",
  "wall-warning": tone.value === "warning",
  "wall-critical": tone.value === "critical",
}));
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <div
      data-testid="wall-counter"
      class="wall-counter text-game-critical inline-flex items-center rounded-full border px-4 py-2 shadow-panel"
      :class="counterClasses"
    >
      Wall: {{ wallRemaining }}
    </div>
    <div data-testid="wall-counter-live" aria-live="polite" class="sr-only">
      {{ liveMessage }}
    </div>
  </div>
</template>

<style scoped>
.wall-counter {
  @apply bg-chrome-surface-dark/85 text-text-on-felt;
}

.wall-normal {
  @apply border-wall-normal;
}

.wall-warning {
  @apply border-wall-warning text-wall-warning;
}

.wall-critical {
  @apply border-wall-critical text-wall-critical;
}
</style>
