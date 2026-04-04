import { computed, ref } from "vue";
import { defineStore } from "pinia";

export type SlideInPanelId = "chat" | "nmjl";

/**
 * Single source of truth for slide-in reference panels (chat vs NMJL card).
 * Story 6A.3 ReactionBar: use `isAnySlideInPanelOpen` to hide floating reactions.
 */
export const useSlideInPanelStore = defineStore("slideInPanel", () => {
  const activePanel = ref<SlideInPanelId | null>(null);

  const isAnySlideInPanelOpen = computed(() => activePanel.value !== null);

  function openChat() {
    activePanel.value = "chat";
  }

  function openNmjl() {
    activePanel.value = "nmjl";
  }

  function close() {
    activePanel.value = null;
  }

  function toggleChat() {
    activePanel.value = activePanel.value === "chat" ? null : "chat";
  }

  function resetForRoomLeave() {
    activePanel.value = null;
  }

  return {
    activePanel,
    isAnySlideInPanelOpen,
    openChat,
    openNmjl,
    close,
    toggleChat,
    resetForRoomLeave,
  };
});
