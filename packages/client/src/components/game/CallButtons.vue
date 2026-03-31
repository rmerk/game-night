<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { CallType } from "@mahjong-game/shared";

const props = defineProps<{
  validCalls: CallType[];
  callWindowStatus: "open" | "frozen" | "confirming";
}>();

const emit = defineEmits<{
  call: [callType: CallType];
  pass: [];
}>();

const CALL_LABELS: Record<CallType, string> = {
  pung: "Pung",
  kong: "Kong",
  quint: "Quint",
  news: "NEWS",
  dragon_set: "Dragons",
  mahjong: "Mahjong",
};

const CALL_ORDER: CallType[] = ["mahjong", "pung", "kong", "quint", "news", "dragon_set"];

const orderedCalls = computed(() => {
  return CALL_ORDER.filter((ct) => props.validCalls.includes(ct));
});

const firstButtonRef = ref<HTMLButtonElement | null>(null);

watch(
  () => props.validCalls,
  () => {
    nextTick(() => {
      firstButtonRef.value?.focus();
    });
  },
  { immediate: true },
);

function handleCall(callType: CallType) {
  emit("call", callType);
}

function handlePass() {
  emit("pass");
}
</script>

<template>
  <div
    aria-live="assertive"
    class="call-buttons flex flex-wrap items-center justify-center gap-2"
    :class="[orderedCalls.length >= 3 ? 'max-md:grid max-md:grid-cols-2' : '']"
  >
    <button
      v-for="(callType, index) in orderedCalls"
      :key="callType"
      :ref="
        (el) => {
          if (index === 0) firstButtonRef = el as HTMLButtonElement | null;
        }
      "
      :data-testid="`call-${callType}`"
      :aria-label="`Call ${CALL_LABELS[callType]}`"
      class="min-h-11 px-6 rounded-md bg-state-call-window text-white text-game-critical shadow-tile hover:brightness-110 focus-visible:focus-ring-on-felt"
      @click="handleCall(callType)"
    >
      {{ CALL_LABELS[callType] }}
    </button>
    <button
      data-testid="call-pass"
      aria-label="Pass on call"
      class="min-h-11 px-6 rounded-md bg-chrome-surface border border-chrome-border text-text-primary text-interactive shadow-tile hover:brightness-110 focus-visible:focus-ring-on-felt"
      @click="handlePass"
    >
      Pass
    </button>
  </div>
</template>
