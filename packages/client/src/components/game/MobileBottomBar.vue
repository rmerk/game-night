<script setup lang="ts"></script>

<template>
  <div
    data-testid="mobile-bottom-bar"
    class="mobile-bottom-bar flex items-center justify-around bg-chrome-surface shadow-panel px-2 py-1 pb-[env(safe-area-inset-bottom)]"
  >
    <button
      class="min-tap flex flex-col items-center justify-center text-text-on-felt/60 text-3"
      aria-label="Show NMJL card"
      disabled
    >
      <span class="text-5">🀄</span>
      <span>Card</span>
    </button>

    <button
      class="min-tap flex flex-col items-center justify-center text-text-on-felt/60 text-3"
      aria-label="Open chat"
      disabled
    >
      <span class="text-5">💬</span>
      <span>Chat</span>
    </button>

    <button
      class="min-tap flex flex-col items-center justify-center text-text-on-felt/60 text-3"
      aria-label="Audio video controls"
      disabled
    >
      <span class="text-5">🎤</span>
      <span>A/V</span>
    </button>
  </div>
</template>
