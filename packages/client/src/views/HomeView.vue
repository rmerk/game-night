<script setup lang="ts">
import { RouterLink } from 'vue-router'

const isDev = import.meta.env.DEV
</script>

<template>
  <main class="flex flex-col items-center justify-center min-h-screen gap-4">
    <h1 class="text-4xl font-bold">Mahjong Night</h1>
    <RouterLink
      v-if="isDev"
      to="/dev/harness"
      class="text-blue-600 underline text-sm"
    >
      [DEV] Open Test Harness
    </RouterLink>
  </main>
</template>
