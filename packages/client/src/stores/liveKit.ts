import { defineStore } from "pinia";
import { ref } from "vue";

export type LiveKitConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "failed"
  | "disconnected";

export const useLiveKitStore = defineStore("liveKit", () => {
  const connectionStatus = ref<LiveKitConnectionStatus>("idle");
  const token = ref<string | null>(null);
  const liveKitUrl = ref<string | null>(null);
  /** Story 6B.5: watchdog fired or user needs manual retry while game WS is still up. */
  const avSessionDegraded = ref(false);

  function setToken(nextToken: string, url: string): void {
    token.value = nextToken;
    liveKitUrl.value = url;
  }

  function setConnectionStatus(status: LiveKitConnectionStatus): void {
    connectionStatus.value = status;
  }

  function setAvSessionDegraded(degraded: boolean): void {
    avSessionDegraded.value = degraded;
  }

  function resetForRoomLeave(): void {
    token.value = null;
    liveKitUrl.value = null;
    connectionStatus.value = "idle";
    avSessionDegraded.value = false;
  }

  return {
    connectionStatus,
    token,
    liveKitUrl,
    avSessionDegraded,
    setToken,
    setConnectionStatus,
    setAvSessionDegraded,
    resetForRoomLeave,
  };
});
