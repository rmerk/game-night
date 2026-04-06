<script setup lang="ts">
const props = defineProps<{
  initial: string;
  label: string;
}>();
</script>

<template>
  <div
    data-testid="avatar-fallback"
    class="flex h-full w-full items-center justify-center rounded-full bg-chrome-surface text-text-on-felt"
    :aria-label="props.label"
  >
    <span class="text-4 font-semibold md:text-5 lg:text-6">{{ props.initial }}</span>
  </div>
</template>
