<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import { usePreferencesStore } from "../../stores/preferences";

const prefsStore = usePreferencesStore();
const visible = ref(false);
const fading = ref(false);

onMounted(async () => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefsStore.hasSeenEntrance || reduced) {
    if (!prefsStore.hasSeenEntrance) prefsStore.markEntranceSeen();
    return;
  }
  visible.value = true;
  await nextTick();
  fading.value = true; // triggers CSS transition
  setTimeout(() => {
    visible.value = false;
    prefsStore.markEntranceSeen();
  }, 2100); // slightly over 2000ms to let transition complete
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="fixed inset-0 z-[200] pointer-events-none"
      :style="{
        background: 'var(--chrome-surface)',
        opacity: fading ? 0 : 1,
        transition: 'opacity 2000ms ease-out',
      }"
    />
  </Teleport>
</template>
