<script setup lang="ts">
import { computed } from "vue";

type BasePanelVariant = "dark-raised" | "dark-muted" | "chrome-raised";

const props = withDefaults(
  defineProps<{
    variant?: BasePanelVariant;
    tag?: string;
  }>(),
  {
    variant: "dark-raised",
    tag: "div",
  },
);

const variantClasses: Record<BasePanelVariant, string> = {
  "dark-raised": "bg-chrome-surface-dark/85 text-text-on-felt shadow-panel",
  "dark-muted": "bg-chrome-surface-dark/50 text-text-on-felt",
  "chrome-raised": "bg-chrome-surface/85 text-text-primary shadow-panel",
};

const panelClasses = computed(() => variantClasses[props.variant]);
</script>

<template>
  <component :is="tag" :class="panelClasses">
    <slot />
  </component>
</template>
