<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from "vue";
import type { CallType } from "@mahjong-game/shared";
import BaseButton from "../ui/BaseButton.vue";

const props = defineProps<{
  validCalls: CallType[];
  callWindowStatus: "open" | "frozen" | "confirming";
  /** Hide Pung/Kong/etc. but keep Pass (UX-DR35 dead hand) */
  hideCallsForDeadHand?: boolean;
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
  if (props.hideCallsForDeadHand) {
    return [];
  }
  return CALL_ORDER.filter((ct) => props.validCalls.includes(ct));
});

type FocusableButton = {
  focus: () => void;
} | null;

const firstButtonRef = ref<FocusableButton>(null);
const passButtonRef = useTemplateRef<FocusableButton>("passButton");

watch(
  () => props.validCalls,
  () => {
    nextTick(() => {
      if (firstButtonRef.value) {
        firstButtonRef.value.focus();
        return;
      }

      passButtonRef.value?.focus();
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

function setFirstButtonRef(instance: FocusableButton, index: number) {
  if (index === 0) {
    firstButtonRef.value = instance;
  }
}
</script>

<template>
  <div
    aria-live="assertive"
    class="call-buttons flex flex-wrap items-center justify-center gap-2"
    :class="{ 'max-md:grid max-md:grid-cols-2': orderedCalls.length >= 3 }"
  >
    <BaseButton
      v-for="(callType, index) in orderedCalls"
      :key="callType"
      :ref="(instance) => setFirstButtonRef(instance as FocusableButton, index)"
      :data-testid="`call-${callType}`"
      :aria-label="`Call ${CALL_LABELS[callType]}`"
      variant="urgent"
      @click="handleCall(callType)"
    >
      {{ CALL_LABELS[callType] }}
    </BaseButton>
    <BaseButton
      ref="passButton"
      data-testid="call-pass"
      aria-label="Pass on call"
      variant="secondary"
      @click="handlePass"
    >
      Pass
    </BaseButton>
  </div>
</template>
