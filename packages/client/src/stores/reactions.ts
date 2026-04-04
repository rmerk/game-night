import { ref } from "vue";
import { defineStore } from "pinia";
import type { ReactionBroadcast } from "@mahjong-game/shared";

/** Single place for bubble lifetime (AC5). */
export const REACTION_BUBBLE_MS = 2500;

const MAX_BUBBLES_PER_PLAYER = 3;

export interface ReactionBubbleRecord {
  id: string;
  playerId: string;
  emoji: string;
  expiresAt: number;
}

let idCounter = 0;

function pruneAndCopy(items: readonly ReactionBubbleRecord[], now: number): ReactionBubbleRecord[] {
  return items.filter((i) => i.expiresAt > now);
}

export const useReactionsStore = defineStore("reactions", () => {
  const items = ref<readonly ReactionBubbleRecord[]>([]);

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

  function pushBroadcast(b: ReactionBroadcast): void {
    const now = Date.now();
    const alive = pruneAndCopy(items.value, now);
    const forPlayer = alive.filter((i) => i.playerId === b.playerId);
    const last = forPlayer[forPlayer.length - 1];
    if (
      last &&
      last.playerId === b.playerId &&
      last.emoji === b.emoji &&
      Number(last.id.split("-")[0]) === b.timestamp
    ) {
      return;
    }
    const rest = alive.filter((i) => i.playerId !== b.playerId);
    const capped = forPlayer.slice(-(MAX_BUBBLES_PER_PLAYER - 1));

    idCounter += 1;
    const id = `${b.timestamp}-${idCounter}`;
    const nextItem: ReactionBubbleRecord = {
      id,
      playerId: b.playerId,
      emoji: b.emoji,
      expiresAt: now + REACTION_BUBBLE_MS,
    };

    items.value = [...rest, ...capped, nextItem];
    ensurePruneLoop();
  }

  function clear(): void {
    items.value = [];
    stopPruneIfEmpty();
  }

  /** Alias for room/session reset (Task 2.3). */
  function resetForRoomLeave(): void {
    clear();
  }

  return {
    items,
    pushBroadcast,
    clear,
    resetForRoomLeave,
  };
});
