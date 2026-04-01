<script setup lang="ts">
import BasePanel from "../ui/BasePanel.vue";
import { formatSignedNumber } from "./format-signed-number";

const props = defineProps<{
  playerNamesById: Record<string, string>;
  playerOrder: string[];
  sessionScores: Record<string, number>;
}>();
</script>

<template>
  <section class="flex w-full flex-col gap-2">
    <h3 class="text-4 font-semibold text-text-on-felt">Session totals</h3>
    <ul class="grid gap-2 md:grid-cols-2">
      <BasePanel
        v-for="playerId in props.playerOrder"
        :key="playerId"
        tag="li"
        variant="dark-muted"
        class="flex items-center justify-between rounded-lg px-3 py-2"
      >
        <span>{{ props.playerNamesById[playerId] ?? playerId }}</span>
        <span class="font-semibold">{{
          formatSignedNumber(props.sessionScores[playerId] ?? 0)
        }}</span>
      </BasePanel>
    </ul>
  </section>
</template>
