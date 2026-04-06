<script setup lang="ts">
import { computed, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import { useNow } from "@vueuse/core";
import { storeToRefs } from "pinia";
import TileRack from "./TileRack.vue";
import ActionZone from "./ActionZone.vue";
import OpponentArea from "./OpponentArea.vue";
import PlayerPresence from "./PlayerPresence.vue";
import TurnIndicator from "./TurnIndicator.vue";
import ActivityTicker from "./ActivityTicker.vue";
import WallCounter from "./WallCounter.vue";
import MobileBottomBar from "./MobileBottomBar.vue";
import AVControls from "./AVControls.vue";
import SlideInReferencePanels from "../chat/SlideInReferencePanels.vue";
import ReactionBar from "../reactions/ReactionBar.vue";
import ReactionBubbleStack from "../reactions/ReactionBubbleStack.vue";
import {
  SLIDE_IN_CHAT_PANEL_ROOT_ID,
  SLIDE_IN_NMJL_PANEL_ROOT_ID,
  SLIDE_IN_SETTINGS_PANEL_ROOT_ID,
} from "../chat/slideInPanelIds";
import DiscardPool from "./DiscardPool.vue";
import DiscardConfirm from "./DiscardConfirm.vue";
import CallButtons from "./CallButtons.vue";
import MahjongButton from "./MahjongButton.vue";
import InvalidMahjongNotification from "./InvalidMahjongNotification.vue";
import BaseToast from "../ui/BaseToast.vue";
import AfkVoteModal from "./AfkVoteModal.vue";
import DepartureVoteModal from "./DepartureVoteModal.vue";
import SocialOverridePanel from "./SocialOverridePanel.vue";
import BaseBadge from "../ui/BaseBadge.vue";
import BasePanel from "../ui/BasePanel.vue";
import Scoreboard from "../scoreboard/Scoreboard.vue";
import ShownHand from "./ShownHand.vue";
import DealingAnimation from "./DealingAnimation.vue";
import CharlestonZone from "../charleston/CharlestonZone.vue";
import CharlestonVote from "../charleston/CharlestonVote.vue";
import CourtesyPassUI from "../charleston/CourtesyPassUI.vue";
import type { LocalPlayerSummary, OpponentPlayer } from "./seat-types";
import {
  SEATS,
  loadCard,
  rankHandsForGuidance,
  type ExposedGroup,
  type Tile,
  type CallType,
  type CallWindowState,
  type GamePhase,
  type GameResult,
  type PlayerCharlestonView,
  type ResolvedAction,
  type RoomSettings,
  type SeatWind,
  type SessionGameHistoryEntry,
  type SocialOverrideState,
  type TableTalkReportState,
} from "@mahjong-game/shared";
import { useHandGuidancePreferencesStore } from "../../stores/handGuidancePreferences";
import { useRackStore } from "../../stores/rack";
import { useReactionsStore, type ReactionBubbleRecord } from "../../stores/reactions";
import { useActivityTickerStore } from "../../stores/activityTicker";
import { useSlideInPanelStore } from "../../stores/slideInPanel";
import { useTileSelection } from "../../composables/useTileSelection";
import { useLiveKit, type ParticipantVideoState } from "../../composables/useLiveKit";
import type { ManualReconnectPhase } from "../../composables/useAvReconnectUi";
import { getRequiredRackCountForCallType } from "../../composables/gameActionFromPlayerView";
import {
  toastCopyHandShown,
  toastCopyHostPromoted,
  toastCopyRematchWaiting,
  toastCopyRoomSettingsChanged,
} from "../../composables/resolvedActionToastCopy";
import { tickerCopyForAction } from "../../composables/activityTickerCopy";

const GUIDANCE_CARD = loadCard("2026");

const rackStore = useRackStore();
const slideInPanelStore = useSlideInPanelStore();
const reactionsStore = useReactionsStore();
const activityTickerStore = useActivityTickerStore();
const handGuidancePreferencesStore = useHandGuidancePreferencesStore();
const { items: reactionItems } = storeToRefs(reactionsStore);

const props = withDefaults(
  defineProps<{
    opponents?: {
      top?: OpponentPlayer | null;
      left?: OpponentPlayer | null;
      right?: OpponentPlayer | null;
    };
    tiles?: Tile[];
    /** Local player's exposed melds — hand guidance input (Story 5B.2). */
    myExposedGroups?: ExposedGroup[];
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
    /** When set (in-play from PlayerGameView), resolves reaction bubble anchor via shared seat geometry (6A.3 AC4). */
    reactionAnchorForPlayer?: (playerId: string) => "top" | "left" | "right" | "local" | null;
    /** Room paused (simultaneous disconnect) — server rejects game actions */
    paused?: boolean;
    /** Story 4B.4 — player ids marked dead-seat */
    deadSeatPlayerIds?: readonly string[];
    /** Story 4B.5 — active departure vote (reconnect resume) */
    departureVoteState?: {
      targetPlayerId: string;
      targetPlayerName: string;
      expiresAt: number;
    } | null;
    /** Story 4B.7 — when set, shows collapsible settings panel */
    roomSettings?: RoomSettings | null;
    /** Host may edit between games (lobby handled in RoomView) */
    canEditRoomSettings?: boolean;
    /** Story 5B.4 — per-player scores from PlayerGameView.scores */
    scoresByPlayerId?: Record<string, number>;
    sessionScoresFromPriorGames?: Record<string, number>;
    sessionGameHistory?: readonly SessionGameHistoryEntry[];
    viewerIsHost?: boolean;
    /** Revealed racks in scoreboard phase (Story 5B.5). */
    shownHands?: Record<string, Tile[]>;
    /** Story 6B.5 — A/V resilience (from RoomView / useAvReconnectUi). */
    avShowReconnecting?: boolean;
    avShowReconnectButton?: boolean;
    avManualReconnectPhase?: ManualReconnectPhase;
  }>(),
  {
    opponents: () => ({}),
    tiles: () => [],
    myExposedGroups: () => [],
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
    reactionAnchorForPlayer: undefined,
    paused: false,
    deadSeatPlayerIds: () => [],
    departureVoteState: null,
    roomSettings: null,
    canEditRoomSettings: false,
    scoresByPlayerId: () => ({}),
    sessionScoresFromPriorGames: () => ({}),
    sessionGameHistory: () => [],
    viewerIsHost: false,
    shownHands: () => ({}),
    avShowReconnecting: false,
    avShowReconnectButton: false,
    avManualReconnectPhase: "idle",
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
  sendReaction: [emoji: string];
  afkVote: [targetPlayerId: string, vote: "approve" | "deny"];
  departureVote: [targetPlayerId: string, choice: "dead_seat" | "end_game"];
  leaveGame: [];
  roomSettingsChange: [patch: Partial<RoomSettings>];
  rematch: [];
  endSession: [];
  showHand: [];
  reconnectAv: [];
}>();

const courtesyTileTarget = ref(0);

/** After DealingAnimation completes, hide until next time we leave `play`. */
const dealingAnimFinished = ref(false);

watch(
  () => props.gamePhase,
  (phase, prev) => {
    if (phase === "play" && prev !== undefined && prev !== "play") {
      activityTickerStore.clear();
    }
    if (phase === "play" || phase === "charleston") {
      if (slideInPanelStore.activePanel === "settings") {
        slideInPanelStore.close();
      }
    }
    if (phase !== "play") {
      dealingAnimFinished.value = false;
    } else if (prev !== undefined && prev !== "play") {
      dealingAnimFinished.value = false;
    }
  },
);

function discardPoolTotal(): number {
  const d = props.discardPools;
  return (
    (d.bottom?.length ?? 0) + (d.top?.length ?? 0) + (d.left?.length ?? 0) + (d.right?.length ?? 0)
  );
}

const showDealingAnimation = computed(() => {
  if (props.gamePhase !== "play") return false;
  if (props.roomSettings?.dealingStyle !== "animated") return false;
  if (dealingAnimFinished.value) return false;
  if (discardPoolTotal() > 0) return false;
  return true;
});

function onDealingAnimationDone() {
  dealingAnimFinished.value = true;
}

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

const liveKit = useLiveKit();
const {
  connectionStatus,
  localMicEnabled,
  localCameraEnabled,
  avPermissionState,
  toggleMic,
  toggleCamera,
  requestPermissions,
} = liveKit;

function presenceForPlayer(playerId: string | undefined): ParticipantVideoState {
  if (!playerId) {
    return { videoTrack: null, isCameraEnabled: false };
  }
  return (
    liveKit.participantVideoByIdentity.value.get(playerId) ?? {
      videoTrack: null,
      isCameraEnabled: false,
    }
  );
}

function isSpeakingPlayer(playerId: string | undefined): boolean {
  if (!playerId) {
    return false;
  }
  if (liveKit.connectionStatus.value !== "connected") {
    return false;
  }
  return liveKit.activeSpeakers.value.has(playerId);
}

// Opponent status dots: game WS `player.connected`. Local dot: LiveKit voice only.
const liveKitVoiceConnected = computed(() => liveKit.connectionStatus.value === "connected");

function initialFromName(name: string): string {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : "?";
}

const presenceTop = computed(() => presenceForPlayer(topPlayer.value?.id));
const presenceLeft = computed(() => presenceForPlayer(leftPlayer.value?.id));
const presenceRight = computed(() => presenceForPlayer(rightPlayer.value?.id));
const presenceLocal = computed(() => presenceForPlayer(props.localPlayer?.id));

const isScoreboardPhase = computed(() => props.gamePhase === "scoreboard");

watch(isScoreboardPhase, (v) => {
  if (v) {
    reactionsStore.clear();
  }
});

const reactionUiAllowed = computed(
  () => !slideInPanelStore.isAnySlideInPanelOpen && !isScoreboardPhase.value,
);

/** AC10: scoreboard is results-focused — hide reactions (see UX / story AC10). */
const showReactionChrome = computed(() => reactionUiAllowed.value);

type ReactionAnchor = "top" | "left" | "right" | "local";

/** Fallback when `reactionAnchorForPlayer` is not passed (tests / dev harness). */
const playerIdToReactionAnchorFallback = computed((): Map<string, ReactionAnchor> => {
  const m = new Map<string, ReactionAnchor>();
  if (props.localPlayer?.id) {
    m.set(props.localPlayer.id, "local");
  }
  if (topPlayer.value?.id) m.set(topPlayer.value.id, "top");
  if (leftPlayer.value?.id) m.set(leftPlayer.value.id, "left");
  if (rightPlayer.value?.id) m.set(rightPlayer.value.id, "right");
  return m;
});

const reactionBubblesByAnchor = computed(() => {
  const buckets: Record<ReactionAnchor, ReactionBubbleRecord[]> = {
    top: [],
    left: [],
    right: [],
    local: [],
  };
  const fallback = playerIdToReactionAnchorFallback.value;
  const resolve = props.reactionAnchorForPlayer;
  for (const item of reactionItems.value) {
    const anchor = resolve ? resolve(item.playerId) : (fallback.get(item.playerId) ?? null);
    if (!anchor) continue;
    buckets[anchor].push(item);
  }
  return buckets;
});

function onReactionTap(emoji: string): void {
  emit("sendReaction", emoji);
}

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

const afkVoteOpen = ref<{ targetPlayerId: string; expiresAt: number } | null>(null);
const departureVoteOpen = ref<{
  targetPlayerId: string;
  targetPlayerName: string;
  expiresAt: number;
} | null>(null);
const leaveConfirmOpen = ref(false);
const turnSkippedDeadSeatToastVisible = ref(false);
const turnSkippedDeadSeatToastText = ref("");
const nudgeToastVisible = ref(false);
const nudgeToastText = ref("");
const autoDiscardToastVisible = ref(false);
const autoDiscardToastText = ref("");
const hostPromotedToastVisible = ref(false);
const hostPromotedToastText = ref("");
/** Story 4B.7 — settings change notification (shown in all phases; see HOST_PROMOTED asymmetry above). */
const roomSettingsToastVisible = ref(false);
const roomSettingsToastText = ref("");
const guidanceAutoDisableToastVisible = ref(false);
const rematchWaitingToastVisible = ref(false);
const rematchWaitingToastText = ref("");
const handShownToastVisible = ref(false);
const handShownToastText = ref("");
const guidanceScoreboardRecorded = ref(false);

const afkVoteTargetDisplayName = computed(() => {
  const o = afkVoteOpen.value;
  if (!o) return "";
  return playerNamesById.value[o.targetPlayerId] ?? o.targetPlayerId;
});

watch(
  () => props.gamePhase,
  (p) => {
    if (p !== "scoreboard") {
      guidanceScoreboardRecorded.value = false;
    }
  },
);

watch(
  () => [props.gamePhase, props.gameResult] as const,
  () => {
    if (props.gamePhase !== "scoreboard" || props.gameResult === null) {
      return;
    }
    if (!props.localPlayer || guidanceScoreboardRecorded.value) {
      return;
    }
    guidanceScoreboardRecorded.value = true;
    if (handGuidancePreferencesStore.recordQualifyingGameCompletion()) {
      guidanceAutoDisableToastVisible.value = true;
    }
  },
);

watch(
  () => props.departureVoteState,
  (dv) => {
    if (dv?.targetPlayerId) {
      departureVoteOpen.value = {
        targetPlayerId: dv.targetPlayerId,
        targetPlayerName: dv.targetPlayerName,
        expiresAt: dv.expiresAt,
      };
    }
  },
  { immediate: true },
);

function isDeadSeatPlayer(playerId: string | undefined): boolean {
  if (!playerId) return false;
  return props.deadSeatPlayerIds.includes(playerId);
}

watch(
  () => props.resolvedAction,
  (ra) => {
    if (!ra) return;
    switch (ra.type) {
      case "TURN_TIMER_NUDGE": {
        const name = playerNamesById.value[ra.playerId] ?? ra.playerId;
        const isLocal = ra.playerId === props.localPlayer?.id;
        nudgeToastText.value = isLocal ? "It's your turn!" : `${name} is idle`;
        nudgeToastVisible.value = true;
        break;
      }
      case "TURN_TIMEOUT_AUTO_DISCARD": {
        const name = playerNamesById.value[ra.playerId] ?? ra.playerId;
        autoDiscardToastText.value = `${name} auto-discarded`;
        autoDiscardToastVisible.value = true;
        break;
      }
      case "AFK_VOTE_STARTED":
        afkVoteOpen.value = { targetPlayerId: ra.targetPlayerId, expiresAt: ra.expiresAt };
        break;
      case "AFK_VOTE_RESOLVED":
        afkVoteOpen.value = null;
        break;
      case "DEPARTURE_VOTE_STARTED":
        departureVoteOpen.value = {
          targetPlayerId: ra.targetPlayerId,
          targetPlayerName: ra.targetPlayerName,
          expiresAt: ra.expiresAt,
        };
        break;
      case "DEPARTURE_VOTE_RESOLVED":
        departureVoteOpen.value = null;
        break;
      case "TURN_SKIPPED_DEAD_SEAT": {
        const name = playerNamesById.value[ra.playerId] ?? ra.playerId;
        turnSkippedDeadSeatToastText.value = `${name}'s turn skipped (dead seat)`;
        turnSkippedDeadSeatToastVisible.value = true;
        break;
      }
      case "HOST_PROMOTED": {
        const phase = props.gamePhase;
        if (phase === "lobby" || phase === "scoreboard" || phase === "rematch") {
          hostPromotedToastText.value = toastCopyHostPromoted(ra.newHostName);
          hostPromotedToastVisible.value = true;
        }
        break;
      }
      case "ROOM_SETTINGS_CHANGED": {
        if (ra.changedBy === props.localPlayer?.id) break;
        roomSettingsToastText.value = toastCopyRoomSettingsChanged(ra);
        roomSettingsToastVisible.value = true;
        break;
      }
      case "REMATCH_WAITING_FOR_PLAYERS": {
        rematchWaitingToastText.value = toastCopyRematchWaiting(ra.missingSeats);
        rematchWaitingToastVisible.value = true;
        break;
      }
      case "HAND_SHOWN": {
        const name = playerNamesById.value[ra.playerId] ?? ra.playerId;
        handShownToastText.value = toastCopyHandShown(name);
        handShownToastVisible.value = true;
        break;
      }
      default:
        break;
    }
  },
);

watch(
  () => props.resolvedAction,
  (ra) => {
    if (!ra || props.gamePhase !== "play") return;
    const text = tickerCopyForAction(ra, playerNamesById.value, props.localPlayer?.id ?? "");
    if (text) activityTickerStore.pushEvent(text);
  },
);

const playerOrder = computed(() =>
  SEATS.map((seat) => playersBySeat.value[seat]?.id).filter((playerId): playerId is string =>
    Boolean(playerId),
  ),
);

/** Prior completed games + current game `scores` (Story 5B.4) */
const sessionCumulativeScores = computed<Record<string, number>>(() => {
  const prior = props.sessionScoresFromPriorGames ?? {};
  const cur = props.scoresByPlayerId ?? {};
  const out: Record<string, number> = {};
  for (const id of playerOrder.value) {
    out[id] = (prior[id] ?? 0) + (cur[id] ?? 0);
  }
  return out;
});

const sessionGameHistoryList = computed(() => props.sessionGameHistory ?? []);

const isViewerHost = computed(() => props.viewerIsHost ?? false);

function tilesShownFor(playerId: string | undefined): Tile[] {
  if (!playerId) return [];
  return props.shownHands?.[playerId] ?? [];
}

function hasPlayerRevealedHand(playerId: string | undefined): boolean {
  if (!playerId) return false;
  return Object.prototype.hasOwnProperty.call(props.shownHands ?? {}, playerId);
}

const viewerHasRevealedHand = computed(() => hasPlayerRevealedHand(props.localPlayer?.id));

const nmjlGuidanceActive = computed(() => {
  if (!props.roomSettings?.handGuidanceEnabled) return false;
  if (!handGuidancePreferencesStore.userWantsHandGuidance) return false;
  if (!props.localPlayer) return false;
  if (props.gamePhase === "scoreboard" || props.gamePhase === "rematch") return false;
  const exposed = props.myExposedGroups ?? [];
  const n = props.tiles.length + exposed.reduce((a, g) => a + g.tiles.length, 0);
  if (n === 0) return false;
  // AC1 distance is defined for a 14-tile winning pool; larger transitional pools → reference-only (5B.1).
  if (n > 14) return false;
  return true;
});

const nmjlGuidanceByHandId = computed(() => {
  if (!nmjlGuidanceActive.value) return null;
  const rows = rankHandsForGuidance(props.tiles, props.myExposedGroups ?? [], GUIDANCE_CARD);
  return new Map(rows.map((r) => [r.patternId, r]));
});

const nmjlShowPersonalReenableHint = computed(() =>
  Boolean(
    props.roomSettings?.handGuidanceEnabled && !handGuidancePreferencesStore.userWantsHandGuidance,
  ),
);

const actionZoneEntryRef = useTemplateRef<HTMLDivElement>("actionZoneEntry");
const scoreboardChatFocusReturnRef = useTemplateRef<HTMLDivElement>("scoreboardChatFocusReturn");

function isSeatActive(seatWind: SeatWind | undefined): boolean {
  return seatWind !== undefined && props.currentTurnSeat === seatWind;
}

const isLocalPlayerTurn = computed(() => isSeatActive(props.localPlayer?.seatWind));

function focusActionZone() {
  actionZoneEntryRef.value?.focus();
}

/** AC6: in-play → action zone; scoreboard has no action zone — use dedicated focus sink. */
function onChatEscape() {
  if (isScoreboardPhase.value) {
    scoreboardChatFocusReturnRef.value?.focus();
    return;
  }
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
    class="game-table relative min-h-[100dvh] max-w-screen-2xl mx-auto grid gap-2 p-2 lg:p-4"
    :class="
      isScoreboardPhase || gamePhase === 'rematch'
        ? 'mood-lingering bg-gradient-to-b from-[#3d2e26]/55 via-felt-teal to-felt-teal'
        : 'bg-felt-teal'
    "
  >
    <DealingAnimation v-if="showDealingAnimation" @done="onDealingAnimationDone" />

    <div
      v-if="paused"
      data-testid="game-paused-banner"
      class="pointer-events-none absolute inset-x-2 top-2 z-40 flex justify-center sm:inset-x-4"
      role="status"
      aria-live="polite"
    >
      <div
        class="max-w-full rounded-md bg-chrome-surface/90 px-4 py-2 text-center text-sm text-text-on-felt/85 shadow-sm"
      >
        Waiting for players to reconnect…
      </div>
    </div>
    <div
      class="pointer-events-none fixed inset-x-0 top-14 z-40 flex flex-col items-center gap-2 px-4"
      aria-live="polite"
    >
      <BaseToast
        data-testid="turn-timer-nudge-toast"
        class="pointer-events-auto !border-chrome-border !bg-chrome-surface/95 !text-text-primary"
        :visible="nudgeToastVisible"
        :auto-dismiss-ms="5000"
        @dismiss="nudgeToastVisible = false"
      >
        {{ nudgeToastText }}
      </BaseToast>
      <BaseToast
        data-testid="turn-timeout-auto-discard-toast"
        class="pointer-events-auto !border-chrome-border !bg-chrome-surface/95 !text-text-primary"
        :visible="autoDiscardToastVisible"
        :auto-dismiss-ms="3000"
        @dismiss="autoDiscardToastVisible = false"
      >
        {{ autoDiscardToastText }}
      </BaseToast>
      <BaseToast
        data-testid="turn-skipped-dead-seat-toast"
        class="pointer-events-auto !border-chrome-border !bg-chrome-surface/95 !text-text-primary"
        :visible="turnSkippedDeadSeatToastVisible"
        :auto-dismiss-ms="2000"
        @dismiss="turnSkippedDeadSeatToastVisible = false"
      >
        {{ turnSkippedDeadSeatToastText }}
      </BaseToast>
      <BaseToast
        data-testid="host-promoted-toast"
        class="pointer-events-auto !border-chrome-border !bg-chrome-surface/95 !text-text-primary"
        :visible="hostPromotedToastVisible"
        :auto-dismiss-ms="4000"
        @dismiss="hostPromotedToastVisible = false"
      >
        {{ hostPromotedToastText }}
      </BaseToast>
      <BaseToast
        data-testid="room-settings-changed-toast"
        class="pointer-events-auto !border-chrome-border !bg-chrome-surface/95 !text-text-primary"
        :visible="roomSettingsToastVisible"
        :auto-dismiss-ms="4000"
        @dismiss="roomSettingsToastVisible = false"
      >
        {{ roomSettingsToastText }}
      </BaseToast>
      <BaseToast
        data-testid="rematch-waiting-toast"
        class="pointer-events-auto !border-chrome-border !bg-chrome-surface/95 !text-text-primary"
        :visible="rematchWaitingToastVisible"
        :auto-dismiss-ms="5000"
        @dismiss="rematchWaitingToastVisible = false"
      >
        {{ rematchWaitingToastText }}
      </BaseToast>
      <BaseToast
        data-testid="hand-shown-toast"
        class="pointer-events-auto !border-chrome-border !bg-chrome-surface/95 !text-text-primary"
        :visible="handShownToastVisible"
        :auto-dismiss-ms="4000"
        @dismiss="handShownToastVisible = false"
      >
        {{ handShownToastText }}
      </BaseToast>
      <BaseToast
        data-testid="hand-guidance-auto-disable-toast"
        class="pointer-events-auto !border-chrome-border !bg-chrome-surface/95 !text-text-primary"
        :visible="guidanceAutoDisableToastVisible"
        :auto-dismiss-ms="6000"
        @dismiss="guidanceAutoDisableToastVisible = false"
      >
        Hand hints are off after your first 3 games. You can re-enable hints in settings.
      </BaseToast>
    </div>
    <div
      v-if="!isScoreboardPhase && (gamePhase === 'play' || gamePhase === 'charleston')"
      class="absolute right-2 top-14 z-40 sm:top-2"
    >
      <button
        type="button"
        data-testid="leave-game-button"
        class="rounded-md border border-chrome-border bg-chrome-surface/90 px-3 py-1.5 text-3 text-text-primary shadow-sm"
        @click="leaveConfirmOpen = true"
      >
        Leave game
      </button>
    </div>
    <Teleport to="body">
      <div
        v-if="leaveConfirmOpen"
        data-testid="leave-game-confirm-dialog"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="max-w-md rounded-lg border border-chrome-border bg-chrome-surface p-6 text-text-primary shadow-lg"
        >
          <p class="mb-4 text-3.5 text-text-secondary">
            Leave the game? Your teammates will decide whether to continue without you or end the
            game.
          </p>
          <div class="flex flex-wrap gap-3">
            <button
              type="button"
              class="rounded-md border border-chrome-border bg-chrome-surface px-4 py-2 text-3.5"
              @click="leaveConfirmOpen = false"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded-md bg-state-error px-4 py-2 text-3.5 font-medium text-text-on-felt"
              @click="
                leaveConfirmOpen = false;
                emit('leaveGame');
              "
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <AfkVoteModal
      :open="afkVoteOpen !== null"
      :target-player-id="afkVoteOpen?.targetPlayerId ?? ''"
      :target-player-name="afkVoteTargetDisplayName"
      :is-target-local-player="
        afkVoteOpen !== null && localPlayer?.id === afkVoteOpen.targetPlayerId
      "
      :expires-at="afkVoteOpen?.expiresAt ?? null"
      @vote="(v) => (afkVoteOpen ? emit('afkVote', afkVoteOpen.targetPlayerId, v) : undefined)"
    />
    <DepartureVoteModal
      :open="departureVoteOpen !== null"
      :target-player-name="departureVoteOpen?.targetPlayerName ?? ''"
      :expires-at="departureVoteOpen?.expiresAt ?? null"
      @vote="
        (c) =>
          departureVoteOpen ? emit('departureVote', departureVoteOpen.targetPlayerId, c) : undefined
      "
    />
    <!-- Desktop / tablet: floating reaction bar (AC7) — clear of right-column toggles via offset -->
    <div
      v-if="showReactionChrome"
      class="pointer-events-none fixed right-2 top-1/3 z-30 hidden md:block md:right-[max(0.5rem,calc(100vw-80rem)/2+0.5rem)]"
      aria-hidden="false"
    >
      <div class="pointer-events-auto">
        <ReactionBar layout="vertical" :on-react="onReactionTap" />
      </div>
    </div>

    <!-- Opponent Top -->
    <div data-testid="opponent-top" class="game-table__opponent-top relative flex justify-center">
      <div
        v-if="showReactionChrome && reactionBubblesByAnchor.top.length > 0"
        class="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1 -translate-x-1/2"
        aria-live="polite"
      >
        <ReactionBubbleStack :items="reactionBubblesByAnchor.top" />
      </div>
      <OpponentArea
        position="top"
        :player="topPlayer"
        :is-active-turn="isSeatActive(topPlayer?.seatWind)"
        :score="topPlayer?.score ?? null"
        :is-dead-seat="isDeadSeatPlayer(topPlayer?.id)"
        :video-track="presenceTop.videoTrack"
        :is-camera-enabled="presenceTop.isCameraEnabled"
        :is-speaking="isSpeakingPlayer(topPlayer?.id)"
      />
      <ShownHand
        v-if="isScoreboardPhase && topPlayer && hasPlayerRevealedHand(topPlayer.id)"
        :tiles="tilesShownFor(topPlayer.id)"
        :player-name="topPlayer.name"
        position="top"
      />
    </div>

    <!-- Left / Center / Right row -->
    <div class="game-table__middle grid md:grid-cols-[auto_1fr_auto] gap-2">
      <!-- Opponent Left (hidden on phone, shown via grid on tablet/desktop) -->
      <div
        data-testid="opponent-left"
        class="game-table__opponent-left relative hidden md:flex flex-col items-center justify-center gap-2"
      >
        <div
          v-if="showReactionChrome && reactionBubblesByAnchor.left.length > 0"
          class="pointer-events-none absolute right-full top-1/2 z-20 mr-1 -translate-y-1/2"
          aria-live="polite"
        >
          <ReactionBubbleStack :items="reactionBubblesByAnchor.left" />
        </div>
        <OpponentArea
          position="left"
          :player="leftPlayer"
          :is-active-turn="isSeatActive(leftPlayer?.seatWind)"
          :score="leftPlayer?.score ?? null"
          :is-dead-seat="isDeadSeatPlayer(leftPlayer?.id)"
          :video-track="presenceLeft.videoTrack"
          :is-camera-enabled="presenceLeft.isCameraEnabled"
          :is-speaking="isSpeakingPlayer(leftPlayer?.id)"
        />
        <ShownHand
          v-if="isScoreboardPhase && leftPlayer && hasPlayerRevealedHand(leftPlayer.id)"
          :tiles="tilesShownFor(leftPlayer.id)"
          :player-name="leftPlayer.name"
          position="left"
        />
      </div>

      <!-- Table Center -->
      <div
        data-testid="table-center"
        class="game-table__center min-h-[40dvh] flex flex-col items-center justify-center gap-4"
      >
        <template v-if="isScoreboardPhase">
          <Scoreboard
            :game-result="gameResult"
            :player-names-by-id="playerNamesById"
            :player-order="playerOrder"
            :session-scores="sessionCumulativeScores"
            :session-game-history="sessionGameHistoryList"
            :viewer-is-host="isViewerHost"
            :has-shown-hand="viewerHasRevealedHand"
            @play-again="emit('rematch')"
            @end-session="emit('endSession')"
            @show-hand="emit('showHand')"
          />
          <ShownHand
            v-if="localPlayer && hasPlayerRevealedHand(localPlayer.id)"
            class="w-full max-w-3xl"
            :tiles="tilesShownFor(localPlayer.id)"
            :player-name="localPlayer.name"
            position="local"
          />
          <div
            class="flex w-full max-w-3xl flex-col gap-3 md:hidden"
            data-testid="scoreboard-shown-hands-mobile-sides"
          >
            <ShownHand
              v-if="leftPlayer && hasPlayerRevealedHand(leftPlayer.id)"
              :tiles="tilesShownFor(leftPlayer.id)"
              :player-name="leftPlayer.name"
              position="left"
            />
            <ShownHand
              v-if="rightPlayer && hasPlayerRevealedHand(rightPlayer.id)"
              :tiles="tilesShownFor(rightPlayer.id)"
              :player-name="rightPlayer.name"
              position="right"
            />
          </div>
          <div
            ref="scoreboardChatFocusReturn"
            data-testid="scoreboard-chat-focus-return"
            tabindex="-1"
            class="sr-only"
            aria-hidden="true"
          />
        </template>

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
            <div v-if="gamePhase === 'play'" class="flex w-full flex-col items-center gap-1">
              <TurnIndicator
                v-if="currentTurnSeat"
                :active-seat="currentTurnSeat"
                :player-names-by-seat="playerNamesBySeat"
              />
              <ActivityTicker />
            </div>

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
            <div class="flex md:hidden w-full justify-center gap-4">
              <div class="relative flex flex-col items-center">
                <div
                  v-if="showReactionChrome && reactionBubblesByAnchor.left.length > 0"
                  class="pointer-events-none absolute bottom-full z-20 mb-1"
                  aria-live="polite"
                >
                  <ReactionBubbleStack :items="reactionBubblesByAnchor.left" />
                </div>
                <OpponentArea
                  position="left"
                  :player="leftPlayer"
                  :is-active-turn="isSeatActive(leftPlayer?.seatWind)"
                  :score="leftPlayer?.score ?? null"
                  :is-dead-seat="isDeadSeatPlayer(leftPlayer?.id)"
                  :video-track="presenceLeft.videoTrack"
                  :is-camera-enabled="presenceLeft.isCameraEnabled"
                  :is-speaking="isSpeakingPlayer(leftPlayer?.id)"
                />
              </div>
              <div class="relative flex flex-col items-center">
                <div
                  v-if="showReactionChrome && reactionBubblesByAnchor.right.length > 0"
                  class="pointer-events-none absolute bottom-full z-20 mb-1"
                  aria-live="polite"
                >
                  <ReactionBubbleStack :items="reactionBubblesByAnchor.right" />
                </div>
                <OpponentArea
                  position="right"
                  :player="rightPlayer"
                  :is-active-turn="isSeatActive(rightPlayer?.seatWind)"
                  :score="rightPlayer?.score ?? null"
                  :is-dead-seat="isDeadSeatPlayer(rightPlayer?.id)"
                  :video-track="presenceRight.videoTrack"
                  :is-camera-enabled="presenceRight.isCameraEnabled"
                  :is-speaking="isSpeakingPlayer(rightPlayer?.id)"
                />
              </div>
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
        class="game-table__opponent-right relative hidden md:flex flex-col items-center justify-center gap-2"
      >
        <div
          v-if="showReactionChrome && reactionBubblesByAnchor.right.length > 0"
          class="pointer-events-none absolute left-full top-1/2 z-20 ml-1 -translate-y-1/2"
          aria-live="polite"
        >
          <ReactionBubbleStack :items="reactionBubblesByAnchor.right" />
        </div>
        <div class="flex flex-col gap-2">
          <button
            type="button"
            data-testid="nmjl-toggle-desktop"
            class="rounded-md border border-transparent bg-transparent px-3 py-2 text-3 text-text-secondary/90 hover:bg-chrome-surface/40 focus-visible:focus-ring-on-felt"
            :aria-expanded="slideInPanelStore.activePanel === 'nmjl'"
            :aria-controls="SLIDE_IN_NMJL_PANEL_ROOT_ID"
            @click="slideInPanelStore.toggleNmjl()"
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
          <button
            v-if="roomSettings"
            type="button"
            data-testid="settings-toggle-desktop"
            class="rounded-md border border-transparent bg-transparent px-3 py-2 text-3 text-text-secondary/90 hover:bg-chrome-surface/40 focus-visible:focus-ring-on-felt"
            :aria-expanded="slideInPanelStore.activePanel === 'settings'"
            :aria-controls="SLIDE_IN_SETTINGS_PANEL_ROOT_ID"
            aria-label="Room settings"
            @click="slideInPanelStore.toggleSettings()"
          >
            <span aria-hidden="true" class="mr-1">⚙</span>
            Settings
          </button>
        </div>
        <OpponentArea
          position="right"
          :player="rightPlayer"
          :is-active-turn="isSeatActive(rightPlayer?.seatWind)"
          :score="rightPlayer?.score ?? null"
          :is-dead-seat="isDeadSeatPlayer(rightPlayer?.id)"
          :video-track="presenceRight.videoTrack"
          :is-camera-enabled="presenceRight.isCameraEnabled"
          :is-speaking="isSpeakingPlayer(rightPlayer?.id)"
        />
        <ShownHand
          v-if="isScoreboardPhase && rightPlayer && hasPlayerRevealedHand(rightPlayer.id)"
          :tiles="tilesShownFor(rightPlayer.id)"
          :player-name="rightPlayer.name"
          position="right"
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
      <!-- Mobile: horizontal reaction row above rack (AC8) -->
      <div
        v-if="showReactionChrome"
        class="mb-2 flex justify-center px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <ReactionBar layout="horizontal" :on-react="onReactionTap" />
      </div>
      <div
        v-if="showReactionChrome && reactionBubblesByAnchor.local.length > 0"
        class="pointer-events-none mb-1 flex justify-center"
        aria-live="polite"
      >
        <ReactionBubbleStack :items="reactionBubblesByAnchor.local" />
      </div>
      <div data-testid="rack-zone-entry">
        <div
          v-if="localPlayer"
          class="mb-2 flex flex-col flex-wrap items-center justify-center gap-2 sm:flex-row"
        >
          <div class="relative">
            <PlayerPresence
              position="local"
              :player-id="localPlayer.id"
              :display-name="localPlayer.name"
              :initial="initialFromName(localPlayer.name)"
              :is-active-turn="isLocalPlayerTurn"
              :video-track="presenceLocal.videoTrack"
              :is-camera-enabled="presenceLocal.isCameraEnabled"
              :is-speaking="isSpeakingPlayer(localPlayer.id)"
            />
            <BaseBadge
              class="absolute -bottom-0.5 -right-0.5 z-[60]"
              variant="status-dot"
              :tone="liveKitVoiceConnected ? 'success' : 'muted'"
              :aria-label="liveKitVoiceConnected ? 'Voice connected' : 'Voice disconnected'"
              data-testid="local-voice-status-dot"
            />
          </div>
          <BasePanel
            data-testid="local-player-status-shell"
            tag="div"
            variant="dark-raised"
            class="inline-flex flex-wrap items-center justify-center gap-2 rounded-full px-4 py-2"
            :class="{ 'ring-2 ring-state-turn-active': isLocalPlayerTurn }"
          >
            <span class="text-interactive">{{ localPlayer.name }}</span>
            <span
              v-if="isDeadSeatPlayer(localPlayer.id)"
              :data-testid="`dead-seat-badge-${localPlayer.id}`"
              class="text-2.5 text-text-on-felt/60"
            >
              Dead Seat
            </span>
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
      :send-chat="(t: string) => emit('sendChat', t)"
      :nmjl-charleston-mobile-split="gamePhase === 'charleston'"
      :nmjl-guidance-active="nmjlGuidanceActive"
      :nmjl-guidance-by-hand-id="nmjlGuidanceByHandId"
      :nmjl-show-personal-reenable-hint="nmjlShowPersonalReenableHint"
      :room-settings="roomSettings"
      :can-edit-room-settings="canEditRoomSettings"
      :settings-phase="gamePhase"
      :on-escape-focus-target="onChatEscape"
      @reenable-personal-guidance="handGuidancePreferencesStore.setGuidanceExplicitOverride(true)"
      @room-settings-change="(p) => emit('roomSettingsChange', p)"
    />

    <!-- DOM anchor between actions and mobile controls (a11y / test document order); panel content mounts when open. -->
    <div data-testid="chat-shell-anchor" class="order-5 sr-only" aria-hidden="true" />

    <div data-testid="controls-zone-shell" class="order-6 flex justify-center">
      <div
        class="hidden w-full max-w-sm flex-col items-center justify-center md:flex"
        data-testid="desktop-av-controls"
      >
        <AVControls
          :is-mic-enabled="localMicEnabled"
          :is-camera-enabled="localCameraEnabled"
          :connection-status="connectionStatus"
          :permission-state="avPermissionState"
          :show-reconnecting-message="props.avShowReconnecting"
          :show-reconnect-button="props.avShowReconnectButton"
          :manual-reconnect-phase="props.avManualReconnectPhase"
          surface="felt"
          @toggle-mic="toggleMic"
          @toggle-camera="toggleCamera"
          @request-av="requestPermissions"
          @reconnect-av="emit('reconnectAv')"
        />
      </div>
      <div data-testid="controls-zone-entry" class="w-full max-w-sm md:hidden">
        <MobileBottomBar
          :av-show-reconnecting="props.avShowReconnecting"
          :av-show-reconnect-button="props.avShowReconnectButton"
          :av-manual-reconnect-phase="props.avManualReconnectPhase"
          @reconnect-av="emit('reconnectAv')"
        />
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
