<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { TableTalkReportState } from "@mahjong-game/shared";

const props = withDefaults(
  defineProps<{
    canRequestTableTalkReport?: boolean;
    tableTalkReportState?: TableTalkReportState | null;
    myTableTalkReportsUsed?: number;
    reportTargets?: { id: string; name: string }[];
    myPlayerId: string | null;
  }>(),
  {
    canRequestTableTalkReport: false,
    tableTalkReportState: null,
    myTableTalkReportsUsed: 0,
    reportTargets: () => [],
    myPlayerId: null,
  },
);

const emit = defineEmits<{
  tableTalkReport: [reportedPlayerId: string, description: string];
  tableTalkVote: [approve: boolean];
}>();

const tableTalkDescription = ref("");
const reportedPlayerId = ref("");

watch(
  () => props.reportTargets,
  (targets) => {
    if (targets.length === 0) {
      reportedPlayerId.value = "";
      return;
    }
    const ids = new Set(targets.map((t) => t.id));
    if (!reportedPlayerId.value || !ids.has(reportedPlayerId.value)) {
      reportedPlayerId.value = targets[0]!.id;
    }
  },
  { immediate: true },
);

const pendingTableTalk = computed(() => props.tableTalkReportState !== null);

const isTableTalkReporter = computed(
  () =>
    pendingTableTalk.value &&
    props.myPlayerId !== null &&
    props.tableTalkReportState?.reporterId === props.myPlayerId,
);

const isTableTalkReported = computed(
  () =>
    pendingTableTalk.value &&
    props.myPlayerId !== null &&
    props.tableTalkReportState?.reportedPlayerId === props.myPlayerId,
);

const isTableTalkVoter = computed(() => {
  if (!pendingTableTalk.value || props.myPlayerId === null) return false;
  const s = props.tableTalkReportState;
  return s !== null && s.voterIds.includes(props.myPlayerId);
});

const myTableTalkVote = computed(() => {
  if (!props.myPlayerId || !props.tableTalkReportState) return undefined;
  return props.tableTalkReportState.votes[props.myPlayerId];
});

const showTableTalkVoteButtons = computed(
  () => isTableTalkVoter.value && myTableTalkVote.value === undefined,
);

const tableTalkApproveCount = computed(
  () =>
    Object.values(props.tableTalkReportState?.votes ?? {}).filter((v) => v === "approve").length,
);

const tableTalkAtReportLimit = computed(() => props.myTableTalkReportsUsed >= 2);

const reportedPlayerLabel = computed(() => {
  const id = props.tableTalkReportState?.reportedPlayerId;
  if (!id) return "";
  return props.reportTargets.find((t) => t.id === id)?.name ?? id;
});

function submitTableTalkReport() {
  const d = tableTalkDescription.value.trim();
  const rid = reportedPlayerId.value;
  if (!d || !rid) return;
  emit("tableTalkReport", rid, d);
  tableTalkDescription.value = "";
}
</script>

<template>
  <div v-if="canRequestTableTalkReport || pendingTableTalk">
    <template v-if="canRequestTableTalkReport && !pendingTableTalk && !tableTalkAtReportLimit">
      <p class="mb-2 font-medium">Table talk report</p>
      <p class="text-text-secondary mb-2 text-2.5">
        Report a player who named a tile they need. 2 of 3 other players must uphold.
      </p>
      <label class="mb-2 block text-2.5 text-text-secondary" for="table-talk-accused">
        Accused player
      </label>
      <select
        id="table-talk-accused"
        :key="reportTargets.map((t) => t.id).join(',')"
        v-model="reportedPlayerId"
        class="mb-2 w-full rounded border border-chrome-border bg-chrome-surface px-2 py-1 text-3 text-text-primary"
      >
        <option v-for="t in reportTargets" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          v-model="tableTalkDescription"
          type="text"
          maxlength="280"
          placeholder="Brief description…"
          class="min-w-0 flex-1 rounded border border-chrome-border bg-chrome-surface px-2 py-1 text-3 text-text-primary"
          @keydown.enter.prevent="submitTableTalkReport"
        />
        <button
          type="button"
          class="min-tap rounded-md bg-state-warning px-3 py-1.5 text-3 font-medium text-text-on-felt"
          @click="submitTableTalkReport"
        >
          Submit report
        </button>
      </div>
    </template>
    <p
      v-else-if="canRequestTableTalkReport && tableTalkAtReportLimit"
      class="text-text-secondary text-2.5"
    >
      Table talk report limit reached for this game (2 per player).
    </p>

    <template v-else-if="pendingTableTalk && tableTalkReportState">
      <p class="font-medium">Table talk report</p>
      <p class="text-text-secondary mt-1">{{ tableTalkReportState.description }}</p>
      <p class="mt-1 text-2.5 text-text-secondary">Accused: {{ reportedPlayerLabel }}</p>
      <p v-if="isTableTalkReporter" class="mt-2 text-text-secondary">
        Waiting for votes (2 of 3 must uphold)…
      </p>
      <p v-else-if="isTableTalkReported" class="mt-2 text-text-secondary">
        You were reported. You may vote deny.
      </p>
      <template v-else-if="showTableTalkVoteButtons">
        <p class="mt-2">Uphold this table talk report?</p>
        <div class="mt-2 flex gap-2">
          <button
            type="button"
            class="min-tap rounded-md bg-state-success px-3 py-1.5 text-3 font-medium"
            @click="emit('tableTalkVote', true)"
          >
            Uphold
          </button>
          <button
            type="button"
            class="min-tap rounded-md bg-state-error px-3 py-1.5 text-3 font-medium text-text-on-felt"
            @click="emit('tableTalkVote', false)"
          >
            Deny
          </button>
        </div>
      </template>
      <p v-else-if="myTableTalkVote" class="mt-2 text-text-secondary">
        Your vote: {{ myTableTalkVote }}
      </p>
      <p v-else class="mt-2 text-text-secondary">
        Vote in progress ({{ tableTalkApproveCount }}/2 uphold needed of 3 voters)
      </p>
    </template>
  </div>
</template>
