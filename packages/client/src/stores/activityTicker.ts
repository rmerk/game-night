import { ref } from "vue";
import { defineStore } from "pinia";

/** TTL for each ticker line (AC2). */
export const ACTIVITY_TICKER_MS = 10_000;

const MAX_TICKER_ITEMS = 3;

export interface ActivityTickerRecord {
  id: string;
  text: string;
  timestamp: number;
  expiresAt: number;
}

let idCounter = 0;

function pruneAndCopy(items: readonly ActivityTickerRecord[], now: number): ActivityTickerRecord[] {
  return items.filter((i) => i.expiresAt > now);
}

export const useActivityTickerStore = defineStore("activityTicker", () => {
  const items = ref<readonly ActivityTickerRecord[]>([]);

  let pruneInterval: ReturnType<typeof setInterval> | null = null;

  function stopPruneIfEmpty() {
    if (items.value.length === 0 && pruneInterval !== null) {
      clearInterval(pruneInterval);
      pruneInterval = null;
    }
  }

  function ensurePruneLoop() {
    if (pruneInterval !== null) {
      return;
    }
    pruneInterval = setInterval(() => {
      const now = Date.now();
      const next = pruneAndCopy(items.value, now);
      if (next.length !== items.value.length) {
        items.value = next;
      }
      stopPruneIfEmpty();
    }, 400);
  }

  function pushEvent(text: string): void {
    const now = Date.now();
    const alive = pruneAndCopy(items.value, now);
    idCounter += 1;
    const id = `at-${now}-${idCounter}`;
    const nextItem: ActivityTickerRecord = {
      id,
      text,
      timestamp: now,
      expiresAt: now + ACTIVITY_TICKER_MS,
    };
    items.value = [...alive, nextItem].slice(-MAX_TICKER_ITEMS);
    ensurePruneLoop();
  }

  function clear(): void {
    items.value = [];
    stopPruneIfEmpty();
  }

  function resetForRoomLeave(): void {
    clear();
  }

  return {
    items,
    pushEvent,
    clear,
    resetForRoomLeave,
  };
});
