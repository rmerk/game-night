<script setup lang="ts">
import { ref } from "vue";

// Duplicated from GameTable.vue — acceptable for a dev showcase component (static string constant)
const feltGrainBgImage =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23noise)' opacity='0.07'/%3E%3C/svg%3E\")";

import BaseBadge from "../ui/BaseBadge.vue";
import BaseButton from "../ui/BaseButton.vue";
import BasePanel from "../ui/BasePanel.vue";
import BaseToast from "../ui/BaseToast.vue";
import { themeColors } from "../../styles/design-tokens";

const currentMood = ref<string>("mood-playing");
const darkMode = ref(false);

function setMood(mood: string) {
  currentMood.value = mood;
  document.documentElement.classList.remove("mood-arriving", "mood-playing", "mood-lingering");
  document.documentElement.classList.add(mood);
}

function toggleDark() {
  darkMode.value = !darkMode.value;
  document.documentElement.classList.toggle("theme-dark", darkMode.value);
}

type ColorGroup = Record<string, string>;

const colorGroups: Record<string, ColorGroup> = {
  Felt: themeColors.felt,
  Chrome: themeColors.chrome,
  Gold: themeColors.gold,
  Suit: themeColors.suit,
  Text: themeColors.text,
  State: themeColors.state,
  Wall: themeColors.wall,
  Guidance: themeColors.guidance,
  Celebration: themeColors.celebration,
  Focus: themeColors.focus,
};

const typographyRoles = [
  { name: "text-game-critical", label: "Game Critical", desc: "20px / semibold" },
  { name: "text-interactive", label: "Interactive", desc: "18px / semibold" },
  { name: "text-body", label: "Body", desc: "16px / regular" },
  { name: "text-card-pattern", label: "Card Pattern", desc: "16px / monospace" },
  { name: "text-secondary", label: "Secondary", desc: "14px / regular" },
];

const spacingScale = [
  { key: "1", value: "4px" },
  { key: "2", value: "8px" },
  { key: "3", value: "12px" },
  { key: "4", value: "16px" },
  { key: "6", value: "24px" },
  { key: "8", value: "32px" },
  { key: "12", value: "48px" },
  { key: "16", value: "64px" },
  { key: "24", value: "96px" },
];

const radiusScale = [
  { key: "sm", value: "4px" },
  { key: "md", value: "8px" },
  { key: "lg", value: "12px" },
  { key: "full", value: "9999px" },
];

const moods = ["mood-arriving", "mood-playing", "mood-lingering"];
</script>

<template>
  <div class="p-8 max-w-6xl mx-auto">
    <h1 class="text-8 font-bold mb-8">Design System Showcase</h1>

    <!-- Color Swatches -->
    <section class="mb-12">
      <h2 class="text-6 font-semibold mb-4">Color Tokens</h2>
      <div v-for="(colors, group) in colorGroups" :key="group" class="mb-6">
        <h3 class="text-4.5 font-semibold mb-2">{{ group }}</h3>
        <div class="flex flex-wrap gap-3">
          <div v-for="(hex, name) in colors" :key="name" class="flex flex-col items-center">
            <div
              class="w-16 h-16 rounded-md shadow-tile border border-chrome-border"
              :style="{ backgroundColor: hex }"
            />
            <span class="text-secondary mt-1">{{ group.toLowerCase() }}-{{ name }}</span>
            <span class="text-3.5 text-text-secondary">{{ hex }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Typography Roles -->
    <section class="mb-12">
      <h2 class="text-6 font-semibold mb-4">Typography Roles</h2>
      <div class="flex flex-col gap-4">
        <div
          v-for="role in typographyRoles"
          :key="role.name"
          class="flex items-baseline gap-4 p-3 bg-chrome-surface rounded-md"
        >
          <span :class="role.name" class="flex-1">
            The quick brown fox jumps over the lazy dog
          </span>
          <code class="text-secondary">{{ role.name }}</code>
          <span class="text-secondary">{{ role.desc }}</span>
        </div>
      </div>
    </section>

    <!-- Spacing Scale -->
    <section class="mb-12">
      <h2 class="text-6 font-semibold mb-4">Spacing Scale (4px base)</h2>
      <div class="flex flex-col gap-2">
        <div v-for="space in spacingScale" :key="space.key" class="flex items-center gap-4">
          <code class="text-secondary w-16">p-{{ space.key }}</code>
          <div class="bg-gold-accent h-4" :style="{ width: space.value }" />
          <span class="text-secondary">{{ space.value }}</span>
        </div>
      </div>
    </section>

    <!-- Border Radius -->
    <section class="mb-12">
      <h2 class="text-6 font-semibold mb-4">Border Radius</h2>
      <div class="flex gap-6">
        <div v-for="r in radiusScale" :key="r.key" class="flex flex-col items-center gap-2">
          <div class="w-16 h-16 bg-felt-teal" :class="`rounded-${r.key}`" />
          <code class="text-secondary">rounded-{{ r.key }}</code>
          <span class="text-3.5 text-text-secondary">{{ r.value }}</span>
        </div>
      </div>
    </section>

    <!-- Shadows -->
    <section class="mb-12">
      <h2 class="text-6 font-semibold mb-4">Shadows</h2>
      <div class="flex gap-8">
        <div class="flex flex-col items-center gap-2">
          <div class="w-24 h-16 bg-chrome-surface rounded-md shadow-tile" />
          <code class="text-secondary">shadow-tile</code>
        </div>
        <div class="flex flex-col items-center gap-2">
          <div class="w-24 h-16 bg-chrome-surface rounded-md shadow-panel" />
          <code class="text-secondary">shadow-panel</code>
        </div>
        <div class="flex flex-col items-center gap-2">
          <div class="w-24 h-16 bg-chrome-surface rounded-md shadow-modal" />
          <code class="text-secondary">shadow-modal</code>
        </div>
      </div>
    </section>

    <!-- Focus Rings -->
    <section class="mb-12">
      <h2 class="text-6 font-semibold mb-4">Focus Rings</h2>
      <div class="flex gap-8">
        <div class="flex flex-col items-center gap-2">
          <button class="min-tap bg-chrome-surface rounded-md focus-ring-on-chrome">Chrome</button>
          <code class="text-secondary">focus-ring-on-chrome</code>
        </div>
        <div class="flex flex-col items-center gap-2">
          <button class="min-tap bg-felt-teal text-text-on-felt rounded-md focus-ring-on-felt">
            Felt
          </button>
          <code class="text-secondary">focus-ring-on-felt</code>
        </div>
        <div class="flex flex-col items-center gap-2">
          <button
            class="min-tap bg-chrome-surface-dark text-text-on-dark rounded-md focus-ring-on-dark"
          >
            Dark
          </button>
          <code class="text-secondary">focus-ring-on-dark</code>
        </div>
      </div>
    </section>

    <!-- Shared Primitives -->
    <section class="mb-12">
      <h2 class="text-6 font-semibold mb-4">Shared Primitives</h2>
      <div class="mb-6 flex flex-wrap items-center gap-3">
        <BaseButton variant="primary">Mahjong</BaseButton>
        <BaseButton variant="urgent">Call Pung</BaseButton>
        <BaseButton variant="secondary">Pass</BaseButton>
        <BaseButton variant="subtle-danger" class="px-4">Cancel</BaseButton>
      </div>

      <div class="mb-6 grid gap-4 md:grid-cols-3">
        <BasePanel variant="dark-raised" class="rounded-xl p-4">
          <p class="text-4.5 font-semibold">Dark Raised Panel</p>
          <p class="text-secondary">Scoreboard and status-shell surface treatment.</p>
        </BasePanel>
        <BasePanel variant="dark-muted" class="rounded-lg p-4">
          <p class="text-4.5 font-semibold">Dark Muted Panel</p>
          <p class="text-secondary">Score rows and quieter secondary surfaces.</p>
        </BasePanel>
        <BasePanel variant="chrome-raised" class="rounded-xl p-4">
          <p class="text-4.5 font-semibold">Chrome Raised Panel</p>
          <p class="text-secondary">Mobile control shell treatment.</p>
        </BasePanel>
      </div>

      <div class="mb-6 flex flex-wrap items-center gap-3">
        <BaseBadge variant="pill" tone="active" class="text-text-on-felt">Current turn</BaseBadge>
        <BaseBadge variant="wall-counter" tone="warning" class="px-4 py-2 text-game-critical">
          Wall: 20
        </BaseBadge>
        <span class="inline-flex items-center gap-2">
          <BaseBadge variant="status-dot" tone="success" aria-label="Connected" />
          <span class="text-secondary">Connected seat</span>
        </span>
        <span class="inline-flex items-center gap-2">
          <BaseBadge variant="status-dot" tone="muted" aria-label="Disconnected" />
          <span class="text-secondary">Disconnected seat</span>
        </span>
      </div>

      <BaseToast visible class="max-w-md">
        <span class="flex-1">Invalid Mahjong declaration.</span>
        <BaseButton variant="subtle-danger" class="px-4">Cancel</BaseButton>
      </BaseToast>
    </section>

    <!-- Animation Timing -->
    <section class="mb-12">
      <h2 class="text-6 font-semibold mb-4">Animation Timing Tokens</h2>
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-4">
          <code class="text-secondary w-48">--timing-tactile</code>
          <span>120ms, ease-out</span>
          <span class="text-text-secondary">(tile lift, button press, rack snap)</span>
        </div>
        <div class="flex items-center gap-4">
          <code class="text-secondary w-48">--timing-expressive</code>
          <span>400ms, cubic-bezier</span>
          <span class="text-text-secondary">(celebration, mood crossfade)</span>
        </div>
        <div class="flex items-center gap-4">
          <code class="text-secondary w-48">--timing-entrance</code>
          <span>200ms, ease-out</span>
          <span class="text-text-secondary">(element entry)</span>
        </div>
        <div class="flex items-center gap-4">
          <code class="text-secondary w-48">--timing-exit</code>
          <span>150ms, ease-in</span>
          <span class="text-text-secondary">(element exit)</span>
        </div>
      </div>
    </section>

    <!-- Felt Grain Overlay Preview (AC 1) -->
    <section class="mb-12">
      <h2 class="text-6 font-semibold mb-4">Felt Grain Overlay (AC 1)</h2>
      <p class="text-3.5 text-text-secondary mb-4">
        CSS SVG feTurbulence grain on felt-teal surface. Visible during Playing mood.
      </p>
      <div class="relative w-full h-32 rounded-lg bg-felt-teal overflow-hidden">
        <div
          aria-hidden="true"
          class="pointer-events-none absolute inset-0 z-0 opacity-50 mix-blend-overlay bg-[length:200px_200px]"
          :style="{ backgroundImage: feltGrainBgImage }"
        />
        <div
          class="relative z-1 flex h-full items-center justify-center text-text-on-felt text-3.5"
        >
          Felt surface with grain texture
        </div>
      </div>
    </section>

    <!-- Mood Switching -->
    <section class="mb-12">
      <h2 class="text-6 font-semibold mb-4">Mood Switching</h2>
      <div class="flex gap-4 mb-4">
        <button
          v-for="mood in moods"
          :key="mood"
          class="min-tap px-4 py-2 rounded-md text-interactive"
          :class="currentMood === mood ? 'bg-gold-accent text-text-primary' : 'bg-chrome-surface'"
          @click="setMood(mood)"
        >
          {{ mood.replace("mood-", "") }}
        </button>
      </div>
      <div class="p-6 rounded-lg" :style="{ backgroundColor: 'var(--mood-surface)' }">
        <p class="text-body">
          Current mood: <strong>{{ currentMood }}</strong>
        </p>
        <div class="mt-2 flex gap-4">
          <div class="p-3 rounded-md" :style="{ backgroundColor: 'var(--mood-emphasis)' }">
            <span class="text-secondary">--mood-emphasis</span>
          </div>
          <div class="p-3 rounded-md" :style="{ backgroundColor: 'var(--mood-gold-temp)' }">
            <span class="text-secondary">--mood-gold-temp</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Celebration Overlay Preview (AC 3) -->
    <section class="mb-12">
      <h2 class="text-6 font-semibold mb-4">Celebration Overlay</h2>
      <p class="text-3.5 text-text-secondary mb-4">
        Visual QA for celebration states. Note: element-opacity dimming reduces opponent text to
        ~1.71:1 contrast (below WCAG AA 4.5:1). Per story Dev Notes, text in dimmed opponent areas
        is decorative context during celebration — the spotlight is the focus.
      </p>

      <!-- Dimmed opponent area preview -->
      <div class="mb-6">
        <h3 class="text-4.5 font-semibold mb-2 text-text-muted">
          Dimmed Opponent Area (22% opacity)
        </h3>
        <div class="relative bg-felt-teal p-4 rounded-xl">
          <div
            class="opacity-[0.22] bg-chrome-surface-dark/25 rounded-xl px-2 py-1 inline-flex flex-col items-center gap-1"
          >
            <span class="text-3.5 text-text-on-felt font-medium">Alice</span>
            <span class="text-3 text-text-on-felt/85">Score: 150</span>
          </div>
          <span class="ml-4 text-3.5 text-text-on-felt/60 italic">
            ← text is decorative context at this opacity
          </span>
        </div>
      </div>

      <!-- Spotlight preview -->
      <div class="mb-6">
        <h3 class="text-4.5 font-semibold mb-2 text-text-muted">Winner Spotlight</h3>
        <div class="bg-celebration-dim p-6 rounded-xl text-center">
          <p class="text-celebration-gold text-4xl font-bold">Mahjong!</p>
          <p class="text-celebration-gold text-xl mt-2">— Alice —</p>
          <p class="text-text-on-felt/80 text-sm mt-1">Even Suited Kongs · 50pts</p>
        </div>
      </div>

      <!-- Scoring layout preview -->
      <div class="mb-6">
        <h3 class="text-4.5 font-semibold mb-2 text-text-muted">Scoring Overlay</h3>
        <div class="bg-celebration-dim/80 rounded-xl p-4">
          <ul class="space-y-2">
            <li class="flex justify-between text-text-on-felt">
              <span>Bob</span><span class="text-red-400">-25</span>
            </li>
            <li class="flex justify-between text-text-on-felt">
              <span>Carol</span><span class="text-red-400">-25</span>
            </li>
            <li class="flex justify-between text-text-on-felt">
              <span>Dave</span><span class="text-red-400">-50</span>
            </li>
            <li class="flex justify-between text-text-on-felt">
              <span>Alice</span><span class="text-green-400">+100</span>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Dark Mode Toggle -->
    <section class="mb-12">
      <h2 class="text-6 font-semibold mb-4">Dark Mode</h2>
      <button
        class="min-tap px-4 py-2 rounded-md text-interactive bg-chrome-surface"
        @click="toggleDark()"
      >
        {{ darkMode ? "Switch to Light" : "Switch to Dark" }}
      </button>
      <p class="text-secondary mt-2">
        Toggles .theme-dark class on root element. System preference (prefers-color-scheme) also
        triggers dark mode automatically.
      </p>
    </section>
  </div>
</template>
