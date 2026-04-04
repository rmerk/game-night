<script setup lang="ts">
import { computed } from "vue";
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

const showPanel = computed(
  () =>
    props.canRequestSocialOverride ||
    pendingSocial.value ||
    props.canRequestTableTalkReport ||
    pendingTableTalk.value,
);
</script>

<template>
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
    <TableTalkReportSection
      v-if="canRequestTableTalkReport || pendingTableTalk"
      :can-request-table-talk-report="canRequestTableTalkReport"
      :table-talk-report-state="tableTalkReportState ?? null"
      :my-table-talk-reports-used="myTableTalkReportsUsed"
      :report-targets="reportTargets"
      :my-player-id="myPlayerId"
      @table-talk-report="(rid, d) => emit('tableTalkReport', rid, d)"
      @table-talk-vote="emit('tableTalkVote', $event)"
    />
  </div>
</template>
