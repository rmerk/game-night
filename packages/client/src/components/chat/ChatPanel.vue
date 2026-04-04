<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { MAX_CHAT_LENGTH } from "@mahjong-game/shared";
import { useChatStore } from "../../stores/chat";
import BaseButton from "../ui/BaseButton.vue";
import { formatChatTimestamp } from "../../utils/formatChatTimestamp";

const props = defineProps<{
  sendChat: (text: string) => void;
  onEscapeFocusTarget?: () => void;
}>();

const chatStore = useChatStore();
const draft = ref("");
const listEl = ref<HTMLDivElement | null>(null);
const stickToBottom = ref(true);

function onScroll() {
  const el = listEl.value;
  if (!el) {
    return;
  }
  const threshold = 48;
  stickToBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

watch(
  () => chatStore.messages.length,
  async () => {
    await nextTick();
    if (stickToBottom.value && listEl.value) {
      listEl.value.scrollTop = listEl.value.scrollHeight;
    }
  },
);

function submit() {
  const t = draft.value.trim();
  if (!t) {
    return;
  }
  props.sendChat(t);
  draft.value = "";
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    if (e.target instanceof HTMLElement) {
      e.target.blur();
    }
    props.onEscapeFocusTarget?.();
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    submit();
  }
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div
      ref="listEl"
      data-testid="chat-message-list"
      class="min-h-0 flex-1 overflow-y-auto px-3 py-2"
      @scroll="onScroll"
    >
      <ul class="space-y-2">
        <li
          v-for="m in chatStore.messages"
          :key="`${m.timestamp}-${m.playerId}-${m.text}`"
          class="rounded-md border border-chrome-border/60 bg-chrome-surface/80 px-2 py-1.5"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-1">
            <span class="text-interactive text-3.5 font-medium">{{ m.playerName }}</span>
            <time
              class="text-2.5 text-text-secondary tabular-nums"
              :datetime="new Date(m.timestamp).toISOString()"
            >
              {{ formatChatTimestamp(m.timestamp) }}
            </time>
          </div>
          <p class="text-body mt-0.5 whitespace-pre-wrap break-words text-3.5 text-text-primary">
            {{ m.text }}
          </p>
        </li>
      </ul>
    </div>
    <div class="border-t border-chrome-border p-2">
      <div class="flex gap-2">
        <input
          v-model="draft"
          data-testid="chat-panel-input"
          type="text"
          :maxlength="MAX_CHAT_LENGTH"
          class="min-h-11 min-w-0 flex-1 rounded-md border border-chrome-border bg-chrome-surface px-3 py-2 text-body text-3.5 text-text-primary focus-visible:focus-ring-on-chrome"
          aria-label="Chat message"
          autocomplete="off"
          @keydown="onKeydown"
        />
        <BaseButton variant="secondary" class="shrink-0 px-4" @click="submit"> Send </BaseButton>
      </div>
    </div>
  </div>
</template>
