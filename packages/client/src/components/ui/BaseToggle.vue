<script setup lang="ts">
import { computed, useId } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    disabled?: boolean;
    /** Accessible name when no visible label is provided */
    ariaLabel?: string;
    label?: string;
  }>(),
  {
    disabled: false,
    ariaLabel: undefined,
    label: undefined,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const switchId = useId();

/** Prefer `<label for>` when `label` is set; avoid duplicating the name on the switch. */
const ariaLabelResolved = computed(() => props.ariaLabel ?? (props.label ? undefined : "Toggle"));

function toggle() {
  if (props.disabled) return;
  emit("update:modelValue", !props.modelValue);
}

function onKeydown(ev: KeyboardEvent) {
  if (props.disabled) return;
  if (ev.key === " " || ev.key === "Enter") {
    ev.preventDefault();
    toggle();
  }
}
</script>

<template>
  <div class="flex min-h-11 items-center gap-3">
    <label
      v-if="label"
      :for="switchId"
      class="min-w-0 flex-1 text-interactive text-4.5 font-semibold leading-tight"
    >
      {{ label }}
    </label>
    <button
      :id="switchId"
      type="button"
      role="switch"
      class="relative inline-flex h-11 min-h-11 w-14 shrink-0 items-center rounded-full border-2 px-1 transition-colors focus-visible:focus-ring-on-chrome disabled:cursor-not-allowed disabled:opacity-50"
      :class="
        modelValue ? 'border-gold-accent bg-gold-accent' : 'border-chrome-border bg-chrome-surface'
      "
      :aria-checked="modelValue"
      :aria-label="ariaLabelResolved"
      :disabled="disabled"
      @click="toggle"
      @keydown="onKeydown"
    >
      <span
        class="pointer-events-none h-8 w-8 shrink-0 rounded-full bg-text-primary shadow-sm transition-transform duration-[var(--timing-tactile,120ms)] ease-out"
        :class="modelValue ? 'translate-x-4' : 'translate-x-0'"
        aria-hidden="true"
      />
    </button>
    <slot />
  </div>
</template>
