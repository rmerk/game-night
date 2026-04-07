<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, useTemplateRef, watch } from "vue";
import { animate } from "motion-v";
import { useRoute, useRouter } from "vue-router";
import type { CallType, SessionGameHistoryEntry } from "@mahjong-game/shared";
import GameTable from "../components/game/GameTable.vue";
import RoomSettingsPanel from "../components/game/RoomSettingsPanel.vue";
import BaseToast from "../components/ui/BaseToast.vue";
import BasePanel from "../components/ui/BasePanel.vue";
import SlideInReferencePanels from "../components/chat/SlideInReferencePanels.vue";
import ReactionBar from "../components/reactions/ReactionBar.vue";
import ReactionBubbleStack from "../components/reactions/ReactionBubbleStack.vue";
import {
  SLIDE_IN_CHAT_PANEL_ROOT_ID,
  SLIDE_IN_NMJL_PANEL_ROOT_ID,
} from "../components/chat/slideInPanelIds";
import { useSlideInPanelStore } from "../stores/slideInPanel";
import {
  mapPlayerGameViewToGameTableProps,
  reactionBubbleAnchorForLobby,
  reactionBubbleAnchorForPlayer as reactionBubbleAnchorForPlayerFromView,
} from "../composables/mapPlayerGameViewToGameTable";
import { buildGameActionFromTableEvent } from "../composables/gameActionFromPlayerView";
import { useRoomConnection } from "../composables/useRoomConnection";
import { useAvReconnectUi } from "../composables/useAvReconnectUi";
import { getApiBaseUrl } from "../composables/apiBaseUrl";
import { canEditRoomSettings } from "../composables/roomSettingsFormatters";
import {
  toastCopyHostPromoted,
  toastCopyRematchWaiting,
  toastCopyRoomSettingsChanged,
} from "../composables/resolvedActionToastCopy";
import { useRackStore } from "../stores/rack";
import { useReactionsStore, type ReactionBubbleRecord } from "../stores/reactions";
import { usePreferencesStore } from "../stores/preferences";
import { useAudioStore } from "../stores/audio";
import { storeToRefs } from "pinia";

const route = useRoute();
const router = useRouter();

const roomCode = computed(() =>
  String(route.params.code ?? "")
    .trim()
    .toUpperCase(),
);

const displayNameInput = ref("");
const hasRequestedConnect = ref(false);

onMounted(() => {
  const q = route.query.name;
  if (typeof q === "string" && q.trim().length > 0) {
    displayNameInput.value = q.trim().slice(0, 30);
  }
});

const conn = useRoomConnection();
const {
  status,
  lastErrorMessage,
  lobbyState,
  playerGameView,
  resolvedAction,
  systemNotice,
  clearLastError,
  roomFullError,
  clearRoomFullError,
  retryLiveKitConnection,
} = conn;

const avReconnectUi = useAvReconnectUi({
  roomWsStatus: status,
  retryLiveKitConnection,
});

const isCheckingRoomStatus = ref(false);
const isTableFullFromFetch = ref(false);
const statusFetchError = ref<string | null>(null);

const isTableFull = computed(() => isTableFullFromFetch.value || roomFullError.value);

const showSessionErrorBanner = computed(
  () =>
    lastErrorMessage.value !== null &&
    hasRequestedConnect.value &&
    (lobbyState.value !== null || playerGameView.value !== null),
);
const rackStore = useRackStore();
const slideInPanelStore = useSlideInPanelStore();
const reactionsStore = useReactionsStore();
const { items: lobbyReactionItems } = storeToRefs(reactionsStore);
const prefsStore = usePreferencesStore();
const audioStore = useAudioStore();

const lobbyFocusReturnRef = useTemplateRef<HTMLDivElement>("lobbyFocusReturn");

function focusLobbyAfterChatEscape() {
  lobbyFocusReturnRef.value?.focus();
}

const tableProps = computed(() => {
  const v = playerGameView.value;
  if (!v) {
    return null;
  }
  return mapPlayerGameViewToGameTableProps(v, { resolvedAction: resolvedAction.value });
});

const reactionAnchorForPlayer = computed(() => {
  const v = playerGameView.value;
  if (!v) {
    return undefined;
  }
  return (playerId: string) => reactionBubbleAnchorForPlayerFromView(v, playerId);
});

const isLobby = computed(() => lobbyState.value !== null && playerGameView.value === null);

const moodClass = computed(() => {
  if (lobbyState.value !== null && playerGameView.value === null) return "mood-arriving";
  const phase = playerGameView.value?.gamePhase;
  if (!phase) return "";
  if (phase === "scoreboard" || phase === "rematch") return "mood-lingering";
  return "mood-playing"; // dealing, charleston, play
});

/** Template ref for the root element — used by Motion for Vue crossfade (AC 5, 7). */
const roomViewRoot = useTemplateRef<HTMLElement>("roomViewRoot");

/**
 * `displayedMoodClass` — the mood class actually applied to the DOM.
 * Lags behind `moodClass` during the crossfade so the old mood fades out
 * before the new mood's styles are painted.
 */
const displayedMoodClass = ref(moodClass.value);

/** Cubic-bezier matching `--ease-expressive` design token. */
const TIMING_EXPRESSIVE_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Returns true when the user has requested reduced motion at the OS level. */
function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** Tracks the in-flight crossfade so rapid mood changes cancel the previous animation. */
let currentCrossfadeAnimation: { stop(): void } | null = null;

/** Guard set to false on unmount — prevents DOM writes after the component is gone. */
let isMounted = true;

onUnmounted(() => {
  isMounted = false;
  currentCrossfadeAnimation?.stop();
});

watch(moodClass, async (newMood) => {
  const el = roomViewRoot.value;
  if (!el || newMood === displayedMoodClass.value) return;

  const reducedMotion = prefersReducedMotion();

  if (!reducedMotion) {
    // Cancel any in-flight animation before starting a new one
    currentCrossfadeAnimation?.stop();

    const fadeOut = animate(el, { opacity: 0 }, { duration: 0.4, ease: TIMING_EXPRESSIVE_EASE });
    currentCrossfadeAnimation = fadeOut;
    await fadeOut.finished;

    // Bail if unmounted or superseded by a newer transition
    if (!isMounted || currentCrossfadeAnimation !== fadeOut) return;
  }

  displayedMoodClass.value = newMood;
  await nextTick();

  if (!reducedMotion && isMounted) {
    const fadeIn = animate(el, { opacity: 1 }, { duration: 1.0, ease: TIMING_EXPRESSIVE_EASE });
    currentCrossfadeAnimation = fadeIn;
    await fadeIn.finished;
  }
});

const localPlayerId = computed(
  () => lobbyState.value?.myPlayerId ?? playerGameView.value?.myPlayerId ?? null,
);

const isHost = computed(() => {
  const lobby = lobbyState.value;
  if (!lobby) return false;
  return lobby.players.some((p) => p.playerId === lobby.myPlayerId && p.isHost);
});

const isHostInGame = computed(() => {
  const v = playerGameView.value;
  if (!v) return false;
  return v.players.some((p) => p.playerId === v.myPlayerId && p.isHost);
});

const canEditLobbySettings = computed(() => {
  const lob = lobbyState.value;
  if (!lob) return false;
  const host = lob.players.some((p) => p.playerId === lob.myPlayerId && p.isHost);
  return canEditRoomSettings(host, "lobby");
});

const canEditGameSettings = computed(() => {
  const v = playerGameView.value;
  if (!v) return false;
  return canEditRoomSettings(isHostInGame.value, v.gamePhase);
});

const hostPromotedLobbyVisible = ref(false);
const hostPromotedLobbyText = ref("");
const roomSettingsLobbyToastVisible = ref(false);
const roomSettingsLobbyToastText = ref("");
const rematchWaitingLobbyVisible = ref(false);
const rematchWaitingLobbyText = ref("");

/** Audio preview toast (AC 7) */
const audioPreviewToastVisible = ref(false);

/** First-join audio preview (AC 7, 8) — fires once when the player first lands in a live room (lobby or in-progress game). */
watch(
  () => lobbyState.value ?? playerGameView.value,
  async (roomState) => {
    if (!roomState) return;
    if (prefsStore.hasSeenAudioPreview) return;
    // Mark immediately before playing to prevent re-trigger on remount
    prefsStore.markAudioPreviewSeen();
    if (!audioStore.masterMuted) {
      audioPreviewToastVisible.value = true;
      setTimeout(() => {
        audioPreviewToastVisible.value = false;
      }, 4000);
      void audioStore.play("tile-draw", "gameplay");
      await new Promise((r) => setTimeout(r, 800));
      void audioStore.play("tile-discard", "gameplay");
      await new Promise((r) => setTimeout(r, 800));
      void audioStore.play("mahjong-motif", "gameplay");
    }
  },
  { once: true },
);

/** Story 5B.4 — final session summary after host ends session */
const sessionEndedSnapshot = ref<{
  sessionTotals: Record<string, number>;
  sessionGameHistory: readonly SessionGameHistoryEntry[];
} | null>(null);

watch(
  () => resolvedAction.value,
  (ra) => {
    if (ra?.type === "SESSION_ENDED") {
      sessionEndedSnapshot.value = {
        sessionTotals: ra.sessionTotals,
        sessionGameHistory: ra.sessionGameHistory,
      };
    }
  },
);

/** Lobby-only toasts from `resolvedAction` — same copy helpers as GameTable (`resolvedActionToastCopy`). */
watch(
  () => resolvedAction.value,
  (ra) => {
    if (!ra) return;
    const lob = lobbyState.value;
    if (lob === null || playerGameView.value !== null) return;

    switch (ra.type) {
      case "HOST_PROMOTED":
        hostPromotedLobbyText.value = toastCopyHostPromoted(ra.newHostName);
        hostPromotedLobbyVisible.value = true;
        break;
      case "ROOM_SETTINGS_CHANGED":
        if (ra.changedBy === lob.myPlayerId) return;
        roomSettingsLobbyToastText.value = toastCopyRoomSettingsChanged(ra);
        roomSettingsLobbyToastVisible.value = true;
        break;
      case "REMATCH_WAITING_FOR_PLAYERS":
        rematchWaitingLobbyText.value = toastCopyRematchWaiting(ra.missingSeats);
        rematchWaitingLobbyVisible.value = true;
        break;
      default:
        break;
    }
  },
);

watch(
  () => playerGameView.value,
  (v) => {
    if (v) {
      rackStore.reconcileWithServerRack(v.myRack);
    }
  },
  { immediate: true },
);

/** Lobby reaction bubbles must not carry into the table (fresh in-play bubbles only; AC11 / UX). */
watch(
  () => ({
    pgv: playerGameView.value,
    lob: lobbyState.value,
  }),
  (cur, prev) => {
    if (prev === undefined) {
      return;
    }
    if (cur.pgv && prev.lob !== null && prev.pgv === null) {
      reactionsStore.clear();
    }
  },
);

const lobbyReactionAnchor = computed(() => {
  const lob = lobbyState.value;
  if (!lob) {
    return undefined;
  }
  return (playerId: string) => reactionBubbleAnchorForLobby(lob, playerId);
});

type LobbyReactionAnchor = "top" | "left" | "right" | "local";

const lobbyReactionBubblesByAnchor = computed(() => {
  const buckets: Record<LobbyReactionAnchor, ReactionBubbleRecord[]> = {
    top: [],
    left: [],
    right: [],
    local: [],
  };
  const resolve = lobbyReactionAnchor.value;
  if (!resolve) {
    return buckets;
  }
  for (const item of lobbyReactionItems.value) {
    const anchor = resolve(item.playerId);
    if (!anchor) continue;
    buckets[anchor].push(item);
  }
  return buckets;
});

async function joinRoom() {
  const name = displayNameInput.value.trim();
  if (!name || !roomCode.value) {
    return;
  }
  statusFetchError.value = null;
  isTableFullFromFetch.value = false;
  clearRoomFullError();
  isCheckingRoomStatus.value = true;
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/rooms/${roomCode.value}/status`);
    if (res.status === 404) {
      statusFetchError.value = "room_not_found";
      isCheckingRoomStatus.value = false;
      return;
    }
    if (!res.ok) {
      statusFetchError.value = "server_error";
      isCheckingRoomStatus.value = false;
      return;
    }
    const data = (await res.json()) as { full: boolean };
    if (data.full) {
      isTableFullFromFetch.value = true;
      hasRequestedConnect.value = true;
      isCheckingRoomStatus.value = false;
      return;
    }
  } catch {
    statusFetchError.value = "network";
    isCheckingRoomStatus.value = false;
    return;
  }
  isCheckingRoomStatus.value = false;
  hasRequestedConnect.value = true;
  conn.connect(roomCode.value, name);
}

function retryStatusCheck() {
  statusFetchError.value = null;
  void joinRoom();
}

function leaveRoom() {
  conn.clearTokenForRoom(roomCode.value);
  conn.disconnect();
  isTableFullFromFetch.value = false;
  statusFetchError.value = null;
  rackStore.resetForRoomLeave();
  void router.push({ name: "home" });
}

function sendFromView(build: Parameters<typeof buildGameActionFromTableEvent>[1]): void {
  const v = playerGameView.value;
  if (!v) {
    return;
  }
  const action = buildGameActionFromTableEvent(v, build);
  if (action) {
    conn.sendGameAction(action);
  }
}

function onDiscard(tileId: string) {
  sendFromView({ type: "discard", tileId });
}

function onPass() {
  sendFromView({ type: "pass" });
}

function onCall(callType: CallType) {
  sendFromView({ type: "call", callType });
}

function onDeclareMahjong() {
  sendFromView({ type: "declareMahjong" });
}

function onCancelMahjong() {
  sendFromView({ type: "cancelMahjong" });
}

function onCharlestonPass(tileIds: string[]) {
  sendFromView({ type: "charlestonPass", tileIds });
}

function onCharlestonVote(accept: boolean) {
  sendFromView({ type: "charlestonVote", accept });
}

function onCourtesyPass(payload: { count: number; tileIds: string[] }) {
  sendFromView({ type: "courtesyPass", ...payload });
}

function onSocialOverrideRequest(description: string) {
  sendFromView({ type: "socialOverrideRequest", description });
}

function onSocialOverrideVote(approve: boolean) {
  sendFromView({ type: "socialOverrideVote", approve });
}

function onTableTalkReport(reportedPlayerId: string, description: string) {
  sendFromView({ type: "tableTalkReport", reportedPlayerId, description });
}

function onTableTalkVote(approve: boolean) {
  sendFromView({ type: "tableTalkVote", approve });
}

function onConfirmCall(payload: { tileIds: string[] }) {
  sendFromView({ type: "confirmCall", tileIds: payload.tileIds });
}

function onRetractCall() {
  sendFromView({ type: "retractCall" });
}

function goSpectatePlaceholder() {
  void router.push({ name: "room-spectate", params: { code: roomCode.value } });
}
</script>

<template>
  <div
    ref="roomViewRoot"
    data-testid="room-view-root"
    class="min-h-[100dvh] bg-felt-teal text-text-on-felt"
    :class="displayedMoodClass"
  >
    <div
      v-if="systemNotice === 'session_superseded'"
      class="border-b border-state-warning bg-chrome-surface px-4 py-2 text-center text-3.5 text-text-primary"
      role="status"
    >
      This seat was opened in another tab. Reload or return home.
    </div>
    <div
      v-else-if="systemNotice === 'room_closing'"
      class="border-b border-state-warning bg-chrome-surface px-4 py-2 text-center text-3.5 text-text-primary"
      role="status"
    >
      The room is closing.
    </div>

    <header
      class="flex flex-wrap items-center justify-between gap-2 border-b border-chrome-border bg-chrome-surface/90 px-4 py-3"
    >
      <div class="text-3.5 font-medium">
        Room <span class="font-mono tracking-wide">{{ roomCode || "—" }}</span>
      </div>
      <button
        type="button"
        class="rounded-md border border-chrome-border px-3 py-1.5 text-3 hover:bg-chrome-surface-dark"
        @click="leaveRoom"
      >
        Leave
      </button>
    </header>

    <div
      v-if="lobbyState !== null || playerGameView !== null"
      class="pointer-events-none fixed inset-x-0 top-20 z-[100] flex justify-center px-4"
    >
      <BaseToast
        data-testid="audio-preview-toast"
        class="pointer-events-auto !border-chrome-border !bg-chrome-surface/95 !text-text-primary"
        :visible="audioPreviewToastVisible"
        :auto-dismiss-ms="4000"
        @dismiss="audioPreviewToastVisible = false"
      >
        Sound is on. Adjust in settings.
      </BaseToast>
    </div>

    <div
      v-if="showSessionErrorBanner"
      class="flex flex-wrap items-center justify-between gap-2 border-b border-state-error/40 bg-chrome-surface px-4 py-2 text-3.5 text-state-error"
      role="alert"
    >
      <span>{{ lastErrorMessage }}</span>
      <button
        type="button"
        class="shrink-0 rounded-md border border-chrome-border px-2 py-1 text-3 text-text-primary hover:bg-chrome-surface-dark"
        @click="clearLastError"
      >
        Dismiss
      </button>
    </div>

    <div
      v-else-if="isTableFull"
      data-testid="table-full-view"
      class="mx-auto max-w-lg px-4 py-16 text-center text-text-on-felt"
    >
      <h1 class="mb-2 text-5 font-semibold">This table is full</h1>
      <p class="mb-6 text-3.5 text-text-secondary">
        Four players are already seated at this table.
      </p>
      <div class="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button
          type="button"
          data-testid="table-full-back-home"
          class="rounded-md bg-chrome-surface px-4 py-2 text-3.5 font-medium text-text-primary"
          @click="router.push({ name: 'home' })"
        >
          Back to home
        </button>
        <button
          type="button"
          data-testid="table-full-spectate"
          class="rounded-md border border-chrome-border bg-transparent px-4 py-2 text-3.5 text-text-on-felt"
          @click="goSpectatePlaceholder"
        >
          Watch as spectator
        </button>
      </div>
    </div>

    <div v-else-if="statusFetchError" class="mx-auto max-w-md px-4 py-10 text-center">
      <p
        v-if="statusFetchError === 'room_not_found'"
        class="text-3.5 text-state-error"
        role="alert"
      >
        Room not found.
      </p>
      <p v-else-if="statusFetchError === 'network'" class="text-3.5 text-state-error" role="alert">
        Could not reach the server
      </p>
      <p v-else class="text-3.5 text-state-error" role="alert">Unable to check room status.</p>
      <button
        type="button"
        class="mt-4 rounded-md border border-chrome-border bg-chrome-surface px-4 py-2 text-3.5 text-text-primary"
        @click="retryStatusCheck"
      >
        Retry
      </button>
    </div>

    <div v-else-if="!hasRequestedConnect" class="mx-auto max-w-md px-4 py-10">
      <h1 class="mb-4 text-5 font-semibold">Join room</h1>
      <label class="mb-2 block text-3.5 text-text-secondary">Display name</label>
      <input
        v-model="displayNameInput"
        type="text"
        maxlength="30"
        class="mb-4 w-full rounded-md border border-chrome-border bg-chrome-surface px-3 py-2 text-text-primary"
        autocomplete="nickname"
        @keydown.enter="joinRoom"
      />
      <button
        type="button"
        class="rounded-md bg-state-turn-active px-4 py-2 text-3.5 font-medium text-text-on-felt disabled:opacity-50"
        :disabled="!displayNameInput.trim() || !roomCode"
        @click="joinRoom"
      >
        Connect
      </button>
      <p v-if="lastErrorMessage" class="mt-4 text-state-error text-3.5">
        {{ lastErrorMessage }}
      </p>
    </div>

    <div v-else-if="isCheckingRoomStatus" class="px-4 py-10 text-center text-3.5 text-text-on-felt">
      Checking room…
    </div>

    <div v-else-if="status === 'connecting'" class="px-4 py-10 text-center text-3.5">
      Connecting…
    </div>

    <div
      v-else-if="status === 'open' && !lobbyState && !playerGameView && !lastErrorMessage"
      class="px-4 py-10 text-center text-3.5"
    >
      Syncing state…
    </div>

    <div v-else-if="lastErrorMessage && !lobbyState && !playerGameView" class="px-4 py-10">
      <p class="text-state-error text-3.5">{{ lastErrorMessage }}</p>
      <button type="button" class="mt-4 text-3 underline" @click="hasRequestedConnect = false">
        Try again
      </button>
    </div>

    <div
      v-else-if="isLobby && lobbyState"
      class="relative mx-auto max-w-lg px-4 py-8"
      data-testid="lobby-root"
    >
      <BaseToast
        data-testid="host-promoted-toast"
        class="pointer-events-auto !border-chrome-border !bg-chrome-surface/95 !text-text-primary"
        :visible="hostPromotedLobbyVisible"
        :auto-dismiss-ms="4000"
        @dismiss="hostPromotedLobbyVisible = false"
      >
        {{ hostPromotedLobbyText }}
      </BaseToast>
      <BaseToast
        data-testid="room-settings-changed-toast"
        class="pointer-events-auto !border-chrome-border !bg-chrome-surface/95 !text-text-primary"
        :visible="roomSettingsLobbyToastVisible"
        :auto-dismiss-ms="4000"
        @dismiss="roomSettingsLobbyToastVisible = false"
      >
        {{ roomSettingsLobbyToastText }}
      </BaseToast>
      <BaseToast
        data-testid="rematch-waiting-lobby-toast"
        class="pointer-events-auto !border-chrome-border !bg-chrome-surface/95 !text-text-primary"
        :visible="rematchWaitingLobbyVisible"
        :auto-dismiss-ms="5000"
        @dismiss="rematchWaitingLobbyVisible = false"
      >
        {{ rematchWaitingLobbyText }}
      </BaseToast>
      <div ref="lobbyFocusReturn" tabindex="-1" class="sr-only" aria-hidden="true" />
      <div class="mb-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-transparent bg-transparent px-3 py-2 text-3 text-text-secondary/90 hover:bg-chrome-surface/40 focus-visible:focus-ring-on-chrome"
          :aria-expanded="slideInPanelStore.activePanel === 'nmjl'"
          :aria-controls="SLIDE_IN_NMJL_PANEL_ROOT_ID"
          @click="slideInPanelStore.toggleNmjl()"
        >
          Card
        </button>
        <button
          type="button"
          data-testid="lobby-chat-toggle"
          class="rounded-md border border-transparent bg-transparent px-3 py-2 text-3 text-text-secondary/90 hover:bg-chrome-surface/40 focus-visible:focus-ring-on-chrome"
          :aria-expanded="slideInPanelStore.activePanel === 'chat'"
          :aria-controls="SLIDE_IN_CHAT_PANEL_ROOT_ID"
          @click="slideInPanelStore.toggleChat()"
        >
          Chat
        </button>
      </div>
      <div
        v-if="!slideInPanelStore.isAnySlideInPanelOpen"
        class="relative mb-4 flex justify-center"
      >
        <div
          v-if="lobbyReactionBubblesByAnchor.local.length > 0"
          class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2"
          aria-live="polite"
        >
          <ReactionBubbleStack :items="lobbyReactionBubblesByAnchor.local" />
        </div>
        <ReactionBar layout="horizontal" :on-react="(e: string) => conn.sendReaction(e)" />
      </div>
      <div
        v-if="
          !slideInPanelStore.isAnySlideInPanelOpen && lobbyReactionBubblesByAnchor.top.length > 0
        "
        class="pointer-events-none absolute left-1/2 top-24 z-10 -translate-x-1/2"
        aria-live="polite"
      >
        <ReactionBubbleStack :items="lobbyReactionBubblesByAnchor.top" />
      </div>
      <div
        v-if="
          !slideInPanelStore.isAnySlideInPanelOpen && lobbyReactionBubblesByAnchor.left.length > 0
        "
        class="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2"
        aria-live="polite"
      >
        <ReactionBubbleStack :items="lobbyReactionBubblesByAnchor.left" />
      </div>
      <div
        v-if="
          !slideInPanelStore.isAnySlideInPanelOpen && lobbyReactionBubblesByAnchor.right.length > 0
        "
        class="pointer-events-none absolute right-2 top-1/2 z-10 -translate-y-1/2"
        aria-live="polite"
      >
        <ReactionBubbleStack :items="lobbyReactionBubblesByAnchor.right" />
      </div>
      <SlideInReferencePanels
        :send-chat="(t: string) => conn.sendChat(t)"
        :on-escape-focus-target="focusLobbyAfterChatEscape"
      />
      <h2 class="mb-2 text-4 font-semibold">Lobby</h2>
      <p class="mb-4 text-3.5 text-text-secondary">{{ lobbyState.players.length }} / 4 players</p>
      <ul class="mb-6 space-y-2">
        <li
          v-for="p in lobbyState.players"
          :key="p.playerId"
          class="rounded-md border border-chrome-border bg-chrome-surface px-3 py-2 text-3.5"
        >
          {{ p.displayName }}
          <span v-if="p.isHost" class="ml-2 text-text-secondary">Host</span>
          <span v-if="p.playerId === localPlayerId" class="ml-2 text-state-turn-active">You</span>
        </li>
      </ul>

      <RoomSettingsPanel
        :settings="lobbyState.settings"
        :can-edit="canEditLobbySettings"
        phase="lobby"
        @change="(p) => conn.sendSetRoomSettings(p)"
      />
      <div v-if="isHost" class="mt-4 flex flex-col gap-4">
        <button
          type="button"
          class="rounded-md bg-state-turn-active px-4 py-2 text-3.5 font-medium text-text-on-felt disabled:opacity-50"
          :disabled="lobbyState.players.length < 4"
          @click="conn.sendStartGame()"
        >
          Start game
        </button>
        <p v-if="lobbyState.players.length < 4" class="text-3 text-text-secondary">
          Need four players connected to start.
        </p>
      </div>
      <p v-else class="mt-4 text-3.5 text-text-secondary">
        Waiting for the host to start the game.
      </p>
    </div>

    <GameTable
      v-else-if="tableProps"
      v-bind="tableProps"
      :reaction-anchor-for-player="reactionAnchorForPlayer"
      :resolved-action="resolvedAction ?? null"
      :room-settings="playerGameView?.settings ?? null"
      :can-edit-room-settings="canEditGameSettings"
      :av-show-reconnecting="avReconnectUi.showReconnecting"
      :av-show-reconnect-button="avReconnectUi.showReconnectButton"
      :av-manual-reconnect-phase="avReconnectUi.manualPhase"
      @room-settings-change="(p) => conn.sendSetRoomSettings(p)"
      @reconnect-av="avReconnectUi.onReconnectAv"
      @send-chat="(t: string) => conn.sendChat(t)"
      @send-reaction="(e: string) => conn.sendReaction(e)"
      @discard="onDiscard"
      @pass="onPass"
      @call="onCall"
      @declare-mahjong="onDeclareMahjong"
      @cancel-mahjong="onCancelMahjong"
      @charleston-pass="onCharlestonPass"
      @charleston-vote="onCharlestonVote"
      @courtesy-pass="onCourtesyPass"
      @social-override-request="onSocialOverrideRequest"
      @social-override-vote="onSocialOverrideVote"
      @table-talk-report="onTableTalkReport"
      @table-talk-vote="onTableTalkVote"
      @confirm-call="onConfirmCall"
      @retract-call="onRetractCall"
      @afk-vote="(targetId, vote) => conn.sendAfkVote(targetId, vote)"
      @departure-vote="(targetId, choice) => conn.sendDepartureVote(targetId, choice)"
      @leave-game="conn.sendLeaveRoom()"
      @rematch="conn.sendRematch()"
      @end-session="conn.sendEndSession()"
      @show-hand="conn.sendShowHand()"
    />

    <div
      v-if="sessionEndedSnapshot && lobbyState"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      data-testid="session-ended-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-ended-title"
    >
      <BasePanel
        tag="div"
        variant="dark-raised"
        class="max-h-[85dvh] w-full max-w-lg overflow-y-auto p-6"
      >
        <h2 id="session-ended-title" class="mb-4 text-5 font-semibold text-text-on-felt">
          Session ended
        </h2>
        <p class="mb-3 text-3.5 text-text-on-felt/85">Final session totals</p>
        <ul class="mb-6 space-y-2">
          <li
            v-for="p in lobbyState.players"
            :key="p.playerId"
            class="flex justify-between rounded-md border border-chrome-border/50 px-3 py-2 text-3.5 text-text-on-felt"
          >
            <span>{{ p.displayName }}</span>
            <span class="font-semibold">{{
              sessionEndedSnapshot.sessionTotals[p.playerId] ?? 0
            }}</span>
          </li>
        </ul>
        <p
          v-if="sessionEndedSnapshot.sessionGameHistory.length > 0"
          class="mb-2 text-3.5 font-medium text-text-on-felt"
        >
          Games played
        </p>
        <ul
          v-if="sessionEndedSnapshot.sessionGameHistory.length > 0"
          class="mb-6 space-y-1 text-3 text-text-on-felt/80"
        >
          <li v-for="g in sessionEndedSnapshot.sessionGameHistory" :key="g.gameNumber">
            Game {{ g.gameNumber }} —
            <template v-if="g.gameResult && g.gameResult.winnerId !== null">
              {{ g.gameResult.patternName }} ({{ g.gameResult.points }} pts)
            </template>
            <template v-else>Wall game</template>
          </li>
        </ul>
        <button
          type="button"
          data-testid="session-ended-dismiss"
          class="rounded-md bg-gold-accent px-4 py-2 text-3.5 font-medium text-text-primary"
          @click="sessionEndedSnapshot = null"
        >
          Close
        </button>
      </BasePanel>
    </div>
  </div>
</template>
