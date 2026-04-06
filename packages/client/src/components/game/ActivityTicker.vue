<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed } from "vue";
import { useActivityTickerStore } from "../../stores/activityTicker";

const store = useActivityTickerStore();
const { items } = storeToRefs(store);

const line = computed(() => items.value.map((i) => i.text).join(" → "));
const visible = computed(() => items.value.length > 0);
</script>

<template>
  <Transition name="activity-ticker-fade">
    <div
      v-if="visible"
      data-testid="activity-ticker"
      role="log"
      aria-live="polite"
      aria-label="Recent game activity"
      class="hidden max-w-full min-w-0 truncate px-2 text-center text-secondary text-text-on-felt/50 sm:block"
    >
      {{ line }}
    </div>
  </Transition>
</template>

<style scoped>
.activity-ticker-fade-enter-active {
  transition: opacity var(--timing-tactile) var(--ease-tactile);
}

.activity-ticker-fade-leave-active {
  transition: opacity var(--timing-exit) var(--ease-tactile);
}

.activity-ticker-fade-enter-from,
.activity-ticker-fade-leave-to {
  opacity: 0;
}
</style>
