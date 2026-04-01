<script setup lang="ts">
import { nextTick, onMounted, onUpdated, shallowRef, useTemplateRef } from "vue";

const toolbarRef = useTemplateRef<HTMLElement>("toolbar");
const activeButtonIndex = shallowRef(0);
const hadFocusWithin = shallowRef(false);

function getToolbarButtons(): HTMLButtonElement[] {
  return Array.from(
    toolbarRef.value?.querySelectorAll<HTMLButtonElement>("[data-toolbar-controls] button") ?? [],
  ).filter(
    (button) =>
      !button.disabled &&
      button.getAttribute("aria-disabled") !== "true" &&
      button.style.display !== "none",
  );
}

function syncToolbarButtons(options: { focusActive?: boolean } = {}) {
  const buttons = getToolbarButtons();
  if (buttons.length === 0) {
    return;
  }

  const focusedIndex =
    document.activeElement instanceof HTMLButtonElement
      ? buttons.indexOf(document.activeElement)
      : -1;

  if (focusedIndex >= 0) {
    activeButtonIndex.value = focusedIndex;
  } else if (activeButtonIndex.value >= buttons.length) {
    activeButtonIndex.value = buttons.length - 1;
  }

  buttons.forEach((button, index) => {
    button.tabIndex = index === activeButtonIndex.value ? 0 : -1;
  });

  if (options.focusActive) {
    buttons[activeButtonIndex.value]?.focus();
  }
}

function focusToolbarButton(index: number) {
  const buttons = getToolbarButtons();
  if (buttons.length === 0) {
    return;
  }

  const nextIndex = (index + buttons.length) % buttons.length;
  activeButtonIndex.value = nextIndex;
  buttons.forEach((button, buttonIndex) => {
    button.tabIndex = buttonIndex === nextIndex ? 0 : -1;
  });
  buttons[nextIndex]?.focus();
}

function handleFocusIn(event: FocusEvent) {
  const buttons = getToolbarButtons();
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const focusedIndex = buttons.indexOf(target);
  if (focusedIndex === -1) {
    return;
  }

  hadFocusWithin.value = true;
  activeButtonIndex.value = focusedIndex;
  syncToolbarButtons();
}

function handleFocusOut(event: FocusEvent) {
  const nextTarget = event.relatedTarget;
  if (nextTarget instanceof Node && toolbarRef.value?.contains(nextTarget)) {
    return;
  }

  hadFocusWithin.value = false;
  syncToolbarButtons();
}

function handleKeydown(event: KeyboardEvent) {
  const buttons = getToolbarButtons();
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const focusedIndex = buttons.indexOf(target);
  if (focusedIndex === -1) {
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    focusToolbarButton(focusedIndex + 1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    focusToolbarButton(focusedIndex - 1);
  }
}

onMounted(() => {
  syncToolbarButtons();
});

onUpdated(() => {
  nextTick(() => {
    const shouldRestoreFocus =
      hadFocusWithin.value &&
      !(
        document.activeElement instanceof Node && toolbarRef.value?.contains(document.activeElement)
      );
    syncToolbarButtons({ focusActive: shouldRestoreFocus });
  });
});
</script>

<template>
  <div
    ref="toolbar"
    class="action-zone flex items-center justify-center w-full min-h-20"
    role="toolbar"
    aria-label="Game actions"
    @focusin="handleFocusIn"
    @focusout="handleFocusOut"
    @keydown="handleKeydown"
  >
    <slot />
  </div>
</template>
