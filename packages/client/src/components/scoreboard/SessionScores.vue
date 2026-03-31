<script setup lang="ts">
const props = defineProps<{
  playerNamesById: Record<string, string>;
  playerOrder: string[];
  sessionScores: Record<string, number>;
}>();

function formatScore(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
</script>

<template>
  <section class="flex w-full flex-col gap-2">
    <h3 class="text-4 font-semibold text-text-on-felt">Session totals</h3>
    <ul class="grid gap-2 md:grid-cols-2">
      <li
        v-for="playerId in props.playerOrder"
        :key="playerId"
        class="flex items-center justify-between rounded-lg bg-chrome-surface-dark/50 px-3 py-2 text-text-on-felt"
      >
        <span>{{ props.playerNamesById[playerId] ?? playerId }}</span>
        <span class="font-semibold">{{ formatScore(props.sessionScores[playerId] ?? 0) }}</span>
      </li>
    </ul>
  </section>
</template>
