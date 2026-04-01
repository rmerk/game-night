<script setup lang="ts">
import { computed } from "vue";

type BaseBadgeVariant = "pill" | "wall-counter" | "status-dot";
type BaseBadgeTone = "active" | "warning" | "critical" | "success" | "muted" | "normal";

const props = withDefaults(
  defineProps<{
    variant?: BaseBadgeVariant;
    tone?: BaseBadgeTone;
    tag?: string;
  }>(),
  {
    variant: "pill",
    tone: "active",
    tag: "span",
  },
);

const badgeClasses = computed(() => {
  if (props.variant === "status-dot") {
    return [
      "inline-block h-3 w-3 rounded-full border-2 border-felt-teal",
      props.tone === "success" ? "bg-state-success" : "bg-text-secondary",
    ];
  }

  if (props.variant === "wall-counter") {
    let toneClasses: string;
    if (props.tone === "critical") {
      toneClasses = "border-wall-critical text-wall-critical";
    } else if (props.tone === "warning") {
      toneClasses = "border-wall-warning text-wall-warning";
    } else {
      toneClasses = "border-wall-normal text-text-on-felt";
    }

    return [
      "inline-flex items-center rounded-full border bg-chrome-surface-dark/85 shadow-panel",
      toneClasses,
    ];
  }

  return [
    "rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]",
    props.tone === "active" ? "bg-state-turn-active/20" : "bg-chrome-surface-dark/50",
  ];
});
</script>

<template>
  <component :is="tag" :class="badgeClasses">
    <slot />
  </component>
</template>
