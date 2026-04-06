<script setup lang="ts">
import type { HandPattern } from "@mahjong-game/shared";
import Tile from "../tiles/Tile.vue";
import { displayItemsForGroup, groupTypeLabel } from "./nmjl-display-tiles";

defineProps<{
  hand: HandPattern;
}>();
</script>

<template>
  <div class="flex flex-col gap-1.5" data-testid="hand-pattern-notation">
    <div
      v-for="(group, gIdx) in hand.groups"
      :key="`${hand.id}-g-${gIdx}`"
      class="flex flex-wrap items-end gap-1"
    >
      <span
        class="min-w-[2rem] text-3 font-medium text-text-secondary"
        :title="`Group type: ${group.type}`"
      >
        {{ groupTypeLabel(group.type) }}
      </span>
      <div class="flex flex-wrap items-end gap-0.5">
        <template
          v-for="(item, i) in displayItemsForGroup(group, hand.id, gIdx)"
          :key="`${hand.id}-${gIdx}-${i}`"
        >
          <Tile v-if="item.kind === 'tile'" :tile="item.tile" size="small" :interactive="false" />
          <span
            v-else
            class="rounded border border-chrome-border bg-chrome-surface px-1.5 py-0.5 text-3 text-text-primary"
          >
            {{ item.text }}
          </span>
        </template>
      </div>
    </div>
  </div>
</template>
