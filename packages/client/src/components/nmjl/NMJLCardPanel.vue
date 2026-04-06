<script setup lang="ts">
import { loadCard } from "@mahjong-game/shared";
import type { HandPattern, NMJLCard } from "@mahjong-game/shared";
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import HandPatternDetail from "./HandPatternDetail.vue";
import HandPatternNotation from "./HandPatternNotation.vue";

const props = defineProps<{
  onEscapeFocusTarget?: () => void;
}>();

const emit = defineEmits<{
  close: [];
}>();

const card = ref<NMJLCard | null>(null);
try {
  card.value = loadCard("2026");
} catch (err) {
  if (import.meta.env.DEV) {
    console.warn("[NMJLCardPanel] loadCard failed:", err);
  }
  card.value = null;
}

const selectedHandId = ref<string | null>(null);
const selectedHand = ref<HandPattern | null>(null);

const lastRowButtonRef = ref<HTMLButtonElement | null>(null);
const detailRootRef = ref<HTMLElement | null>(null);

function selectHand(hand: HandPattern) {
  selectedHandId.value = hand.id;
  selectedHand.value = hand;
}

function closeDetail() {
  selectedHandId.value = null;
  selectedHand.value = null;
  void nextTick(() => {
    lastRowButtonRef.value?.focus();
  });
}

watch(selectedHandId, async (id) => {
  if (id) {
    await nextTick();
    const el = detailRootRef.value;
    if (el && typeof el.focus === "function") {
      el.focus();
    }
  }
});

function onDocumentKeydown(e: KeyboardEvent) {
  if (e.key !== "Escape") {
    return;
  }
  e.preventDefault();
  if (selectedHandId.value) {
    closeDetail();
    return;
  }
  emit("close");
  props.onEscapeFocusTarget?.();
}

onMounted(() => {
  document.addEventListener("keydown", onDocumentKeydown);
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onDocumentKeydown);
});

function onRowActivate(hand: HandPattern, ev: MouseEvent) {
  const el = ev.currentTarget as HTMLButtonElement;
  if (selectedHandId.value === hand.id) {
    closeDetail();
    return;
  }
  lastRowButtonRef.value = el;
  selectHand(hand);
}
</script>

<template>
  <div
    class="flex min-h-0 min-h-[12rem] flex-1 flex-col md:min-h-0"
    role="region"
    aria-label="NMJL card reference"
  >
    <div class="flex items-center justify-between border-b border-chrome-border px-3 py-2">
      <h2 id="nmjl-card-panel-title" class="text-interactive text-3.5 font-medium">NMJL Card</h2>
      <button
        type="button"
        class="min-h-11 rounded-md px-3 py-2 text-3 text-text-secondary hover:bg-chrome-surface"
        data-testid="nmjl-card-panel-close"
        @click="emit('close')"
      >
        Close
      </button>
    </div>

    <div v-if="!card" class="p-4 text-3.5 text-state-error" role="alert">
      Card data could not be loaded.
    </div>

    <div
      v-else
      class="nmjl-card-panel__scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2"
      aria-labelledby="nmjl-card-panel-title"
    >
      <section
        v-for="cat in card.categories"
        :key="cat.name"
        class="mb-4"
        role="group"
        :aria-label="cat.name"
      >
        <h3
          class="sticky top-0 z-10 mb-2 border-b border-chrome-border bg-chrome-elevated/95 py-1 text-4.5 font-semibold text-interactive backdrop-blur-sm"
          role="heading"
          aria-level="3"
        >
          {{ cat.name }}
        </h3>
        <ul class="space-y-2" :aria-label="`${cat.name} hand patterns`">
          <li
            v-for="hand in cat.hands"
            :key="hand.id"
            class="rounded-md border border-chrome-border bg-chrome-surface/60"
          >
            <button
              type="button"
              class="flex w-full flex-col gap-2 p-3 text-left focus-visible:focus-ring-on-chrome"
              :data-hand-id="hand.id"
              :data-testid="`nmjl-hand-row-${hand.id}`"
              :aria-expanded="selectedHandId === hand.id"
              @click="onRowActivate(hand, $event)"
            >
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-body text-4 font-normal text-text-primary">
                  {{ hand.name ?? hand.id }}
                </span>
                <span
                  class="rounded bg-gold-accent/25 px-2 py-0.5 text-3 font-medium text-text-primary"
                >
                  {{ hand.points }}
                </span>
                <span
                  class="rounded border border-chrome-border bg-chrome-surface px-2 py-0.5 text-3 text-text-secondary"
                >
                  {{ hand.exposure }}
                </span>
              </div>
              <HandPatternNotation :hand="hand" />
            </button>
            <div
              v-if="selectedHandId === hand.id && selectedHand"
              class="border-t border-chrome-border px-3 pb-3"
            >
              <div ref="detailRootRef" tabindex="-1">
                <HandPatternDetail :hand="selectedHand" />
              </div>
              <button
                type="button"
                class="mt-3 min-h-11 w-full rounded-md border border-chrome-border bg-chrome-elevated py-2 text-3.5 font-medium text-text-primary"
                data-testid="nmjl-detail-back"
                @click="closeDetail"
              >
                Back to list
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
