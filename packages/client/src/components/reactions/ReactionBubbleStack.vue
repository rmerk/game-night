<script setup lang="ts">
import type { ReactionBubbleRecord } from "../../stores/reactions";
import ReactionBubble from "./ReactionBubble.vue";

defineProps<{
  items: readonly ReactionBubbleRecord[];
}>();
</script>

<template>
  <TransitionGroup
    name="reaction-fade"
    tag="div"
    class="flex flex-col-reverse items-center gap-1"
  >
    <ReactionBubble v-for="b in items" :key="b.id" :emoji="b.emoji" />
  </TransitionGroup>
</template>

<style scoped>
.reaction-fade-enter-active,
.reaction-fade-leave-active {
  transition:
    opacity var(--timing-tactile, 120ms) var(--ease-tactile, ease-out),
    transform var(--timing-tactile, 120ms) var(--ease-tactile, ease-out);
}

.reaction-fade-enter-from,
.reaction-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (prefers-reduced-motion: reduce) {
  .reaction-fade-enter-active,
  .reaction-fade-leave-active {
    transition: none;
  }

  .reaction-fade-enter-from,
  .reaction-fade-leave-to {
    transform: none;
  }
}
</style>
