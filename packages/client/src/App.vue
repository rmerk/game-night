<script setup lang="ts">
import { computed, watchEffect } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { usePreferencesStore } from "./stores/preferences";

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
  <RouterView />
</template>
