<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import type { SocialOverrideState, TableTalkReportState } from "@mahjong-game/shared";
import SocialOverrideSection from "./SocialOverrideSection.vue";
import TableTalkReportSection from "./TableTalkReportSection.vue";

const props = withDefaults(
  defineProps<{
    canRequestSocialOverride?: boolean;
    socialOverrideState?: SocialOverrideState | null;
    canRequestTableTalkReport?: boolean;
    tableTalkReportState?: TableTalkReportState | null;
    myTableTalkReportsUsed?: number;
    reportTargets?: { id: string; name: string }[];
    myPlayerId: string | null;
  }>(),
  {
    canRequestSocialOverride: false,
    socialOverrideState: null,
    canRequestTableTalkReport: false,
    tableTalkReportState: null,
    myTableTalkReportsUsed: 0,
    reportTargets: () => [],
    myPlayerId: null,
  },
);

const emit = defineEmits<{
  socialOverrideRequest: [description: string];
  socialOverrideVote: [approve: boolean];
  tableTalkReport: [reportedPlayerId: string, description: string];
  tableTalkVote: [approve: boolean];
}>();

const pendingSocial = computed(() => props.socialOverrideState !== null);
const pendingTableTalk = computed(() => props.tableTalkReportState !== null);
const tableTalkAtReportLimit = computed(() => props.myTableTalkReportsUsed >= 2);

const tableTalkModalUserOpen = ref(false);
const tableTalkModalRootRef = ref<HTMLElement | null>(null);
/** Programmatic focus target when the modal body has no focusable controls (e.g. reporter waiting). */
const tableTalkReportTitleRef = ref<HTMLElement | null>(null);

const showSocialOverrideChrome = computed(
  () => props.canRequestSocialOverride || pendingSocial.value,
);

const showTableTalkTrigger = computed(
  () => props.canRequestTableTalkReport && !pendingTableTalk.value && !tableTalkAtReportLimit.value,
);

const showTableTalkLimitHint = computed(
  () => props.canRequestTableTalkReport && !pendingTableTalk.value && tableTalkAtReportLimit.value,
);

const tableTalkOverlayOpen = computed(
  () =>
    pendingTableTalk.value ||
    (tableTalkModalUserOpen.value &&
      props.canRequestTableTalkReport &&
      !tableTalkAtReportLimit.value),
);

const showPanel = computed(
  () =>
    showSocialOverrideChrome.value || showTableTalkTrigger.value || showTableTalkLimitHint.value,
);

function openTableTalkModal() {
  tableTalkModalUserOpen.value = true;
}

function closeTableTalkModal() {
  if (pendingTableTalk.value) return;
  tableTalkModalUserOpen.value = false;
}

function onTableTalkBackdropClick() {
  closeTableTalkModal();
}

function onTableTalkKeydown(ev: KeyboardEvent) {
  if (ev.key === "Escape" && !pendingTableTalk.value) {
    ev.preventDefault();
    closeTableTalkModal();
  }
}

watch(pendingTableTalk, (pending, wasPending) => {
  if (wasPending && !pending) {
    tableTalkModalUserOpen.value = false;
  }
});

watch(tableTalkOverlayOpen, async (open) => {
  if (open) {
    document.addEventListener("keydown", onTableTalkKeydown);
    await nextTick();
    const root = tableTalkModalRootRef.value;
    const firstFocusable = root?.querySelector<HTMLElement>(
      "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])",
    );
    if (firstFocusable) {
      firstFocusable.focus();
    } else {
      tableTalkReportTitleRef.value?.focus();
    }
  } else {
    document.removeEventListener("keydown", onTableTalkKeydown);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("keydown", onTableTalkKeydown);
});
</script>

<template>
  <Teleport to="body">
    <div
      v-if="tableTalkOverlayOpen"
      ref="tableTalkModalRootRef"
      data-testid="table-talk-report-modal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="table-talk-report-title"
      @click.self="onTableTalkBackdropClick"
    >
      <div
        class="max-w-md w-full rounded-lg border border-chrome-border bg-chrome-surface p-6 text-text-primary shadow-lg"
        @click.stop
      >
        <div class="mb-3 flex items-start justify-between gap-2">
          <h2
            id="table-talk-report-title"
            ref="tableTalkReportTitleRef"
            tabindex="-1"
            class="text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-state-turn-active/60 focus-visible:ring-offset-2"
          >
            Table talk report
          </h2>
          <button
            v-if="!pendingTableTalk"
            type="button"
            data-testid="table-talk-report-close"
            class="min-tap shrink-0 rounded-md border border-chrome-border bg-chrome-surface px-3 py-1.5 text-3 text-text-primary"
            @click="closeTableTalkModal"
          >
            Close
          </button>
        </div>
        <TableTalkReportSection
          :can-request-table-talk-report="canRequestTableTalkReport"
          :table-talk-report-state="tableTalkReportState ?? null"
          :my-table-talk-reports-used="myTableTalkReportsUsed"
          :report-targets="reportTargets"
          :my-player-id="myPlayerId"
          omit-heading
          @table-talk-report="(rid, d) => emit('tableTalkReport', rid, d)"
          @table-talk-vote="emit('tableTalkVote', $event)"
        />
      </div>
    </div>
  </Teleport>

  <div
    v-if="showPanel"
    data-testid="social-override-panel"
    class="max-w-md w-full rounded-lg border border-state-turn-active/40 bg-chrome-surface-dark/95 px-3 py-2 text-3 text-text-on-felt shadow-md flex flex-col gap-4"
  >
    <SocialOverrideSection
      v-if="canRequestSocialOverride || pendingSocial"
      :can-request-social-override="canRequestSocialOverride"
      :social-override-state="socialOverrideState ?? null"
      :my-player-id="myPlayerId"
      @social-override-request="emit('socialOverrideRequest', $event)"
      @social-override-vote="emit('socialOverrideVote', $event)"
    />
    <div v-if="showTableTalkTrigger">
      <button
        type="button"
        data-testid="table-talk-report-open"
        class="min-tap rounded-md border border-chrome-border/60 bg-chrome-surface/20 px-3 py-2 text-3 font-medium text-text-on-felt"
        @click="openTableTalkModal"
      >
        Report table talk violation…
      </button>
    </div>
    <p v-else-if="showTableTalkLimitHint" class="text-text-secondary text-2.5">
      Table talk report limit reached for this game (2 per player).
    </p>
  </div>
</template>
