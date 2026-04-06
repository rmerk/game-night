<script setup lang="ts">
import type { GuidanceResult } from "@mahjong-game/shared";
import { useBreakpoints } from "@vueuse/core";
import { computed } from "vue";
import SlideInPanel from "../ui/SlideInPanel.vue";
import ChatPanel from "./ChatPanel.vue";
import NMJLCardPanel from "../nmjl/NMJLCardPanel.vue";
import { useSlideInPanelStore } from "../../stores/slideInPanel";
import { SLIDE_IN_CHAT_PANEL_ROOT_ID, SLIDE_IN_NMJL_PANEL_ROOT_ID } from "./slideInPanelIds";

const props = withDefaults(
  defineProps<{
    sendChat: (text: string) => void;
    onEscapeFocusTarget?: () => void;
    /** Mobile Charleston: anchor NMJL panel to top so the rack stays visible below. */
    nmjlCharlestonMobileSplit?: boolean;
    nmjlGuidanceActive?: boolean;
    nmjlGuidanceByHandId?: ReadonlyMap<string, GuidanceResult> | null;
    nmjlShowPersonalReenableHint?: boolean;
  }>(),
  {
    nmjlCharlestonMobileSplit: false,
    nmjlGuidanceActive: false,
    nmjlGuidanceByHandId: null,
    nmjlShowPersonalReenableHint: false,
  },
);

const emit = defineEmits<{
  reenablePersonalGuidance: [];
}>();

const slideInPanelStore = useSlideInPanelStore();

const breakpoints = useBreakpoints({ md: 768 });
const isMobile = breakpoints.smaller("md");

const nmjlMobilePlacement = computed(() =>
  props.nmjlCharlestonMobileSplit && isMobile.value ? "top" : "bottom",
);
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
    :mobile-placement="nmjlMobilePlacement"
    @close="slideInPanelStore.close()"
  >
    <NMJLCardPanel
      :guidance-active="nmjlGuidanceActive"
      :guidance-by-hand-id="nmjlGuidanceByHandId"
      :show-personal-reenable-hint="nmjlShowPersonalReenableHint"
      :on-escape-focus-target="onEscapeFocusTarget"
      @close="slideInPanelStore.close()"
      @reenable-personal-guidance="emit('reenablePersonalGuidance')"
    />
  </SlideInPanel>
</template>
