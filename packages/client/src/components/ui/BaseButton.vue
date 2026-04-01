<script setup lang="ts">
import { computed, useTemplateRef } from "vue";

type BaseButtonVariant = "primary" | "urgent" | "secondary" | "subtle-danger";

const props = withDefaults(
  defineProps<{
    variant?: BaseButtonVariant;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
  }>(),
  {
    variant: "primary",
    type: "button",
    disabled: false,
  },
);

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const buttonRef = useTemplateRef<HTMLButtonElement>("button");

const variantClasses: Record<BaseButtonVariant, string> = {
  primary:
    "bg-gold-accent text-text-primary text-game-critical shadow-tile hover:bg-gold-accent-hover focus-visible:focus-ring-on-felt",
  urgent:
    "bg-state-call-window text-white text-game-critical shadow-tile hover:brightness-110 focus-visible:focus-ring-on-felt",
  secondary:
    "bg-chrome-surface border border-chrome-border text-text-primary text-interactive shadow-tile hover:brightness-110 focus-visible:focus-ring-on-felt",
  "subtle-danger":
    "border border-state-error text-state-error text-interactive hover:bg-state-error/10 focus-visible:focus-ring-on-felt",
};

const buttonClasses = computed(() => `min-h-11 px-6 rounded-md ${variantClasses[props.variant]}`);

function focus() {
  buttonRef.value?.focus();
}

defineExpose({
  focus,
  element: buttonRef,
});
</script>

<template>
  <button
    ref="button"
    :type="type"
    :disabled="disabled"
    :class="buttonClasses"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>
