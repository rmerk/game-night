<script setup lang="ts">
import { WALL_CRITICAL_THRESHOLD, WALL_WARNING_THRESHOLD } from "@mahjong-game/shared";
import { computed, shallowRef, watch } from "vue";
import BaseBadge from "../ui/BaseBadge.vue";

const props = defineProps<{
  wallRemaining: number;
}>();

type WallTone = "normal" | "warning" | "critical";

const tone = computed<WallTone>(() => {
  if (props.wallRemaining <= WALL_CRITICAL_THRESHOLD) {
    return "critical";
  }

  if (props.wallRemaining <= WALL_WARNING_THRESHOLD) {
    return "warning";
  }

  return "normal";
});

const liveMessage = shallowRef("");

watch(
  () => [tone.value, props.wallRemaining] as const,
  (nextState, previousState) => {
    const [nextTone, wallRemaining] = nextState;
    const previousTone = previousState?.[0];

    if (!previousTone) {
      return;
    }

    if (nextTone === "warning") {
      liveMessage.value = `Wall warning: ${wallRemaining} tiles remain.`;
      return;
    }

    if (nextTone === "critical") {
      liveMessage.value = `Wall critical: only ${wallRemaining} tiles remain.`;
      return;
    }

    liveMessage.value = "";
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <BaseBadge
      data-testid="wall-counter"
      variant="wall-counter"
      :tone="tone"
      class="px-4 py-2 text-game-critical"
    >
      Wall: {{ wallRemaining }}
    </BaseBadge>
    <div data-testid="wall-counter-live" aria-live="polite" class="sr-only">
      {{ liveMessage }}
    </div>
  </div>
</template>
