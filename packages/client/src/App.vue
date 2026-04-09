<script setup lang="ts">
import { computed, watchEffect } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { usePreferencesStore } from "./stores/preferences";
import FirstVisitEntrance from "./components/shared/FirstVisitEntrance.vue";
// Global SVG symbols for tile faces; Tile.vue resolves <use href="#id"> against the document.
import TileSprite from "./components/tiles/TileSprite.vue";

const prefsStore = usePreferencesStore();
const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
const isDark = computed(
  () => prefsStore.darkMode === "dark" || (prefsStore.darkMode === "auto" && systemDark.value),
);

watchEffect(() => {
  document.documentElement.classList.toggle("theme-dark", isDark.value);
});
</script>

<template>
  <FirstVisitEntrance />
  <TileSprite />
  <RouterView />
</template>
