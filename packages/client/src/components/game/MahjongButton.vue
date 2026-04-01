<script setup lang="ts">
import { computed } from "vue";
import BaseButton from "../ui/BaseButton.vue";

const props = withDefaults(
  defineProps<{
    isCallWindowOpen: boolean;
    hideForCallDuplication?: boolean;
  }>(),
  {
    hideForCallDuplication: false,
  },
);

const emit = defineEmits<{
  declareMahjong: [];
  callMahjong: [];
}>();

const ariaLabel = computed(() => (props.isCallWindowOpen ? "Call Mahjong" : "Declare Mahjong"));

function handleClick() {
  if (props.isCallWindowOpen) {
    emit("callMahjong");
    return;
  }

  emit("declareMahjong");
}
</script>

<template>
  <BaseButton
    v-show="!hideForCallDuplication"
    data-testid="mahjong-button"
    :aria-label="ariaLabel"
    variant="primary"
    @click="handleClick"
  >
    Mahjong
  </BaseButton>
</template>
