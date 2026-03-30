<script setup lang="ts">
import { RouterLink } from "vue-router";
import { devShowcaseDefs } from "../dev-showcase-routes";
import { includeDevPages } from "../include-dev-pages";

const showDevEntry = includeDevPages();
</script>

<template>
  <main
    class="mx-auto flex max-w-lg flex-col justify-center gap-6 px-4 py-12 min-h-screen text-center sm:text-left"
  >
    <div class="flex flex-col gap-2">
      <h1 class="text-4xl font-bold">Mahjong Night</h1>
      <p v-if="showDevEntry" class="text-stone-600 dark:text-stone-400 text-sm leading-relaxed">
        This preview build ships developer showcases (UI experiments and a local engine demo). There
        is no public lobby or multiplayer matchmaking here yet — run
        <code class="rounded bg-stone-200 px-1 py-0.5 text-xs dark:bg-stone-700">vp dev</code>
        locally for full development.
      </p>
      <p v-else class="text-stone-600 dark:text-stone-400 text-sm leading-relaxed">
        Playable client and online rooms are still in development.
      </p>
    </div>

    <section
      v-if="showDevEntry"
      class="flex flex-col gap-3 border-t border-stone-200 pt-6 dark:border-stone-700"
    >
      <h2 class="text-sm font-semibold uppercase tracking-wide text-stone-500">Dev showcases</h2>
      <ul class="flex flex-col gap-3 text-left">
        <li v-for="d in devShowcaseDefs" :key="d.path">
          <RouterLink
            :to="d.path"
            class="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {{ d.label }}
          </RouterLink>
          <p class="text-stone-600 dark:text-stone-400 mt-0.5 text-xs leading-relaxed">
            {{ d.blurb }}
          </p>
        </li>
      </ul>
    </section>
  </main>
</template>
