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

  function setToken(nextToken: string, url: string): void {
    token.value = nextToken;
    liveKitUrl.value = url;
  }

  function setConnectionStatus(status: LiveKitConnectionStatus): void {
    connectionStatus.value = status;
  }

  function resetForRoomLeave(): void {
    token.value = null;
    liveKitUrl.value = null;
    connectionStatus.value = "idle";
  }

  return {
    connectionStatus,
    token,
    liveKitUrl,
    setToken,
    setConnectionStatus,
    resetForRoomLeave,
  };
});
