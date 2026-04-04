<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { useNow } from "@vueuse/core";
import TileRack from "./TileRack.vue";
import ActionZone from "./ActionZone.vue";
import OpponentArea from "./OpponentArea.vue";
import TurnIndicator from "./TurnIndicator.vue";
import WallCounter from "./WallCounter.vue";
import MobileBottomBar from "./MobileBottomBar.vue";
import SlideInReferencePanels from "../chat/SlideInReferencePanels.vue";
import { SLIDE_IN_CHAT_PANEL_ROOT_ID, SLIDE_IN_NMJL_PANEL_ROOT_ID } from "../chat/slideInPanelIds";
import DiscardPool from "./DiscardPool.vue";
import DiscardConfirm from "./DiscardConfirm.vue";
import CallButtons from "./CallButtons.vue";
import MahjongButton from "./MahjongButton.vue";
import InvalidMahjongNotification from "./InvalidMahjongNotification.vue";
import SocialOverridePanel from "./SocialOverridePanel.vue";
import BaseBadge from "../ui/BaseBadge.vue";
import BasePanel from "../ui/BasePanel.vue";
import Scoreboard from "../scoreboard/Scoreboard.vue";
import CharlestonZone from "../charleston/CharlestonZone.vue";
import CharlestonVote from "../charleston/CharlestonVote.vue";
import CourtesyPassUI from "../charleston/CourtesyPassUI.vue";
import type { LocalPlayerSummary, OpponentPlayer } from "./seat-types";
import {
  SEATS,
  type Tile,
  type CallType,
  type CallWindowState,
  type GamePhase,
  type GameResult,
  type PlayerCharlestonView,
  type ResolvedAction,
  type SeatWind,
  type SocialOverrideState,
  type TableTalkReportState,
} from "@mahjong-game/shared";
import { useRackStore } from "../../stores/rack";
import { useSlideInPanelStore } from "../../stores/slideInPanel";
import { useTileSelection } from "../../composables/useTileSelection";
import { getRequiredRackCountForCallType } from "../../composables/gameActionFromPlayerView";

const rackStore = useRackStore();
const slideInPanelStore = useSlideInPanelStore();

const props = withDefaults(
  defineProps<{
    opponents?: {
      top?: OpponentPlayer | null;
      left?: OpponentPlayer | null;
      right?: OpponentPlayer | null;
    };
    tiles?: Tile[];
    isPlayerTurn?: boolean;
    localPlayer?: LocalPlayerSummary | null;
    currentTurnSeat?: SeatWind | null;
    wallRemaining?: number;
    gamePhase?: GamePhase;
    gameResult?: GameResult | null;
    discardPools?: {
      bottom?: Tile[];
      top?: Tile[];
      left?: Tile[];
      right?: Tile[];
    };
    callWindow?: CallWindowState | null;
    validCallOptions?: CallType[];
    invalidMahjongMessage?: string | null;
    charleston?: PlayerCharlestonView | null;
    resolvedAction?: ResolvedAction | null;
    /** Private: this viewer's hand is dead (from PlayerGameView.myDeadHand) */
    myDeadHand?: boolean;
    /** True when discarder may open a social-override vote (call window open, no calls) */
    canRequestSocialOverride?: boolean;
    socialOverrideState?: SocialOverrideState | null;
    /** Table talk report (Story 3C.5) — distinct from social override */
    canRequestTableTalkReport?: boolean;
    tableTalkReportState?: TableTalkReportState | null;
    tableTalkReportCountsByPlayerId?: Record<string, number>;
  }>(),
  {
    opponents: () => ({}),
    tiles: () => [],
    isPlayerTurn: false,
    localPlayer: null,
    currentTurnSeat: null,
    wallRemaining: 70,
    gamePhase: "play",
    gameResult: null,
    discardPools: () => ({}),
    callWindow: null,
    validCallOptions: () => [],
    invalidMahjongMessage: null,
    charleston: null,
    resolvedAction: null,
    myDeadHand: false,
    canRequestSocialOverride: false,
    socialOverrideState: null,
    canRequestTableTalkReport: false,
    tableTalkReportState: null,
    tableTalkReportCountsByPlayerId: undefined,
  },
);

const emit = defineEmits<{
  discard: [tileId: string];
  call: [callType: CallType];
  pass: [];
  declareMahjong: [];
  cancelMahjong: [];
  charlestonPass: [tileIds: string[]];
  charlestonVote: [accept: boolean];
  courtesyPass: [payload: { count: number; tileIds: string[] }];
  socialOverrideRequest: [description: string];
  socialOverrideVote: [approve: boolean];
  tableTalkReport: [reportedPlayerId: string, description: string];
  tableTalkVote: [approve: boolean];
  /** Non-Mahjong: selected rack tile ids; Mahjong: single placeholder id (server requires non-empty tileIds). */
  confirmCall: [payload: { tileIds: string[] }];
  retractCall: [];
  sendChat: [text: string];
}>();

const courtesyTileTarget = ref(0);

const tileTargetCount = computed(() => {
  if (props.gamePhase === "charleston" && props.charleston) {
    if (props.charleston.status === "passing") {
      return 3;
    }
    if (props.charleston.status === "courtesy-ready") {
      return courtesyTileTarget.value;
    }
    return 0;
  }
  const cw = props.callWindow;
  if (
    props.gamePhase === "play" &&
    cw?.status === "confirming" &&
    cw.confirmingPlayerId === props.localPlayer?.id &&
    cw.winningCall
  ) {
    return getRequiredRackCountForCallType(cw.winningCall.callType);
  }
  return 0;
});

const {
  selectedIds,
  isComplete,
  progressText,
  confirmedIds,
  toggleTile,
  reset: resetTileSelection,
} = useTileSelection(tileTargetCount);

watch(courtesyTileTarget, () => {
  resetTileSelection();
});

watch(
  () => props.charleston?.status,
  (status) => {
    if (status === "courtesy-ready") {
      courtesyTileTarget.value = 0;
    }
    resetTileSelection();
  },
);

watch(
  () => props.charleston?.currentDirection,
  (dir, prev) => {
    if (prev !== undefined && dir !== prev) {
      resetTileSelection();
    }
  },
);

const isLocalConfirmingCall = computed(() => {
  const cw = props.callWindow;
  return (
    props.gamePhase === "play" &&
    cw?.status === "confirming" &&
    cw.confirmingPlayerId !== null &&
    cw.confirmingPlayerId === props.localPlayer?.id
  );
});

/** Identity of the winning call being confirmed — resets selection when it changes (not on timer-only ticks). */
const callConfirmationIdentityKey = computed(() => {
  const cw = props.callWindow;
  if (
    props.gamePhase !== "play" ||
    cw?.status !== "confirming" ||
    cw.confirmingPlayerId !== props.localPlayer?.id ||
    !cw.winningCall
  ) {
    return null;
  }
  const wc = cw.winningCall;
  return `${wc.callType}-${wc.playerId}-${wc.tileIds.join(",")}`;
});

watch(callConfirmationIdentityKey, (key, prev) => {
  if (key === null) {
    return;
  }
  if (prev === undefined || key !== prev) {
    resetTileSelection();
    rackStore.deselectTile();
  }
});

const now = useNow({ interval: 1000 });

const confirmationSecondsRemaining = computed(() => {
  const exp = props.callWindow?.confirmationExpiresAt;
  if (!isLocalConfirmingCall.value || exp == null) {
    return null;
  }
  return Math.max(0, Math.ceil((exp - now.value.getTime()) / 1000));
});

const isCharlestonPhase = computed(
  () => props.gamePhase === "charleston" && props.charleston !== null,
);

const rackInteractive = computed(() => {
  if (props.gamePhase === "scoreboard") {
    return false;
  }
  if (isCharlestonPhase.value && props.charleston) {
    if (props.charleston.mySubmissionLocked) {
      return false;
    }
    if (props.charleston.status === "vote-ready") {
      return false;
    }
    return true;
  }
  if (isLocalConfirmingCall.value) {
    return true;
  }
  return props.isPlayerTurn;
});

const charlestonSelectionMode = computed(() => {
  if (!isCharlestonPhase.value || !props.charleston) {
    return false;
  }
  if (props.charleston.mySubmissionLocked) {
    return false;
  }
  if (props.charleston.status === "passing") {
    return true;
  }
  if (props.charleston.status === "courtesy-ready") {
    return courtesyTileTarget.value > 0;
  }
  return false;
});

/** Multi-select from rack via useTileSelection (non-Mahjong call confirmation). */
const callConfirmationSelectionMode = computed(() => {
  const cw = props.callWindow;
  return (
    isLocalConfirmingCall.value &&
    cw !== null &&
    cw.winningCall !== null &&
    cw.winningCall.callType !== "mahjong" &&
    getRequiredRackCountForCallType(cw.winningCall.callType) > 0
  );
});

const rackMultiSelectMode = computed(
  () => charlestonSelectionMode.value || callConfirmationSelectionMode.value,
);

const hiddenTilePlaceholderCount = computed(() => {
  if (!isCharlestonPhase.value || !props.charleston) {
    return 0;
  }
  if (props.charleston.mySubmissionLocked) {
    return 0;
  }
  return props.charleston.myHiddenTileCount;
});

const rackPassAnimClass = ref<string | null>(null);
const rackPassAnimTimers: ReturnType<typeof setTimeout>[] = [];

function clearRackPassAnimTimers() {
  while (rackPassAnimTimers.length > 0) {
    const t = rackPassAnimTimers.pop();
    if (t !== undefined) {
      clearTimeout(t);
    }
  }
}

onBeforeUnmount(() => {
  clearRackPassAnimTimers();
});

watch(
  () => props.resolvedAction,
  (ra) => {
    if (ra?.type !== "CHARLESTON_PHASE_COMPLETE") {
      return;
    }
    clearRackPassAnimTimers();
    const dir = ra.direction;
    const outClass =
      dir === "right"
        ? "game-table__rack-pass--right"
        : dir === "left"
          ? "game-table__rack-pass--left"
          : "game-table__rack-pass--across";
    const receiveClass =
      dir === "right"
        ? "game-table__rack-receive--from-left"
        : dir === "left"
          ? "game-table__rack-receive--from-right"
          : "game-table__rack-receive--from-below";

    rackPassAnimClass.value = outClass;
    rackPassAnimTimers.push(
      setTimeout(() => {
        rackPassAnimClass.value = receiveClass;
        rackPassAnimTimers.push(
          setTimeout(() => {
            rackPassAnimClass.value = null;
          }, 400),
        );
      }, 400),
    );
  },
);

function onCourtesyCountChange(n: number) {
  courtesyTileTarget.value = n;
}

function onCharlestonPassFromZone() {
  emit("charlestonPass", [...confirmedIds.value]);
}

function onCourtesyPassFromUi(count: number, _tileIds: string[]) {
  const tileIds = count === 0 ? [] : [...confirmedIds.value];
  emit("courtesyPass", { count, tileIds });
}

function handleDiscard(tileId: string) {
  rackStore.deselectTile();
  emit("discard", tileId);
}

/** Order selected ids by current rack order so payloads match visual left-to-right order. */
function orderConfirmTileIdsByRack(tileIds: string[]): string[] {
  const want = new Set(tileIds);
  const ordered = rackStore.tileOrder.filter((id) => want.has(id));
  if (ordered.length === tileIds.length) {
    return ordered;
  }
  return [...tileIds];
}

function onConfirmCallClick() {
  const cw = props.callWindow;
  if (!cw || cw.status !== "confirming" || cw.winningCall === null) {
    return;
  }
  if (cw.winningCall.callType === "mahjong") {
    const first = props.tiles[0];
    if (!first) {
      return;
    }
    emit("confirmCall", { tileIds: [first.id] });
    return;
  }
  if (!isComplete.value) {
    return;
  }
  emit("confirmCall", { tileIds: orderConfirmTileIdsByRack([...confirmedIds.value]) });
}

function onRetractCallClick() {
  emit("retractCall");
}

const isConfirmingMahjongCall = computed(
  () => isLocalConfirmingCall.value && props.callWindow?.winningCall?.callType === "mahjong",
);

const topPlayer = computed(() => props.opponents.top ?? null);
const leftPlayer = computed(() => props.opponents.left ?? null);
const rightPlayer = computed(() => props.opponents.right ?? null);

const reportTargets = computed(() => {
  const list: { id: string; name: string }[] = [];
  for (const opp of [props.opponents?.top, props.opponents?.left, props.opponents?.right]) {
    if (opp) list.push({ id: opp.id, name: opp.name });
  }
  return list;
});

const myTableTalkReportsUsed = computed(() => {
  if (!props.localPlayer?.id) return 0;
  return props.tableTalkReportCountsByPlayerId?.[props.localPlayer.id] ?? 0;
});

const openCallWindow = computed(() => {
  const cw = props.callWindow;
  return cw !== null && cw.status === "open" ? cw : null;
});

const isCallWindowOpen = computed(() => openCallWindow.value !== null);
const callWindowHasMahjong = computed(
  () => isCallWindowOpen.value && props.validCallOptions.includes("mahjong"),
);
const invalidMahjongVisible = computed(() => props.invalidMahjongMessage !== null);
const isScoreboardPhase = computed(() => props.gamePhase === "scoreboard");
const playerNamesBySeat = computed<Record<SeatWind, string>>(() => {
  const names: Record<SeatWind, string> = {
    east: "East",
    south: "South",
    west: "West",
    north: "North",
  };

  if (props.localPlayer) {
    names[props.localPlayer.seatWind] = props.localPlayer.name;
  }

  for (const player of [topPlayer.value, leftPlayer.value, rightPlayer.value]) {
    if (player) {
      names[player.seatWind] = player.name;
    }
  }

  return names;
});

const playersBySeat = computed(() => {
  const players: Partial<Record<SeatWind, { id: string; name: string; score: number }>> = {};

  if (props.localPlayer) {
    players[props.localPlayer.seatWind] = {
      id: props.localPlayer.id,
      name: props.localPlayer.name,
      score: props.localPlayer.score,
    };
  }

  for (const player of [topPlayer.value, leftPlayer.value, rightPlayer.value]) {
    if (player) {
      players[player.seatWind] = {
        id: player.id,
        name: player.name,
        score: player.score ?? 0,
      };
    }
  }

  return players;
});

const playerNamesById = computed<Record<string, string>>(() => {
  const entries = Object.values(playersBySeat.value).map((player) => [player.id, player.name]);
  return Object.fromEntries(entries);
});

const playerOrder = computed(() =>
  SEATS.map((seat) => playersBySeat.value[seat]?.id).filter((playerId): playerId is string =>
    Boolean(playerId),
  ),
);

const sessionScores = computed<Record<string, number>>(() => {
  const entries = Object.values(playersBySeat.value).map((player) => [player.id, player.score]);
  return Object.fromEntries(entries);
});

const actionZoneEntryRef = useTemplateRef<HTMLDivElement>("actionZoneEntry");

function isSeatActive(seatWind: SeatWind | undefined): boolean {
  return seatWind !== undefined && props.currentTurnSeat === seatWind;
}

const isLocalPlayerTurn = computed(() => isSeatActive(props.localPlayer?.seatWind));

function focusActionZone() {
  actionZoneEntryRef.value?.focus();
}

function onChatEscape() {
  focusActionZone();
}

// Story 6A.3: hide ReactionBar when any slide-in panel is open — use slideInPanelStore.isAnySlideInPanelOpen.
</script>

<template>
  <a
    data-testid="skip-to-game-table"
    href="#gameplay-region"
    class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-chrome-surface focus:px-4 focus:py-2 focus:text-text-primary focus:focus-ring-on-chrome"
  >
    Skip to game table
  </a>
  <div
    id="gameplay-region"
    data-testid="game-table"
    class="game-table relative bg-felt-teal min-h-[100dvh] max-w-screen-2xl mx-auto grid gap-2 p-2 lg:p-4"
  >
    <!-- Opponent Top -->
    <div data-testid="opponent-top" class="game-table__opponent-top flex justify-center">
      <OpponentArea
        position="top"
        :player="topPlayer"
        :is-active-turn="isSeatActive(topPlayer?.seatWind)"
        :score="topPlayer?.score ?? null"
      />
    </div>

    <!-- Left / Center / Right row -->
    <div class="game-table__middle grid md:grid-cols-[auto_1fr_auto] gap-2">
      <!-- Opponent Left (hidden on phone, shown via grid on tablet/desktop) -->
      <div
        data-testid="opponent-left"
        class="game-table__opponent-left hidden md:flex items-center justify-center"
      >
        <OpponentArea
          position="left"
          :player="leftPlayer"
          :is-active-turn="isSeatActive(leftPlayer?.seatWind)"
          :score="leftPlayer?.score ?? null"
        />
      </div>

      <!-- Table Center -->
      <div
        data-testid="table-center"
        class="game-table__center min-h-[40dvh] flex flex-col items-center justify-center gap-4"
      >
        <Scoreboard
          v-if="isScoreboardPhase"
          :game-result="gameResult"
          :player-names-by-id="playerNamesById"
          :player-order="playerOrder"
          :session-scores="sessionScores"
        />

        <template v-else>
          <div class="flex w-full justify-center">
            <WallCounter :wall-remaining="wallRemaining" />
          </div>

          <template v-if="isCharlestonPhase && charleston">
            <CharlestonZone
              v-if="charleston.status === 'passing'"
              :charleston="charleston"
              :my-rack="tiles"
              :selected-tile-ids="selectedIds"
              :is-complete="isComplete"
              :progress-text="progressText"
              @pass="onCharlestonPassFromZone"
            />
            <CourtesyPassUI
              v-else-if="charleston.status === 'courtesy-ready'"
              :charleston="charleston"
              :selected-tile-ids="selectedIds"
              :is-complete="isComplete"
              :progress-text="progressText"
              @count-change="onCourtesyCountChange"
              @courtesy-pass="onCourtesyPassFromUi"
            />
          </template>

          <template v-else>
            <TurnIndicator
              v-if="currentTurnSeat"
              :active-seat="currentTurnSeat"
              :player-names-by-seat="playerNamesBySeat"
            />

            <SocialOverridePanel
              v-if="gamePhase === 'play'"
              :can-request-social-override="canRequestSocialOverride"
              :social-override-state="socialOverrideState ?? null"
              :can-request-table-talk-report="canRequestTableTalkReport"
              :table-talk-report-state="tableTalkReportState ?? null"
              :my-table-talk-reports-used="myTableTalkReportsUsed"
              :report-targets="reportTargets"
              :my-player-id="localPlayer?.id ?? null"
              @social-override-request="(d: string) => emit('socialOverrideRequest', d)"
              @social-override-vote="(a: boolean) => emit('socialOverrideVote', a)"
              @table-talk-report="
                (reportedId: string, d: string) => emit('tableTalkReport', reportedId, d)
              "
              @table-talk-vote="(a: boolean) => emit('tableTalkVote', a)"
            />

            <!-- Phone: inline opponent row for left/right -->
            <div class="flex md:hidden gap-4 justify-center w-full">
              <OpponentArea
                position="left"
                :player="leftPlayer"
                :is-active-turn="isSeatActive(leftPlayer?.seatWind)"
                :score="leftPlayer?.score ?? null"
              />
              <OpponentArea
                position="right"
                :player="rightPlayer"
                :is-active-turn="isSeatActive(rightPlayer?.seatWind)"
                :score="rightPlayer?.score ?? null"
              />
            </div>

            <!-- Discard Pools -->
            <div
              data-testid="discard-pools"
              class="discard-pools grid grid-cols-[auto_1fr_auto] grid-rows-[auto_1fr_auto] gap-1 w-full max-w-lg transition-shadow"
              :class="{
                'ring-2 ring-state-warning/60 rounded-lg p-1':
                  socialOverrideState || tableTalkReportState,
              }"
            >
              <div class="col-start-2 flex justify-center">
                <DiscardPool :tiles="discardPools?.top ?? []" position="top" />
              </div>
              <div class="row-start-2 flex items-center">
                <DiscardPool :tiles="discardPools?.left ?? []" position="left" />
              </div>
              <div class="row-start-2 col-start-2" />
              <div class="row-start-2 col-start-3 flex items-center">
                <DiscardPool :tiles="discardPools?.right ?? []" position="right" />
              </div>
              <div class="col-start-2 row-start-3 flex justify-center">
                <DiscardPool :tiles="discardPools?.bottom ?? []" position="bottom" />
              </div>
            </div>
          </template>
        </template>
      </div>

      <!-- Opponent Right (hidden on phone, shown via grid on tablet/desktop) -->
      <div
        data-testid="opponent-right"
        class="game-table__opponent-right hidden md:flex flex-col items-center justify-center gap-2"
      >
        <div class="flex flex-col gap-2">
          <button
            type="button"
            data-testid="nmjl-toggle-desktop"
            class="rounded-md border border-transparent bg-transparent px-3 py-2 text-3 text-text-secondary/90 hover:bg-chrome-surface/40 focus-visible:focus-ring-on-felt"
            :aria-expanded="slideInPanelStore.activePanel === 'nmjl'"
            :aria-controls="SLIDE_IN_NMJL_PANEL_ROOT_ID"
            @click="slideInPanelStore.openNmjl()"
          >
            Card
          </button>
          <button
            type="button"
            data-testid="chat-toggle-desktop"
            class="rounded-md border border-transparent bg-transparent px-3 py-2 text-3 text-text-secondary/90 hover:bg-chrome-surface/40 focus-visible:focus-ring-on-felt"
            :aria-expanded="slideInPanelStore.activePanel === 'chat'"
            :aria-controls="SLIDE_IN_CHAT_PANEL_ROOT_ID"
            @click="slideInPanelStore.toggleChat()"
          >
            Chat
          </button>
        </div>
        <OpponentArea
          position="right"
          :player="rightPlayer"
          :is-active-turn="isSeatActive(rightPlayer?.seatWind)"
          :score="rightPlayer?.score ?? null"
        />
      </div>
    </div>

    <!-- Rack Area -->
    <div
      v-if="!isScoreboardPhase"
      data-testid="rack-area"
      class="game-table__rack order-4 md:pb-[env(safe-area-inset-bottom)] transition-transform"
      :class="rackPassAnimClass"
    >
      <div data-testid="rack-zone-entry">
        <div v-if="localPlayer" class="mb-2 flex justify-center">
          <BasePanel
            data-testid="local-player-status-shell"
            tag="div"
            variant="dark-raised"
            class="inline-flex flex-wrap items-center justify-center gap-2 rounded-full px-4 py-2"
            :class="{ 'ring-2 ring-state-turn-active': isLocalPlayerTurn }"
          >
            <span class="text-interactive">{{ localPlayer.name }}</span>
            <BaseBadge
              v-if="isLocalPlayerTurn"
              data-testid="local-player-status"
              variant="pill"
              tone="active"
              class="text-text-on-felt"
            >
              Current turn
            </BaseBadge>
            <span data-testid="local-player-score" class="text-3 text-text-on-felt/85">
              Score: {{ localPlayer.score }}
            </span>
          </BasePanel>
          <div
            v-if="myDeadHand"
            data-testid="dead-hand-badge"
            class="mt-2 inline-flex rounded-md border border-state-error px-2 py-1 text-3 text-text-secondary"
          >
            Dead Hand
          </div>
        </div>
        <TileRack
          :tiles="tiles"
          :is-player-turn="rackInteractive"
          :charleston-selection-mode="rackMultiSelectMode"
          :charleston-selected-ids="selectedIds"
          :charleston-toggle-tile="rackMultiSelectMode ? toggleTile : undefined"
          :hidden-placeholder-count="hiddenTilePlaceholderCount"
        />
      </div>
    </div>

    <!-- Action Zone -->
    <div v-if="!isScoreboardPhase" data-testid="action-zone" class="order-3">
      <div ref="actionZoneEntry" data-testid="action-zone-entry" tabindex="-1">
        <ActionZone>
          <div class="flex flex-col items-center justify-center gap-2">
            <div data-toolbar-controls class="flex flex-wrap items-center justify-center gap-2">
              <CharlestonVote
                v-if="isCharlestonPhase && charleston?.status === 'vote-ready'"
                :my-vote="charleston.myVote"
                :votes-received-count="charleston.votesReceivedCount"
                @vote="(accept: boolean) => emit('charlestonVote', accept)"
              />
              <MahjongButton
                v-if="gamePhase === 'play' && !isLocalConfirmingCall"
                :is-call-window-open="isCallWindowOpen"
                :hide-for-call-duplication="callWindowHasMahjong"
                :my-dead-hand="myDeadHand"
                @declare-mahjong="emit('declareMahjong')"
                @call-mahjong="emit('call', 'mahjong')"
              />
              <Transition name="call-buttons">
                <CallButtons
                  v-if="gamePhase === 'play' && openCallWindow"
                  :valid-calls="validCallOptions"
                  :call-window-status="openCallWindow.status"
                  :hide-calls-for-dead-hand="myDeadHand"
                  @call="(callType: CallType) => emit('call', callType)"
                  @pass="emit('pass')"
                />
              </Transition>
              <div
                v-if="gamePhase === 'play' && isLocalConfirmingCall"
                data-testid="call-confirmation-toolbar"
                class="flex flex-col items-center gap-2 rounded-lg border border-chrome-border bg-chrome-surface/90 px-4 py-3"
                role="region"
                aria-label="Call confirmation"
              >
                <p
                  v-if="!isConfirmingMahjongCall"
                  class="text-3.5 text-text-primary"
                  aria-live="polite"
                >
                  {{ progressText
                  }}<span v-if="confirmationSecondsRemaining !== null">
                    · {{ confirmationSecondsRemaining }}s left</span
                  >
                </p>
                <p v-else class="text-3.5 text-text-primary" aria-live="polite">
                  Confirm your Mahjong or retract.<span
                    v-if="confirmationSecondsRemaining !== null"
                  >
                    ({{ confirmationSecondsRemaining }}s)</span
                  >
                </p>
                <div class="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    data-testid="call-confirmation-confirm"
                    class="min-h-11 min-w-[7rem] rounded-md bg-state-turn-active px-4 py-2 text-3.5 font-medium text-text-on-felt disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="isConfirmingMahjongCall ? tiles.length === 0 : !isComplete"
                    @click="onConfirmCallClick"
                  >
                    {{ isConfirmingMahjongCall ? "Confirm Mahjong" : "Confirm" }}
                  </button>
                  <button
                    type="button"
                    data-testid="call-confirmation-retract"
                    class="min-h-11 min-w-[7rem] rounded-md border border-chrome-border bg-chrome-elevated px-4 py-2 text-3.5 font-medium text-text-primary"
                    @click="onRetractCallClick"
                  >
                    Retract
                  </button>
                </div>
              </div>
              <DiscardConfirm
                v-if="gamePhase === 'play' && !isCallWindowOpen && !isLocalConfirmingCall"
                :selected-tile-id="rackStore.selectedTileId"
                :is-player-turn="isPlayerTurn"
                @discard="handleDiscard"
              />
            </div>
            <InvalidMahjongNotification
              :visible="invalidMahjongVisible"
              :message="invalidMahjongMessage ?? ''"
              @cancel="emit('cancelMahjong')"
            />
          </div>
        </ActionZone>
      </div>
    </div>

    <SlideInReferencePanels
      v-if="!isScoreboardPhase"
      :send-chat="(t: string) => emit('sendChat', t)"
      :on-escape-focus-target="onChatEscape"
    />

    <!-- DOM anchor between actions and mobile controls (a11y / test document order); panel content mounts when open. -->
    <div
      v-if="!isScoreboardPhase"
      data-testid="chat-shell-anchor"
      class="order-5 sr-only"
      aria-hidden="true"
    />

    <div
      v-if="!isScoreboardPhase"
      data-testid="controls-zone-shell"
      class="order-6 flex justify-center"
    >
      <div data-testid="controls-zone-entry" class="w-full max-w-sm">
        <MobileBottomBar />
      </div>
    </div>
  </div>
</template>

<style scoped>
.call-buttons-leave-active {
  position: absolute;
  transition:
    opacity var(--timing-exit, 150ms) ease-in,
    transform var(--timing-exit, 150ms) ease-in;
}

.call-buttons-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* Charleston pass pulse — theme.css zeros duration under prefers-reduced-motion */
.game-table__rack-pass--right {
  transition: transform var(--timing-expressive) var(--ease-tactile, ease-out);
  transform: translateX(12px);
}

.game-table__rack-pass--left {
  transition: transform var(--timing-expressive) var(--ease-tactile, ease-out);
  transform: translateX(-12px);
}

.game-table__rack-pass--across {
  transition: transform var(--timing-expressive) var(--ease-tactile, ease-out);
  transform: translateY(-14px);
}

/* Incoming rack motion from opposite of pass direction (Task 6.2 / AC9) */
@keyframes game-table-rack-receive-from-left {
  from {
    transform: translateX(-14px);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes game-table-rack-receive-from-right {
  from {
    transform: translateX(14px);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes game-table-rack-receive-from-below {
  from {
    transform: translateY(14px);
  }
  to {
    transform: translateY(0);
  }
}

.game-table__rack-receive--from-left {
  animation: game-table-rack-receive-from-left var(--timing-expressive)
    var(--ease-tactile, ease-out) forwards;
}

.game-table__rack-receive--from-right {
  animation: game-table-rack-receive-from-right var(--timing-expressive)
    var(--ease-tactile, ease-out) forwards;
}

.game-table__rack-receive--from-below {
  animation: game-table-rack-receive-from-below var(--timing-expressive)
    var(--ease-tactile, ease-out) forwards;
}
</style>
