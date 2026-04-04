<script setup lang="ts">
import SlideInPanel from "../ui/SlideInPanel.vue";
import ChatPanel from "./ChatPanel.vue";
import { useSlideInPanelStore } from "../../stores/slideInPanel";
import { SLIDE_IN_CHAT_PANEL_ROOT_ID, SLIDE_IN_NMJL_PANEL_ROOT_ID } from "./slideInPanelIds";

defineProps<{
  sendChat: (text: string) => void;
  onEscapeFocusTarget?: () => void;
}>();

const slideInPanelStore = useSlideInPanelStore();
</script>

<template>
  <SlideInPanel
    :open="slideInPanelStore.activePanel === 'chat'"
    label="Chat"
    :content-id="SLIDE_IN_CHAT_PANEL_ROOT_ID"
    @close="slideInPanelStore.close()"
  >
    <div class="flex min-h-0 min-h-[12rem] flex-1 flex-col md:min-h-0">
      <div class="flex items-center justify-between border-b border-chrome-border px-3 py-2">
        <h2 class="text-interactive text-3.5 font-medium">Chat</h2>
        <button
          type="button"
          class="rounded-md px-2 py-1 text-3 text-text-secondary hover:bg-chrome-surface"
          @click="slideInPanelStore.close()"
        >
          Close
        </button>
      </div>
      <ChatPanel :send-chat="sendChat" :on-escape-focus-target="onEscapeFocusTarget" />
    </div>
  </SlideInPanel>

  <SlideInPanel
    :open="slideInPanelStore.activePanel === 'nmjl'"
    label="NMJL card"
    :content-id="SLIDE_IN_NMJL_PANEL_ROOT_ID"
    @close="slideInPanelStore.close()"
  >
    <div class="flex min-h-0 flex-1 flex-col p-4 md:min-h-0">
      <p class="text-body text-3.5 text-text-secondary">
        NMJL card reference (Epic 5B). Placeholder panel for mutual exclusivity with chat.
      </p>
      <button
        type="button"
        class="mt-4 self-start rounded-md border border-chrome-border px-3 py-2 text-3 text-text-primary"
        @click="slideInPanelStore.close()"
      >
        Close
      </button>
    </div>
  </SlideInPanel>
</template>
