<script setup lang="ts">
import { computed } from "vue";
import type { PlayerCharlestonView, Tile } from "@mahjong-game/shared";
import BaseButton from "../ui/BaseButton.vue";
import BaseBadge from "../ui/BaseBadge.vue";

const props = defineProps<{
  charleston: PlayerCharlestonView;
  myRack: Tile[];
  selectedTileIds: Set<string>;
  isComplete: boolean;
  progressText: string;
}>();

const emit = defineEmits<{
  /** Parent submits `confirmedIds` from `useTileSelection` — zone only signals intent. */
  pass: [];
}>();

const directionLabel = computed(() => {
  const d = props.charleston.currentDirection;
  if (d === null) {
    return null;
  }
  if (d === "right") {
    return "Right →";
  }
  if (d === "left") {
    return "← Left";
  }
  return "↕ Across";
});

const showBlindHint = computed(
  () => props.charleston.myHiddenTileCount > 0 && !props.charleston.mySubmissionLocked,
);

const passDisabled = computed(() => !props.isComplete || props.charleston.mySubmissionLocked);

function onPass() {
  if (passDisabled.value) {
    return;
  }
  emit("pass");
}
</script>

<template>
  <div
    data-testid="charleston-zone"
    class="charleston-zone flex max-w-md flex-col items-center gap-3 rounded-lg border border-chrome-border bg-chrome-surface/90 px-4 py-4 text-center shadow-panel"
    :data-charleston-rack-tiles="myRack.length"
  >
    <div
      v-if="directionLabel"
      data-testid="charleston-direction"
      class="text-game-critical text-text-primary"
    >
      Pass {{ directionLabel }}
    </div>

    <div
      v-if="showBlindHint"
      data-testid="charleston-blind-hint"
      class="flex flex-col items-center gap-2 rounded-md bg-chrome-elevated/80 px-3 py-2 text-3.5 text-text-primary"
    >
      <span>Select tiles to pass before seeing received tiles</span>
      <BaseBadge variant="pill" tone="warning" class="text-text-primary">
        {{ charleston.myHiddenTileCount }} hidden
      </BaseBadge>
    </div>

    <template v-if="charleston.mySubmissionLocked">
      <p data-testid="charleston-waiting" class="text-interactive text-text-primary">
        Waiting for other players…
      </p>
    </template>
    <template v-else>
      <p data-testid="charleston-progress" class="text-body text-text-secondary">
        {{ progressText }}
      </p>
      <BaseButton
        data-testid="charleston-pass-btn"
        variant="primary"
        :disabled="passDisabled"
        aria-label="Pass selected tiles"
        @click="onPass"
      >
        Pass
      </BaseButton>
    </template>
  </div>
</template>
