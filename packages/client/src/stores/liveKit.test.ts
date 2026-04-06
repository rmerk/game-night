import { beforeEach, describe, expect, it } from "vite-plus/test";
import { createPinia, setActivePinia } from "pinia";
import { useLiveKitStore } from "./liveKit";

describe("useLiveKitStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("setToken stores token and url", () => {
    const store = useLiveKitStore();
    store.setToken("jwt", "wss://lk.example/ws");
    expect(store.token).toBe("jwt");
    expect(store.liveKitUrl).toBe("wss://lk.example/ws");
  });

  it("setConnectionStatus updates status", () => {
    const store = useLiveKitStore();
    store.setConnectionStatus("connecting");
    expect(store.connectionStatus).toBe("connecting");
  });

  it("resetForRoomLeave clears token, url, and status", () => {
    const store = useLiveKitStore();
    store.setToken("jwt", "wss://x");
    store.setConnectionStatus("connected");
    store.resetForRoomLeave();
    expect(store.token).toBeNull();
    expect(store.liveKitUrl).toBeNull();
    expect(store.connectionStatus).toBe("idle");
  });
});
