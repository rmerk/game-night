import { computed, ref } from "vue";
import { defineStore } from "pinia";

export type SlideInPanelId = "chat" | "nmjl";

/**
 * Single source of truth for slide-in reference panels (chat vs NMJL card).
 *
 * **6A.3 ReactionBar:** use `useSlideInPanelStore().isAnySlideInPanelOpen`. For toggle
 * `aria-controls`, use `SLIDE_IN_CHAT_PANEL_ROOT_ID` / `SLIDE_IN_NMJL_PANEL_ROOT_ID` from
 * `components/chat/slideInPanelIds` — do not duplicate open-state logic.
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

  function toggleNmjl() {
    activePanel.value = activePanel.value === "nmjl" ? null : "nmjl";
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
    toggleNmjl,
    resetForRoomLeave,
  };
});
