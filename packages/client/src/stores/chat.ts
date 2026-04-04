import { ref } from "vue";
import { defineStore } from "pinia";
import type { ChatBroadcast } from "@mahjong-game/shared";

export const useChatStore = defineStore("chat", () => {
  const messages = ref<readonly ChatBroadcast[]>([]);

  function appendBroadcast(b: ChatBroadcast) {
    messages.value = [...messages.value, b];
  }

  /** For future CHAT_HISTORY (6A.4): replace or merge without rewriting the panel. */
  function setMessages(next: ChatBroadcast[]) {
    messages.value = next;
  }

  function clear() {
    messages.value = [];
  }

  return {
    messages,
    appendBroadcast,
    setMessages,
    clear,
  };
});
