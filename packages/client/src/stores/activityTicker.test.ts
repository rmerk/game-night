import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { ACTIVITY_TICKER_MS, useActivityTickerStore } from "./activityTicker";

describe("useActivityTickerStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pushEvent adds record with future expiry", () => {
    const store = useActivityTickerStore();
    store.pushEvent("You discarded 8-Dot");
    expect(store.items).toHaveLength(1);
    const first = store.items[0];
    expect(first?.text).toBe("You discarded 8-Dot");
    expect(first?.timestamp).toBe(Date.now());
    expect(first?.expiresAt).toBe(Date.now() + ACTIVITY_TICKER_MS);
  });

  it("caps at 3 items dropping oldest", () => {
    const store = useActivityTickerStore();
    store.pushEvent("a");
    store.pushEvent("b");
    store.pushEvent("c");
    store.pushEvent("d");
    expect(store.items).toHaveLength(3);
    expect(store.items.map((i) => i.text)).toEqual(["b", "c", "d"]);
  });

  it("prune interval removes expired items", async () => {
    const store = useActivityTickerStore();
    store.pushEvent("x");
    expect(store.items).toHaveLength(1);
    vi.advanceTimersByTime(ACTIVITY_TICKER_MS + 500);
    await vi.runOnlyPendingTimersAsync();
    expect(store.items).toHaveLength(0);
  });

  it("clear removes all and stops interval when empty", () => {
    const store = useActivityTickerStore();
    store.pushEvent("x");
    store.clear();
    expect(store.items).toHaveLength(0);
  });

  it("resetForRoomLeave clears like clear", () => {
    const store = useActivityTickerStore();
    store.pushEvent("x");
    store.resetForRoomLeave();
    expect(store.items).toHaveLength(0);
  });
});
