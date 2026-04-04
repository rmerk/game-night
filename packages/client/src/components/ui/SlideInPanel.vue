<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean;
    label: string;
    closeOnBackdrop?: boolean;
  }>(),
  {
    closeOnBackdrop: true,
  },
);

const emit = defineEmits<{
  close: [];
}>();

const panelId = "slide-in-panel-" + Math.random().toString(36).slice(2, 9);

function onBackdropClick() {
  if (props.closeOnBackdrop) {
    emit("close");
  }
}
</script>

<template>
  <div class="pointer-events-none">
    <!-- Mobile: fixed overlay + bottom sheet (rack stays visible above fold on typical layouts) -->
    <button
      v-if="open"
      type="button"
      class="pointer-events-auto fixed inset-0 z-40 bg-black/20 md:hidden"
      aria-label="Close panel"
      @click="onBackdropClick"
    />
    <Transition name="slide-in-mobile">
      <div
        v-if="open"
        :id="panelId"
        role="dialog"
        aria-modal="false"
        :aria-label="label"
        class="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex max-h-[48dvh] flex-col rounded-t-xl border border-chrome-border bg-chrome-elevated shadow-lg md:hidden"
      >
        <slot />
      </div>
    </Transition>

    <!-- md+: anchored to nearest positioned ancestor (table / lobby shell) -->
    <Transition name="slide-in-side">
      <aside
        v-if="open"
        :id="`${panelId}-side`"
        role="dialog"
        aria-modal="false"
        :aria-label="label"
        class="pointer-events-auto absolute right-0 top-0 z-30 hidden h-full w-[280px] flex-col border-l border-chrome-border bg-chrome-elevated/95 shadow-lg backdrop-blur-sm md:flex"
      >
        <slot />
      </aside>
    </Transition>
  </div>
</template>

<style scoped>
.slide-in-mobile-enter-active,
.slide-in-mobile-leave-active,
.slide-in-side-enter-active,
.slide-in-side-leave-active {
  transition:
    transform var(--timing-tactile, 120ms) var(--ease-tactile, ease-out),
    opacity var(--timing-tactile, 120ms) var(--ease-tactile, ease-out);
}

.slide-in-mobile-enter-from,
.slide-in-mobile-leave-to {
  transform: translateY(100%);
  opacity: 0.85;
}

.slide-in-side-enter-from,
.slide-in-side-leave-to {
  transform: translateX(100%);
  opacity: 0.85;
}
</style>
