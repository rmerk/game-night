import { computed, onBeforeUnmount, reactive, ref, watch, type Ref } from "vue";
import { storeToRefs } from "pinia";
import { useLiveKitStore } from "../stores/liveKit";
import type { RoomConnectionStatus } from "./useRoomConnection";
import { AV_RECONNECT_WATCHDOG_MS } from "../constants/avReconnect";

export type ManualReconnectPhase = "idle" | "pending" | "failed";

/**
 * Story 6B.5: reconnecting copy, 10s watchdog → degraded, manual retry phase.
 * Single watchdog owner — do not duplicate timers alongside useLiveKit SDK events.
 */
export function useAvReconnectUi(opts: {
  roomWsStatus: Ref<RoomConnectionStatus>;
  retryLiveKitConnection: () => Promise<boolean>;
}) {
  const liveKitStore = useLiveKitStore();
  const { connectionStatus } = storeToRefs(liveKitStore);

  const wasEverConnected = ref(false);
  const manualPhase = ref<ManualReconnectPhase>("idle");

  watch(connectionStatus, (s) => {
    if (s === "connected") {
      wasEverConnected.value = true;
    }
  });

  let watchdogTimer: ReturnType<typeof setTimeout> | null = null;

  function clearWatchdog(): void {
    if (watchdogTimer !== null) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
  }

  /**
   * Start one watchdog when game WS is open, LiveKit is connecting, and the user has
   * already reached `connected` at least once (suppresses cold-join "Reconnecting…").
   */
  function maybeStartWatchdog(): void {
    if (opts.roomWsStatus.value !== "open" || connectionStatus.value !== "connecting") {
      clearWatchdog();
      return;
    }
    if (!wasEverConnected.value) {
      clearWatchdog();
      return;
    }
    if (watchdogTimer !== null) {
      return;
    }
    watchdogTimer = setTimeout(() => {
      watchdogTimer = null;
      if (opts.roomWsStatus.value === "open" && connectionStatus.value !== "connected") {
        liveKitStore.setAvSessionDegraded(true);
      }
    }, AV_RECONNECT_WATCHDOG_MS);
  }

  watch(
    [opts.roomWsStatus, connectionStatus],
    () => {
      if (opts.roomWsStatus.value !== "open") {
        clearWatchdog();
        return;
      }
      if (connectionStatus.value === "connected") {
        clearWatchdog();
        liveKitStore.setAvSessionDegraded(false);
        if (manualPhase.value !== "pending") {
          manualPhase.value = "idle";
        }
        return;
      }
      maybeStartWatchdog();
    },
    { immediate: true },
  );

  const showReconnecting = computed(
    () =>
      opts.roomWsStatus.value === "open" &&
      connectionStatus.value === "connecting" &&
      wasEverConnected.value,
  );

  const showReconnectButton = computed(() => {
    if (opts.roomWsStatus.value !== "open") {
      return false;
    }
    if (manualPhase.value === "pending" || manualPhase.value === "failed") {
      return true;
    }
    return liveKitStore.avSessionDegraded;
  });

  async function onReconnectAv(): Promise<void> {
    if (manualPhase.value === "pending") {
      return;
    }
    manualPhase.value = "pending";
    const ok = await opts.retryLiveKitConnection();
    if (ok) {
      manualPhase.value = "idle";
      liveKitStore.setAvSessionDegraded(false);
    } else {
      manualPhase.value = "failed";
      liveKitStore.setAvSessionDegraded(true);
    }
  }

  onBeforeUnmount(() => {
    clearWatchdog();
  });

  return reactive({
    showReconnecting,
    showReconnectButton,
    manualPhase,
    onReconnectAv,
  });
}
