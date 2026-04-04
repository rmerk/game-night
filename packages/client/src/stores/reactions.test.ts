import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import { useReactionsStore, REACTION_BUBBLE_MS } from "./reactions";

function broadcast(
  playerId: string,
  emoji: string,
  timestamp: number,
): import("@mahjong-game/shared").ReactionBroadcast {
  return {
    version: PROTOCOL_VERSION,
    type: "REACTION_BROADCAST",
    playerId,
    playerName: "P",
    emoji,
    timestamp,
  };
}

describe("useReactionsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enqueue adds bubble with future expiry", () => {
    const store = useReactionsStore();
    store.pushBroadcast(broadcast("p1", "👍", 1));
    expect(store.items).toHaveLength(1);
    const first = store.items[0];
    expect(first?.playerId).toBe("p1");
    expect(first?.emoji).toBe("👍");
    expect(first?.expiresAt).toBe(Date.now() + REACTION_BUBBLE_MS);
  });

  it("caps bubbles per player", () => {
    const store = useReactionsStore();
    for (let i = 0; i < 5; i += 1) {
      store.pushBroadcast(broadcast("p1", "👍", i));
    }
    const forP1 = store.items.filter((x) => x.playerId === "p1");
    expect(forP1.length).toBeLessThanOrEqual(3);
  });

  it("clear removes all", () => {
    const store = useReactionsStore();
    store.pushBroadcast(broadcast("p1", "👍", 1));
    store.clear();
    expect(store.items).toHaveLength(0);
  });

  it("resetForRoomLeave clears like clear", () => {
    const store = useReactionsStore();
    store.pushBroadcast(broadcast("p1", "👍", 1));
    store.resetForRoomLeave();
    expect(store.items).toHaveLength(0);
  });
});
