<script setup lang="ts">
import { onMounted, shallowRef, useTemplateRef } from "vue";
import BasePanel from "../ui/BasePanel.vue";

const controlsRef = useTemplateRef<HTMLElement>("controls");
const activeButtonIndex = shallowRef(0);

function getControlsElement(): HTMLElement | null {
  const controls = controlsRef.value;
  if (!controls) {
    return null;
  }

  return controls instanceof HTMLElement
    ? controls
    : ((controls as { $el?: HTMLElement }).$el ?? null);
}

function getButtons(): HTMLButtonElement[] {
  return Array.from(getControlsElement()?.querySelectorAll<HTMLButtonElement>("button") ?? []);
}

function syncButtons() {
  const buttons = getButtons();
  buttons.forEach((button, index) => {
    button.tabIndex = index === activeButtonIndex.value ? 0 : -1;
  });
}

function focusButton(index: number) {
  const buttons = getButtons();
  if (buttons.length === 0) {
    return;
  }

  activeButtonIndex.value = (index + buttons.length) % buttons.length;
  syncButtons();
  buttons[activeButtonIndex.value]?.focus();
}

function handleFocusIn(event: FocusEvent) {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const nextIndex = getButtons().indexOf(target);
  if (nextIndex === -1) {
    return;
  }

  activeButtonIndex.value = nextIndex;
  syncButtons();
}

function handleKeydown(event: KeyboardEvent) {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const currentIndex = getButtons().indexOf(target);
  if (currentIndex === -1) {
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    focusButton(currentIndex + 1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    focusButton(currentIndex - 1);
  }
}

onMounted(() => {
  syncButtons();
});
</script>

<template>
  <BasePanel
    ref="controls"
    data-testid="mobile-bottom-bar"
    tag="div"
    variant="chrome-raised"
    class="mobile-bottom-bar flex w-full max-w-sm items-center justify-around rounded-xl px-2 py-1 pb-[env(safe-area-inset-bottom)]"
    role="group"
    aria-label="Placeholder table controls"
    @focusin="handleFocusIn"
    @keydown="handleKeydown"
  >
    <button
      type="button"
      class="min-tap flex flex-col items-center justify-center rounded-md px-3 py-2 text-3 text-text-primary/65 focus-visible:focus-ring-on-chrome"
      aria-label="Show NMJL card"
      aria-disabled="true"
    >
      <span class="text-5">🀄</span>
      <span>Card</span>
    </button>

    <button
      type="button"
      class="min-tap flex flex-col items-center justify-center rounded-md px-3 py-2 text-3 text-text-primary/65 focus-visible:focus-ring-on-chrome"
      aria-label="Audio video controls"
      aria-disabled="true"
    >
      <span class="text-5">🎤</span>
      <span>A/V</span>
    </button>
  </BasePanel>
</template>
