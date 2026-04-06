<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { animate, prefersReducedMotion } from "motion-v";
import type { MahjongGameResult, SeatWind } from "@mahjong-game/shared";

// ---------------------------------------------------------------------------
// Props & Emits
// ---------------------------------------------------------------------------
const props = defineProps<{
  gameResult: MahjongGameResult;
  playerNamesById: Record<string, string>;
  winnerId: string;
  winnerSeat: SeatWind;
}>();

const emit = defineEmits<{
  /** Fired after the full celebration sequence completes and hold period ends. */
  done: [];
  /** Audio hook for Story 7.3 — fires after spotlight phase. */
  motifPlay: [];
}>();

// ---------------------------------------------------------------------------
// Race guard + unmount cleanup (same pattern as RoomView.vue Story 7.1)
// ---------------------------------------------------------------------------
let isMounted = true;
let currentAnimation: { stop(): void } | null = null;

onUnmounted(() => {
  isMounted = false;
  currentAnimation?.stop();
});

// ---------------------------------------------------------------------------
// Dim sequence — Phase 1
// Animate non-winner seat areas ([data-celebration-seat="<playerId>"]) to
// ~22% opacity. Targets DOM markers added by OpponentArea (Task 2).
// ---------------------------------------------------------------------------
onMounted(() => {
  if (prefersReducedMotion()) {
    // Reduced motion: skip all opacity animations
    return;
  }

  void runDimSequence();
});

async function runDimSequence(): Promise<void> {
  // Query all seat markers that are NOT the winner's seat
  const allSeatEls = Array.from(document.querySelectorAll<HTMLElement>("[data-celebration-seat]"));
  const nonWinnerEls = allSeatEls.filter(
    (el) => el.getAttribute("data-celebration-seat") !== props.winnerId,
  );

  if (nonWinnerEls.length === 0 || !isMounted) return;

  // Animate each non-winner seat to ~22% opacity
  // We animate them together by targeting each element; Motion for Vue handles
  // individual element animation objects.
  const dimAnimation = animate(nonWinnerEls, { opacity: 0.22 }, { duration: 0.12 });
  currentAnimation = dimAnimation;

  await dimAnimation.finished;

  if (!isMounted) return;

  // Future tasks (3, 4, 5) will extend the sequence here:
  // Phase 2: held beat (0.5s pause)
  // Phase 3: hand fan-out (TileBack arc)
  // Phase 4: spotlight "Mahjong!" text
  // Phase 5: scoring overlay
  // Phase 6: signature motif → emit('motifPlay')
  // Then: emit('done')
}
</script>

<template>
  <Teleport to="body">
    <!--
      Fixed full-screen overlay at z-[70] (above DealingAnimation z-[60], AfkVoteModal z-50).
      pointer-events-none: celebration is non-interactive; LiveKit video thumbnails and
      game buttons remain fully accessible beneath this overlay.
    -->
    <div
      data-testid="celebration-overlay"
      class="pointer-events-none fixed inset-0 z-[70]"
      role="presentation"
      aria-hidden="true"
    >
      <!-- Dim layer: visually covers non-winner seat areas via animate() on [data-celebration-seat] -->
      <div data-testid="celebration-dim-layer" class="absolute inset-0" />

      <!-- Spotlight section (Phase 4): "Mahjong!" text + winner name — fleshed out in Task 3 -->
      <div
        data-testid="celebration-spotlight"
        class="absolute inset-0 flex items-center justify-center"
      />

      <!-- Fan-out section (Phase 3): 14 TileBack components in an arc — fleshed out in Task 3 -->
      <div data-testid="celebration-fanout" class="absolute inset-0" />

      <!-- Scoring overlay (Phase 5): hand value + payment breakdown — fleshed out in Task 3 -->
      <div data-testid="celebration-scoring" class="absolute inset-0" />
    </div>
  </Teleport>
</template>
