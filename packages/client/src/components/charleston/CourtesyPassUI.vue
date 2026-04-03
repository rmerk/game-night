<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { PlayerCharlestonView } from "@mahjong-game/shared";
import BaseButton from "../ui/BaseButton.vue";

const props = defineProps<{
  charleston: PlayerCharlestonView;
  selectedTileIds: Set<string>;
  isComplete: boolean;
  progressText: string;
}>();

const emit = defineEmits<{
  "courtesy-pass": [count: number, tileIds: string[]];
  "count-change": [count: number];
}>();

const selectedCount = ref(0);

watch(
  () => props.charleston.status,
  () => {
    selectedCount.value = 0;
  },
);

function pickCount(n: number) {
  if (props.charleston.mySubmissionLocked) {
    return;
  }
  if (selectedCount.value !== n) {
    selectedCount.value = n;
    emit("count-change", n);
  }
}

function skipCourtesy() {
  if (props.charleston.mySubmissionLocked) {
    return;
  }
  emit("courtesy-pass", 0, []);
}

function submitCourtesy() {
  if (props.charleston.mySubmissionLocked || selectedCount.value <= 0) {
    return;
  }
  emit("courtesy-pass", selectedCount.value, [...props.selectedTileIds]);
}

const passDisabled = computed(() => !props.isComplete || props.charleston.mySubmissionLocked);

const countOptions = [0, 1, 2, 3] as const;
</script>

<template>
  <div
    data-testid="courtesy-pass-ui"
    class="courtesy-pass flex max-w-md flex-col items-center gap-3 rounded-lg border border-chrome-border bg-chrome-surface/90 px-4 py-4 text-center shadow-panel"
  >
    <p class="text-interactive text-text-primary">Courtesy pass</p>

    <div class="flex flex-wrap justify-center gap-2" role="group" aria-label="Courtesy tile count">
      <BaseButton
        v-for="n in countOptions"
        :key="n"
        :data-testid="`courtesy-count-${n}`"
        :variant="selectedCount === n ? 'primary' : 'secondary'"
        :disabled="charleston.mySubmissionLocked"
        @click="pickCount(n)"
      >
        {{ n }}
      </BaseButton>
    </div>

    <template v-if="charleston.mySubmissionLocked">
      <p data-testid="courtesy-waiting" class="text-interactive text-text-primary">
        Waiting for other players…
      </p>
    </template>
    <template v-else-if="selectedCount === 0">
      <BaseButton
        data-testid="courtesy-skip"
        variant="secondary"
        aria-label="Skip courtesy pass"
        @click="skipCourtesy"
      >
        Skip courtesy pass
      </BaseButton>
    </template>
    <template v-else>
      <p data-testid="courtesy-progress" class="text-body text-text-secondary">
        {{ progressText }}
      </p>
      <BaseButton
        data-testid="courtesy-submit"
        variant="primary"
        :disabled="passDisabled"
        aria-label="Submit courtesy pass"
        @click="submitCourtesy"
      >
        Pass
      </BaseButton>
    </template>
  </div>
</template>
