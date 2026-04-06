import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { ref } from "vue";
import { createPinia, setActivePinia } from "pinia";
import { useLiveKitStore } from "../stores/liveKit";
import { useAvReconnectUi } from "./useAvReconnectUi";
import type { RoomConnectionStatus } from "./useRoomConnection";

describe("useAvReconnectUi (6B.5)", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("does not set degraded on cold join while connecting (no prior connected)", async () => {
    vi.useFakeTimers();
    const roomWsStatus = ref<RoomConnectionStatus>("open");
    const liveKitStore = useLiveKitStore();
    liveKitStore.setConnectionStatus("connecting");

    useAvReconnectUi({
      roomWsStatus,
      retryLiveKitConnection: vi.fn().mockResolvedValue(false),
    });

    await vi.advanceTimersByTimeAsync(10_000);
    expect(liveKitStore.avSessionDegraded).toBe(false);
    vi.useRealTimers();
  });

  it("sets avSessionDegraded after watchdog when reconnecting from a prior connected state", async () => {
    vi.useFakeTimers();
    const roomWsStatus = ref<RoomConnectionStatus>("open");
    const liveKitStore = useLiveKitStore();

    useAvReconnectUi({
      roomWsStatus,
      retryLiveKitConnection: vi.fn().mockResolvedValue(false),
    });

    liveKitStore.setConnectionStatus("connected");
    await Promise.resolve();
    liveKitStore.setConnectionStatus("connecting");

    await vi.advanceTimersByTimeAsync(10_000);
    expect(liveKitStore.avSessionDegraded).toBe(true);
    vi.useRealTimers();
  });

  it("onReconnectAv transitions manualPhase to pending then idle on success", async () => {
    const retryMock = vi.fn().mockResolvedValue(true);
    const roomWsStatus = ref<RoomConnectionStatus>("open");
    const liveKitStore = useLiveKitStore();
    liveKitStore.setAvSessionDegraded(true);

    const ui = useAvReconnectUi({ roomWsStatus, retryLiveKitConnection: retryMock });

    const promise = ui.onReconnectAv();
    expect(ui.manualPhase).toBe("pending");
    await promise;
    expect(ui.manualPhase).toBe("idle");
    expect(liveKitStore.avSessionDegraded).toBe(false);
  });

  it("onReconnectAv transitions manualPhase to pending then failed on failure", async () => {
    const retryMock = vi.fn().mockResolvedValue(false);
    const roomWsStatus = ref<RoomConnectionStatus>("open");
    const liveKitStore = useLiveKitStore();

    const ui = useAvReconnectUi({ roomWsStatus, retryLiveKitConnection: retryMock });

    const promise = ui.onReconnectAv();
    expect(ui.manualPhase).toBe("pending");
    await promise;
    expect(ui.manualPhase).toBe("failed");
    expect(liveKitStore.avSessionDegraded).toBe(true);
  });

  it("onReconnectAv ignores clicks while pending (double-click protection)", async () => {
    let resolveRetry!: (ok: boolean) => void;
    const retryMock = vi.fn().mockImplementation(
      () =>
        new Promise<boolean>((r) => {
          resolveRetry = r;
        }),
    );
    const roomWsStatus = ref<RoomConnectionStatus>("open");

    const ui = useAvReconnectUi({ roomWsStatus, retryLiveKitConnection: retryMock });

    const first = ui.onReconnectAv();
    expect(ui.manualPhase).toBe("pending");
    expect(retryMock).toHaveBeenCalledTimes(1);

    // Second call while pending — should be ignored
    void ui.onReconnectAv();
    expect(retryMock).toHaveBeenCalledTimes(1);

    resolveRetry(true);
    await first;
    expect(ui.manualPhase).toBe("idle");
  });

  it("clears degraded when connection returns to connected", async () => {
    const roomWsStatus = ref<RoomConnectionStatus>("open");
    const liveKitStore = useLiveKitStore();

    useAvReconnectUi({
      roomWsStatus,
      retryLiveKitConnection: vi.fn().mockResolvedValue(true),
    });

    liveKitStore.setConnectionStatus("connected");
    await Promise.resolve();
    liveKitStore.setAvSessionDegraded(true);
    liveKitStore.setConnectionStatus("connecting");
    await Promise.resolve();
    liveKitStore.setConnectionStatus("connected");
    await Promise.resolve();
    expect(liveKitStore.avSessionDegraded).toBe(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});
