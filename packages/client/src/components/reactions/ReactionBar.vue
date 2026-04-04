<script setup lang="ts">
import { REACTION_EMOJI_ALLOWLIST } from "@mahjong-game/shared";

defineProps<{
  onReact: (emoji: string) => void;
  /** Vertical stack (desktop) vs horizontal row (mobile). */
  layout: "vertical" | "horizontal";
}>();

const ARIA_LABEL: Record<string, string> = {
  "👍": "React with thumbs up",
  "😂": "React with laughing face",
  "😩": "React with weary face",
  "😮": "React with surprised face",
  "🎉": "React with party popper",
  "😢": "React with crying face",
};
</script>

<template>
  <div
    class="reaction-bar flex gap-1"
    :class="layout === 'vertical' ? 'flex-col items-center' : 'flex-row flex-wrap justify-center'"
    role="group"
    aria-label="Quick reactions"
  >
    <button
      v-for="emoji in REACTION_EMOJI_ALLOWLIST"
      :key="emoji"
      type="button"
      class="min-h-10 min-w-10 rounded-md border border-chrome-border/60 bg-chrome-surface/80 text-xl leading-none text-text-primary hover:bg-chrome-surface focus-visible:focus-ring-on-felt md:focus-visible:focus-ring-on-chrome"
      :aria-label="ARIA_LABEL[emoji] ?? `React with emoji`"
      @click="onReact(emoji)"
    >
      {{ emoji }}
    </button>
  </div>
</template>
