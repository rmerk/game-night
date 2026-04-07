<script setup lang="ts">
import BaseButton from "../ui/BaseButton.vue";

const props = defineProps<{
  selectedTileId: string | null;
  isPlayerTurn: boolean;
}>();

const emit = defineEmits<{
  discard: [tileId: string];
}>();

function handleDiscard() {
  if (props.selectedTileId) {
    emit("discard", props.selectedTileId);
  }
}
</script>

<template>
  <BaseButton
    v-if="selectedTileId !== null && isPlayerTurn"
    data-testid="discard-confirm"
    aria-label="Discard selected tile"
    variant="primary"
    @click="handleDiscard"
  >
    Discard
  </BaseButton>
</template>
