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

  it("resetForRoomLeave clears token, url, status, and avSessionDegraded", () => {
    const store = useLiveKitStore();
    store.setToken("jwt", "wss://x");
    store.setConnectionStatus("connected");
    store.setAvSessionDegraded(true);
    store.resetForRoomLeave();
    expect(store.token).toBeNull();
    expect(store.liveKitUrl).toBeNull();
    expect(store.connectionStatus).toBe("idle");
    expect(store.avSessionDegraded).toBe(false);
  });

  it("setAvSessionDegraded toggles degraded flag", () => {
    const store = useLiveKitStore();
    store.setAvSessionDegraded(true);
    expect(store.avSessionDegraded).toBe(true);
    store.setAvSessionDegraded(false);
    expect(store.avSessionDegraded).toBe(false);
  });
});
