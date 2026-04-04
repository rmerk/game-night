<script setup lang="ts">
/**
 * Dev-only reference for Story 3C.2 — Joker rules mode protocol (no production lobby yet).
 * Production UI can send SET_JOKER_RULES and read LobbyState.jokerRulesMode / PlayerGameView.jokerRulesMode.
 */
import type { JokerRulesMode } from "@mahjong-game/shared";

const modes: JokerRulesMode[] = ["standard", "simplified"];
</script>

<template>
  <div class="max-w-3xl mx-auto p-6 space-y-4 text-left">
    <h1 class="text-xl font-semibold">Joker rules mode</h1>
    <p class="text-sm text-slate-600">
      Host sets the mode for the <strong>next</strong> game via WebSocket (lobby only). The server
      injects <code>jokerRulesMode</code> into <code>START_GAME</code>; clients must not rely on a
      mode field inside the <code>ACTION</code> payload for authority.
    </p>
    <section class="space-y-2">
      <h2 class="font-medium">Client → server</h2>
      <pre class="text-xs bg-slate-100 p-3 rounded overflow-x-auto">
{ "version": 1, "type": "SET_JOKER_RULES", "jokerRulesMode": "standard" | "simplified" }</pre
      >
    </section>
    <section class="space-y-2">
      <h2 class="font-medium">Modes</h2>
      <ul class="list-disc pl-5 text-sm">
        <li v-for="m in modes" :key="m">
          <code>{{ m }}</code>
        </li>
      </ul>
    </section>
  </div>
</template>
