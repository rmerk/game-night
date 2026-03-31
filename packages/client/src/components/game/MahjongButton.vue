<script setup lang="ts">
import { computed } from "vue";

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
  <button
    v-show="!hideForCallDuplication"
    data-testid="mahjong-button"
    :aria-label="ariaLabel"
    class="min-h-11 px-6 rounded-md bg-gold-accent text-text-primary text-game-critical shadow-tile hover:bg-gold-accent-hover focus-visible:focus-ring-on-felt"
    @click="handleClick"
  >
    Mahjong
  </button>
</template>
