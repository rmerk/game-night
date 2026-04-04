<script setup lang="ts">
import { computed, ref, watch } from "vue";
import BaseButton from "../ui/BaseButton.vue";

const props = withDefaults(
  defineProps<{
    isCallWindowOpen: boolean;
    hideForCallDuplication?: boolean;
    /** When true, show inline message instead of emitting (UX-DR35) */
    myDeadHand?: boolean;
  }>(),
  {
    hideForCallDuplication: false,
    myDeadHand: false,
  },
);

const emit = defineEmits<{
  declareMahjong: [];
  callMahjong: [];
}>();

const ariaLabel = computed(() => (props.isCallWindowOpen ? "Call Mahjong" : "Declare Mahjong"));

const deadHandMessageVisible = ref(false);

watch(
  () => props.myDeadHand,
  (v) => {
    if (!v) deadHandMessageVisible.value = false;
  },
);

function handleClick() {
  if (props.myDeadHand) {
    deadHandMessageVisible.value = true;
    return;
  }

  if (props.isCallWindowOpen) {
    emit("callMahjong");
    return;
  }

  emit("declareMahjong");
}
</script>

<template>
  <div class="flex flex-col items-center gap-1">
    <BaseButton
      v-show="!hideForCallDuplication"
      data-testid="mahjong-button"
      :aria-label="ariaLabel"
      variant="primary"
      @click="handleClick"
    >
      Mahjong
    </BaseButton>
    <p
      v-show="deadHandMessageVisible"
      data-testid="dead-hand-mahjong-message"
      class="max-w-xs text-center text-3 text-state-error"
      role="status"
    >
      Dead hand — cannot declare.
    </p>
  </div>
</template>
