<script setup lang="ts">
import type { HandPattern } from "@mahjong-game/shared";
import { GROUP_SIZES } from "@mahjong-game/shared";
import Tile from "../tiles/Tile.vue";
import { displayItemsForGroup, groupTypeLabel } from "./nmjl-display-tiles";

const props = defineProps<{
  hand: HandPattern;
}>();

function jokerLabel(eligible: boolean): string {
  return eligible ? "Joker OK" : "No joker";
}
</script>

<template>
  <div
    class="flex flex-col gap-4 border-t border-chrome-border pt-4"
    data-testid="hand-pattern-detail"
  >
    <div class="flex flex-wrap items-baseline gap-2">
      <h4 class="text-interactive text-4.5 font-semibold">
        {{ hand.name ?? hand.id }}
      </h4>
      <span class="rounded bg-gold-accent/20 px-2 py-0.5 text-3 font-medium text-text-primary">
        {{ hand.points }} pts
      </span>
      <span
        class="rounded border border-chrome-border bg-chrome-surface px-2 py-0.5 text-3 text-text-secondary"
      >
        {{ hand.exposure === "C" ? "Concealed" : "Exposed" }}
      </span>
    </div>

    <div class="flex flex-col gap-3">
      <div
        v-for="(group, gIdx) in hand.groups"
        :key="`${hand.id}-detail-g-${gIdx}`"
        class="rounded-md border border-chrome-border bg-chrome-surface/80 p-3"
      >
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span class="text-3.5 font-medium text-text-primary">
            {{ groupTypeLabel(group.type) }} · {{ GROUP_SIZES[group.type] }} tiles
          </span>
          <span class="text-3 text-text-secondary">{{ jokerLabel(group.jokerEligible) }}</span>
        </div>
        <div class="flex flex-wrap items-end gap-1">
          <template
            v-for="(item, i) in displayItemsForGroup(group, hand.id, gIdx)"
            :key="`${hand.id}-d-${gIdx}-${i}`"
          >
            <Tile
              v-if="item.kind === 'tile'"
              :tile="item.tile"
              size="standard"
              :interactive="false"
            />
            <span
              v-else
              class="rounded border border-chrome-border bg-chrome-elevated px-2 py-1 text-3.5 text-text-primary"
            >
              {{ item.text }}
            </span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
