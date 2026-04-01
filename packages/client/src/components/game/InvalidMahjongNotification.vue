<script setup lang="ts">
import BaseButton from "../ui/BaseButton.vue";
import BaseToast from "../ui/BaseToast.vue";

defineProps<{
  visible: boolean;
  message: string;
}>();

const emit = defineEmits<{
  cancel: [];
}>();
</script>

<template>
  <BaseToast
    data-testid="invalid-mahjong-notification"
    :visible="visible"
    transition-name="invalid-mahjong"
  >
    <div class="flex items-center gap-3">
      <span class="flex-1">{{ message }}</span>
      <BaseButton
        data-testid="cancel-mahjong"
        variant="subtle-danger"
        class="px-4"
        @click="emit('cancel')"
      >
        Cancel
      </BaseButton>
    </div>
  </BaseToast>
</template>
