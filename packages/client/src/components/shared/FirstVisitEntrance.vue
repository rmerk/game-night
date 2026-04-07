<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from "vue";
import { usePreferencesStore } from "../../stores/preferences";

const prefsStore = usePreferencesStore();
const visible = ref(false);
const fading = ref(false);

let timerId: ReturnType<typeof setTimeout> | null = null;

onMounted(async () => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefsStore.hasSeenEntrance || reduced) {
    if (!prefsStore.hasSeenEntrance) prefsStore.markEntranceSeen();
    return;
  }
  visible.value = true;
  await nextTick();
  fading.value = true; // triggers CSS transition
  timerId = setTimeout(() => {
    visible.value = false;
    prefsStore.markEntranceSeen();
  }, 2100); // slightly over 2000ms to let transition complete
});

onBeforeUnmount(() => {
  if (timerId !== null) clearTimeout(timerId);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      aria-hidden="true"
      class="fixed inset-0 z-[200] pointer-events-none"
      :style="{
        background: 'var(--chrome-surface)',
        opacity: fading ? 0 : 1,
        transition: 'opacity 2000ms ease-out',
      }"
    />
  </Teleport>
</template>
