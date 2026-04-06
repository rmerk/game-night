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
    let washClass: string;
    let toneClasses: string;
    if (props.tone === "critical") {
      toneClasses = "border-wall-critical text-wall-critical";
      washClass = "wall-counter-wash-critical";
    } else if (props.tone === "warning") {
      toneClasses = "border-wall-warning text-wall-warning";
      washClass = "wall-counter-wash-warning";
    } else {
      toneClasses = "border-wall-normal text-text-on-felt";
      washClass = "wall-counter-wash-normal";
    }

    return [
      "inline-flex items-center rounded-full border bg-chrome-surface-dark/85",
      "wall-counter-tone-transition",
      washClass,
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

<style scoped>
/* Wall counter: expressive tone transitions + subtle inset wash (Epic 5B). Base panel shadow matches themeShadows.panel. */
.wall-counter-tone-transition {
  --wall-counter-panel-shadow:
    0 4px 12px rgba(107, 97, 88, 0.12), 0 2px 4px rgba(107, 97, 88, 0.08);

  transition-property: border-color, color, background-color, box-shadow;
  transition-duration: var(--timing-expressive);
  transition-timing-function: var(--ease-expressive);
}

@media (prefers-reduced-motion: reduce) {
  .wall-counter-tone-transition {
    transition-duration: 0ms;
  }
}

.wall-counter-wash-normal {
  box-shadow: var(--wall-counter-panel-shadow);
}

.wall-counter-wash-warning {
  box-shadow:
    var(--wall-counter-panel-shadow),
    inset 0 0 18px rgba(212, 168, 67, 0.18);
}

.wall-counter-wash-critical {
  box-shadow:
    var(--wall-counter-panel-shadow),
    inset 0 0 20px rgba(184, 85, 58, 0.22);
}
</style>
