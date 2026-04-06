<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, useTemplateRef } from "vue";
import { animate, prefersReducedMotion } from "motion-v";
import type { MahjongGameResult, SeatWind } from "@mahjong-game/shared";
import TileBack from "../tiles/TileBack.vue";

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
  /** Audio hook for Story 7.3 — fires at Phase 6 (signature motif). */
  motifPlay: [];
}>();

// ---------------------------------------------------------------------------
// Template refs
// ---------------------------------------------------------------------------
const beatElRef = useTemplateRef<HTMLElement>("beatEl");
const spotlightElRef = useTemplateRef<HTMLElement>("spotlightEl");
const scoringElRef = useTemplateRef<HTMLElement>("scoringEl");
const motifElRef = useTemplateRef<HTMLElement>("motifEl");

// ---------------------------------------------------------------------------
// Reactive UI state
// ---------------------------------------------------------------------------
/** Controls v-if for the spotlight section (Phase 4). Initially hidden; opacity animated in. */
const spotlightVisible = ref(false);
/** Controls v-if for the scoring overlay (Phase 5). Initially hidden; opacity animated in. */
const scoringVisible = ref(false);

// Tile fan-out: 14 tiles (standard mahjong hand — 13 tiles + the winning tile)
const FAN_TILE_COUNT = 14;

// ---------------------------------------------------------------------------
// Race guard + unmount cleanup (same pattern as RoomView.vue Story 7.1)
// ---------------------------------------------------------------------------
let isMounted = true;
let currentAnimation: { stop(): void } | null = null;
let currentAnimations: { stop(): void }[] = [];

onUnmounted(() => {
  isMounted = false;
  currentAnimation?.stop();
  currentAnimations.forEach((a) => a.stop());
});

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------
/** Cubic-bezier matching `--ease-expressive` design token (AR21). */
const TIMING_EXPRESSIVE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Minimum total sequence duration before emitting `done` (AC 4). */
const MIN_SEQUENCE_DURATION_S = 5;

// ---------------------------------------------------------------------------
// Celebration sequence
// ---------------------------------------------------------------------------
onMounted(() => {
  if (prefersReducedMotion()) {
    void runReducedMotionSequence();
    return;
  }

  void runCelebrationSequence();
});

/**
 * Reduced-motion celebration path (AC 5 & 6).
 *
 * - Dims non-winner seats instantly (duration:0 — opacity change, not motion).
 * - Immediately reveals spotlight + scoring (no fade animation).
 * - Holds 2 seconds via animate() (no setTimeout — AR21).
 * - Skips fan-out arc and held beat entirely.
 * - Does NOT emit motifPlay (motif is a visual scale animation, skip under reduced motion).
 * - Total sequence well under 3 seconds (AC 5).
 */
async function runReducedMotionSequence(): Promise<void> {
  // Phase 1: Dim instantly (opacity change, no animation duration — AC 6)
  const opponentEls = [...document.querySelectorAll<HTMLElement>("[data-celebration-seat]")].filter(
    (el) => el.getAttribute("data-celebration-seat") !== props.winnerId,
  );

  if (opponentEls.length && isMounted) {
    currentAnimation = animate(opponentEls, { opacity: 0.22 }, { duration: 0 });
    await currentAnimation.finished;
  }

  if (!isMounted) return;

  // Phase 2: Instantly reveal spotlight + scoring (no animation — AC 6)
  spotlightVisible.value = true;
  scoringVisible.value = true;
  await nextTick();

  if (!isMounted) return;

  // Phase 3: Hold 2s via animate() — no setTimeout (AR21). Total < 3s (AC 5).
  if (beatElRef.value && isMounted) {
    currentAnimation = animate(beatElRef.value, { opacity: [0, 0] }, { duration: 2 });
    await currentAnimation.finished;
  }

  if (!isMounted) return;

  emit("done");
}

/**
 * Full 6-phase celebration sequence orchestrated via Motion for Vue's
 * `animate().finished` chain — no setTimeout chains anywhere (AC 7 / AR21).
 *
 * Trade-off note: Phase 1 applies element-level opacity to OpponentArea root
 * elements ([data-celebration-seat] markers). This dims ALL children including
 * LiveKit video thumbnails. Per spec subtask 3.2 and dev notes, this is the
 * correct implementation approach; a future task (Task 7 WCAG) may revisit if
 * contrast requirements demand positional overlay divs instead.
 */
async function runCelebrationSequence(): Promise<void> {
  const startTime = Date.now();

  // ─── Phase 1 — Dim (0.12s, tactile speed) ────────────────────────────────
  // Target non-winner seat areas via [data-celebration-seat] DOM markers
  // placed by OpponentArea (Task 2). Spec: animate to ~22% opacity.
  const opponentEls = Array.from(
    document.querySelectorAll<HTMLElement>("[data-celebration-seat]"),
  ).filter((el) => el.getAttribute("data-celebration-seat") !== props.winnerId);

  if (opponentEls.length > 0 && isMounted) {
    currentAnimation = animate(opponentEls, { opacity: 0.22 }, { duration: 0.12 });
    await currentAnimation.finished;
  }

  if (!isMounted) return;

  // ─── Phase 2 — Held beat (0.5s anticipatory pause) ────────────────────────
  // Animate a non-visible beat element to keep the sequence chain pure
  // (no setTimeout — AC 7). The beat div is always rendered so the ref is stable.
  if (beatElRef.value && isMounted) {
    currentAnimation = animate(beatElRef.value, { opacity: [0, 0] }, { duration: 0.5 });
    await currentAnimation.finished;
  }

  if (!isMounted) return;

  // ─── Phase 3 — Hand fan-out (0.8s) ────────────────────────────────────────
  // Animate 14 tile-back elements from the winner's seat position toward a
  // centered arc in the viewport. Elements are rendered absolutely-positioned
  // inside the overlay (data-testid="celebration-fanout").
  const fanTileEls = Array.from(
    document.querySelectorAll<HTMLElement>("[data-celebration-fan-tile]"),
  );

  if (fanTileEls.length > 0 && isMounted) {
    // Compute winner seat origin for fan start position
    const winnerEl = document.querySelector<HTMLElement>(
      `[data-celebration-seat="${props.winnerId}"]`,
    );
    const winnerRect = winnerEl?.getBoundingClientRect();
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;

    // Start all tiles at the winner seat center (or viewport center as fallback)
    const startX = winnerRect ? winnerRect.left + winnerRect.width / 2 - cx : 0;
    const startY = winnerRect ? winnerRect.top + winnerRect.height / 2 - cy : 0;

    // Arc spread: tiles fan in a horizontal arc centered at the viewport center
    const totalSpread = Math.min(window.innerWidth * 0.6, 480); // px total arc width

    const fanAnims = fanTileEls.map((el, i) => {
      // Normalized position -0.5..+0.5 across the arc
      const t = fanTileEls.length > 1 ? i / (fanTileEls.length - 1) - 0.5 : 0;
      const targetX = t * totalSpread;
      // Gentle arc: tiles at the edges are slightly higher than center
      const arcYOffset = Math.abs(t) * 30;
      const targetY = -cy * 0.1 - arcYOffset; // shift upward from viewport center
      // Rotation: tilt outward from center
      const rotation = t * 25; // degrees

      return animate(
        el,
        {
          x: [startX, targetX],
          y: [startY, targetY],
          rotate: [0, rotation],
          opacity: [0, 1],
        },
        {
          duration: 0.8,
          ease: TIMING_EXPRESSIVE,
          delay: i * 0.025, // slight stagger for each tile
        },
      );
    });
    currentAnimations = fanAnims;
    await Promise.all(fanAnims.map((a) => a.finished));
    currentAnimations = [];
  }

  if (!isMounted) return;

  // ─── Phase 4 — Winner spotlight (0.4s) ────────────────────────────────────
  // Show "Mahjong! — [winner name]" in celebration-gold, fade in.
  spotlightVisible.value = true;
  // Wait one tick for the DOM element to appear before animating
  await nextTick();

  if (spotlightElRef.value && isMounted) {
    currentAnimation = animate(spotlightElRef.value, { opacity: [0, 1] }, { duration: 0.4 });
    await currentAnimation.finished;
  }

  if (!isMounted) return;

  // ─── Phase 5 — Scoring overlay (0.3s) ─────────────────────────────────────
  scoringVisible.value = true;
  await nextTick();

  if (scoringElRef.value && isMounted) {
    currentAnimation = animate(scoringElRef.value, { opacity: [0, 1] }, { duration: 0.3 });
    await currentAnimation.finished;
  }

  if (!isMounted) return;

  // ─── Phase 6 — Signature motif placeholder (0.3s pulse) ────────────────────
  // Emit audio hook for Story 7.3 wiring. Visually: brief scale pulse on the
  // "Mahjong!" text (UX-DR27).
  emit("motifPlay");
  if (motifElRef.value && isMounted) {
    currentAnimation = animate(motifElRef.value, { scale: [1, 1.05, 1] }, { duration: 0.3 });
    await currentAnimation.finished;
  }

  if (!isMounted) return;

  // ─── Hold — wait until total elapsed ≥ MIN_SEQUENCE_DURATION_S ─────────────
  // Use animate() for the hold — no setTimeout (AC 7).
  const elapsed = (Date.now() - startTime) / 1000;
  const remaining = Math.max(0, MIN_SEQUENCE_DURATION_S - elapsed);

  if (remaining > 0 && isMounted) {
    // Use beatEl as a stable no-op target for the hold duration
    const holdTarget = beatElRef.value ?? document.body;
    currentAnimation = animate(holdTarget, { opacity: [0, 0] }, { duration: remaining });
    await currentAnimation.finished;
  }

  if (!isMounted) return;

  emit("done");
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

      <!--
        Beat element: zero-size invisible element used for the Phase 2 held beat and
        the end-of-sequence hold. Must always be rendered for beatElRef to be stable.
      -->
      <div ref="beatEl" class="absolute h-0 w-0 opacity-0" aria-hidden="true" />

      <!-- Fan-out section (Phase 3): 14 TileBack components in an arc -->
      <div
        data-testid="celebration-fanout"
        class="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div
          v-for="i in FAN_TILE_COUNT"
          :key="i"
          :data-celebration-fan-tile="i"
          class="absolute opacity-0"
          style="will-change: transform, opacity"
        >
          <TileBack size="standard" />
        </div>
      </div>

      <!-- Spotlight section (Phase 4): "Mahjong!" text + winner name -->
      <div
        v-if="spotlightVisible"
        ref="spotlightEl"
        data-testid="celebration-spotlight"
        class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
        style="opacity: 0"
      >
        <p
          ref="motifEl"
          class="text-celebration-gold mb-2 text-center text-8 font-bold tracking-wide drop-shadow-lg"
          data-testid="celebration-mahjong-text"
        >
          Mahjong!
        </p>
        <p class="text-celebration-gold text-center text-5 font-semibold">
          — {{ playerNamesById[winnerId] ?? winnerId }} —
        </p>
        <p class="mt-1 text-center text-3.5 text-text-on-felt/75">
          {{ gameResult.patternName }} · {{ gameResult.points }} pts
        </p>
      </div>

      <!-- Scoring overlay (Phase 5): payment breakdown -->
      <div
        v-if="scoringVisible"
        ref="scoringEl"
        data-testid="celebration-scoring"
        class="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-center pb-16"
        style="opacity: 0"
      >
        <div class="rounded-lg bg-chrome-surface/90 px-6 py-4 shadow-lg">
          <p class="mb-3 text-center text-3.5 font-semibold text-text-primary">Payment</p>
          <ul class="space-y-1.5">
            <li
              v-for="(amount, playerId) in gameResult.payments"
              :key="playerId"
              class="flex items-center justify-between gap-8 text-3.5"
            >
              <span class="text-text-primary">{{ playerNamesById[playerId] ?? playerId }}</span>
              <span :class="amount > 0 ? 'text-state-success font-semibold' : 'text-state-error'">
                {{ amount > 0 ? "+" : "" }}{{ amount }}
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </Teleport>
</template>
