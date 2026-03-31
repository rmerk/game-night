<script setup lang="ts">
defineProps<{
  visible: boolean;
  message: string;
}>();

const emit = defineEmits<{
  cancel: [];
}>();
</script>

<template>
  <Transition name="invalid-mahjong">
    <div
      v-if="visible"
      data-testid="invalid-mahjong-notification"
      role="status"
      aria-live="polite"
      class="flex items-center gap-3 rounded-md border border-state-error bg-state-error/10 px-4 py-3 text-state-error shadow-tile"
    >
      <span class="flex-1">{{ message }}</span>
      <button
        data-testid="cancel-mahjong"
        type="button"
        class="min-h-11 rounded-md border border-state-error px-4 text-interactive hover:bg-state-error/10 focus-visible:focus-ring-on-felt"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.invalid-mahjong-enter-active {
  transition:
    opacity var(--timing-entrance, 200ms) ease-out,
    transform var(--timing-entrance, 200ms) ease-out;
}

.invalid-mahjong-leave-active {
  transition:
    opacity var(--timing-exit, 150ms) ease-in,
    transform var(--timing-exit, 150ms) ease-in;
}

.invalid-mahjong-enter-from,
.invalid-mahjong-leave-to {
  opacity: 0;
  transform: translateY(0.25rem);
}
</style>
