<script setup lang="ts">
import { useAttrs, watch } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(
  defineProps<{
    visible: boolean;
    autoDismissMs?: number | null;
    transitionName?: string;
    tag?: string;
  }>(),
  {
    autoDismissMs: null,
    transitionName: "base-toast",
    tag: "div",
  },
);

const emit = defineEmits<{
  dismiss: [];
}>();

const attrs = useAttrs();

watch(
  () => [props.visible, props.autoDismissMs] as const,
  ([visible, autoDismissMs], _previous, onCleanup) => {
    if (!visible || autoDismissMs === null) {
      return;
    }

    const timer = window.setTimeout(() => {
      emit("dismiss");
    }, autoDismissMs);

    onCleanup(() => {
      window.clearTimeout(timer);
    });
  },
  { immediate: true },
);
</script>

<template>
  <Transition :name="transitionName">
    <component
      :is="tag"
      v-if="visible"
      v-bind="attrs"
      role="status"
      aria-live="polite"
      class="flex items-center gap-3 rounded-md border border-state-error bg-state-error/10 px-4 py-3 text-state-error shadow-tile"
    >
      <slot />
    </component>
  </Transition>
</template>

<style scoped>
.base-toast-enter-active,
.invalid-mahjong-enter-active {
  transition:
    opacity var(--timing-entrance, 200ms) ease-out,
    transform var(--timing-entrance, 200ms) ease-out;
}

.base-toast-leave-active,
.invalid-mahjong-leave-active {
  transition:
    opacity var(--timing-exit, 150ms) ease-in,
    transform var(--timing-exit, 150ms) ease-in;
}

.base-toast-enter-from,
.base-toast-leave-to,
.invalid-mahjong-enter-from,
.invalid-mahjong-leave-to {
  opacity: 0;
  transform: translateY(0.25rem);
}
</style>
