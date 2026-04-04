<script setup lang="ts">
defineProps<{
  emoji: string;
  playerName?: string;
}>();
</script>

<template>
  <div
    class="reaction-bubble inline-flex max-w-[10rem] flex-col items-center rounded-lg border border-chrome-border/80 bg-chrome-surface/95 px-2 py-1 text-center shadow-tile backdrop-blur-sm"
    role="status"
  >
    <span class="text-2xl leading-none" aria-hidden="true">{{ emoji }}</span>
    <span v-if="playerName" class="mt-0.5 max-w-full truncate text-2.5 text-text-secondary">
      {{ playerName }}
    </span>
  </div>
</template>

