<script setup lang="ts">
import { computed, useId } from "vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    label: string;
    /** ID for aria-controls on the toggle that opens this panel (single responsive surface). */
    contentId?: string;
    closeOnBackdrop?: boolean;
    /**
     * Mobile-only (&lt;768px): bottom sheet vs top split (Charleston NMJL — keep rack visible below).
     * Desktop/tablet uses the right rail regardless.
     */
    mobilePlacement?: "bottom" | "top";
  }>(),
  {
    closeOnBackdrop: true,
    contentId: undefined,
    mobilePlacement: "bottom",
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

const surfaceMobileClass = computed(() =>
  props.mobilePlacement === "top"
    ? "slide-in-panel__surface--mobile-top top-0 bottom-auto max-h-[58dvh] rounded-b-xl rounded-t-none"
    : "slide-in-panel__surface--mobile-bottom bottom-0 max-h-[48dvh] rounded-t-xl",
);
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
        :class="[
          'pointer-events-auto fixed inset-x-0 z-40 flex flex-col border border-chrome-border bg-chrome-elevated shadow-lg md:absolute md:inset-x-auto md:inset-y-0 md:bottom-0 md:left-auto md:right-0 md:top-0 md:z-30 md:max-h-none md:h-full md:w-[280px] md:rounded-none md:border-y-0 md:border-l md:border-r-0 md:bg-chrome-elevated/95 md:shadow-lg md:backdrop-blur-sm',
          surfaceMobileClass,
        ]"
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

@media (max-width: 767px) {
  .slide-in-panel__surface--mobile-top.slide-in-panel-enter-from,
  .slide-in-panel__surface--mobile-top.slide-in-panel-leave-to {
    transform: translateY(-100%);
  }
}

@media (min-width: 768px) {
  .slide-in-panel-enter-from,
  .slide-in-panel-leave-to {
    transform: translateX(100%);
    opacity: 0.85;
  }
}
</style>
