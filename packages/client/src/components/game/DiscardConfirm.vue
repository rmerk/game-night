<script setup lang="ts">
const props = defineProps<{
  selectedTileId: string | null;
  isPlayerTurn: boolean;
}>();

const emit = defineEmits<{
  discard: [tileId: string];
}>();

function handleDiscard() {
  if (props.selectedTileId) {
    // TODO: audioStore.play('tile-discard')
    emit("discard", props.selectedTileId);
  }
}
</script>

<template>
  <button
    v-if="selectedTileId !== null && isPlayerTurn"
    data-testid="discard-confirm"
    class="min-h-11 px-6 rounded-md bg-gold-accent text-text-primary text-game-critical shadow-tile hover:bg-gold-accent-hover focus-visible:focus-ring-on-felt"
    aria-label="Discard selected tile"
    @click="handleDiscard"
  >
    Discard
  </button>
</template>
