<script setup lang="ts">
import { computed, useId } from "vue";

const props = withDefaults(
  defineProps<{
    modelValue: number;
    min: number;
    max: number;
    step?: number;
    disabled?: boolean;
    ariaLabel?: string;
    label?: string;
  }>(),
  {
    step: 1,
    disabled: false,
    ariaLabel: undefined,
    label: undefined,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

const baseId = useId();

const clamped = computed(() => Math.min(props.max, Math.max(props.min, props.modelValue)));

function setValue(next: number) {
  if (props.disabled) return;
  const stepped = props.min + Math.round((next - props.min) / props.step) * props.step;
  const v = Math.min(props.max, Math.max(props.min, stepped));
  emit("update:modelValue", v);
}

function increment() {
  setValue(clamped.value + props.step);
}

function decrement() {
  setValue(clamped.value - props.step);
}

function onKeydown(ev: KeyboardEvent) {
  if (props.disabled) return;
  if (ev.key === "ArrowUp") {
    ev.preventDefault();
    increment();
  } else if (ev.key === "ArrowDown") {
    ev.preventDefault();
    decrement();
  }
}

/** Prefer `<label for>` when `label` is set; avoid duplicating the name on the spinbutton. */
const ariaLabelResolved = computed(() => props.ariaLabel ?? (props.label ? undefined : "Number"));
</script>

<template>
  <div class="flex min-h-11 flex-col gap-1">
    <span
      v-if="label"
      :id="`${baseId}-label`"
      class="text-interactive text-4.5 font-semibold leading-tight text-text-primary"
    >
      {{ label }}
    </span>
    <div
      :id="`${baseId}-spin`"
      role="spinbutton"
      class="flex min-h-11 items-stretch gap-2 rounded-md border border-chrome-border bg-chrome-surface focus-within:focus-ring-on-chrome"
      :aria-valuenow="clamped"
      :aria-valuemin="min"
      :aria-valuemax="max"
      :aria-label="ariaLabelResolved"
      :aria-labelledby="label ? `${baseId}-label` : undefined"
      :aria-disabled="disabled"
      :tabindex="disabled ? -1 : 0"
      @keydown="onKeydown"
    >
      <button
        type="button"
        class="min-h-11 min-w-11 shrink-0 rounded-l-md border-r border-chrome-border bg-chrome-surface px-2 text-interactive text-4.5 font-semibold text-gold-accent hover:bg-chrome-surface/80 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="disabled || clamped <= min"
        aria-label="Decrease"
        @click="decrement"
      >
        −
      </button>
      <span
        class="flex min-w-[3rem] flex-1 items-center justify-center text-center text-interactive text-4.5 font-semibold tabular-nums text-text-primary"
      >
        {{ clamped }}
      </span>
      <button
        type="button"
        class="min-h-11 min-w-11 shrink-0 rounded-r-md border-l border-chrome-border bg-chrome-surface px-2 text-interactive text-4.5 font-semibold text-gold-accent hover:bg-chrome-surface/80 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="disabled || clamped >= max"
        aria-label="Increase"
        @click="increment"
      >
        +
      </button>
    </div>
    <slot />
  </div>
</template>
