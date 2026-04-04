<script setup lang="ts">
import { useId } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    label: string;
    /** ID for aria-controls on the toggle that opens this panel (single responsive surface). */
    contentId?: string;
    closeOnBackdrop?: boolean;
  }>(),
  {
    closeOnBackdrop: true,
    contentId: undefined,
  },
);

const emit = defineEmits<{
  close: [];
}>();

const autoId = useId();
const rootId = props.contentId ?? `slide-in-panel-${autoId}`;

function onBackdropClick() {
  if (props.closeOnBackdrop) {
    emit("close");
  }
}
</script>

<template>
  <div class="pointer-events-none">
    <!-- Mobile only: dim tiles behind sheet -->
    <button
      v-if="open"
      type="button"
      class="pointer-events-auto fixed inset-0 z-40 bg-black/20 md:hidden"
      aria-label="Close panel"
      @click="onBackdropClick"
    />
    <Transition name="slide-in-panel">
      <div
        v-if="open"
        :id="rootId"
        role="dialog"
        aria-modal="false"
        :aria-label="label"
        class="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex max-h-[48dvh] flex-col rounded-t-xl border border-chrome-border bg-chrome-elevated shadow-lg md:absolute md:inset-x-auto md:inset-y-0 md:bottom-auto md:left-auto md:right-0 md:top-0 md:z-30 md:max-h-none md:h-full md:w-[280px] md:rounded-none md:border-y-0 md:border-l md:border-r-0 md:bg-chrome-elevated/95 md:shadow-lg md:backdrop-blur-sm"
      >
        <slot />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-in-panel-enter-active,
.slide-in-panel-leave-active {
  transition:
    transform var(--timing-tactile, 120ms) var(--ease-tactile, ease-out),
    opacity var(--timing-tactile, 120ms) var(--ease-tactile, ease-out);
}

.slide-in-panel-enter-from,
.slide-in-panel-leave-to {
  transform: translateY(100%);
  opacity: 0.85;
}

@media (min-width: 768px) {
  .slide-in-panel-enter-from,
  .slide-in-panel-leave-to {
    transform: translateX(100%);
    opacity: 0.85;
  }
}
</style>
