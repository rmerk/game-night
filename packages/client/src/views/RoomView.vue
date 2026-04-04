<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { CallType, JokerRulesMode } from "@mahjong-game/shared";
import GameTable from "../components/game/GameTable.vue";
import { mapPlayerGameViewToGameTableProps } from "../composables/mapPlayerGameViewToGameTable";
import { buildGameActionFromTableEvent } from "../composables/gameActionFromPlayerView";
import { useRoomConnection } from "../composables/useRoomConnection";
import { useRackStore } from "../stores/rack";

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
} = conn;

const showSessionErrorBanner = computed(
  () =>
    lastErrorMessage.value !== null &&
    hasRequestedConnect.value &&
    (lobbyState.value !== null || playerGameView.value !== null),
);
const rackStore = useRackStore();

const tableProps = computed(() => {
  const v = playerGameView.value;
  if (!v) {
    return null;
  }
  return mapPlayerGameViewToGameTableProps(v, { resolvedAction: resolvedAction.value });
});

const isLobby = computed(() => lobbyState.value !== null && playerGameView.value === null);

const localPlayerId = computed(
  () => lobbyState.value?.myPlayerId ?? playerGameView.value?.myPlayerId ?? null,
);

const isHost = computed(() => {
  const lobby = lobbyState.value;
  if (!lobby) return false;
  return lobby.players.some((p) => p.playerId === lobby.myPlayerId && p.isHost);
});

watch(
  () => playerGameView.value,
  (v) => {
    if (v) {
      rackStore.reconcileWithServerRack(v.myRack);
    }
  },
  { immediate: true },
);

function joinRoom() {
  const name = displayNameInput.value.trim();
  if (!name || !roomCode.value) {
    return;
  }
  hasRequestedConnect.value = true;
  conn.connect(roomCode.value, name);
}

function leaveRoom() {
  conn.clearTokenForRoom(roomCode.value);
  conn.disconnect();
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

function onJokerRulesChange(ev: Event) {
  const el = ev.target as HTMLSelectElement;
  conn.sendSetJokerRules(el.value as JokerRulesMode);
}
</script>

<template>
  <div class="min-h-[100dvh] bg-felt-teal text-text-on-felt">
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

    <div v-if="!hasRequestedConnect" class="mx-auto max-w-md px-4 py-10">
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

    <div v-else-if="isLobby && lobbyState" class="mx-auto max-w-lg px-4 py-8">
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

      <div v-if="isHost" class="flex flex-col gap-4">
        <label class="block text-3.5">
          <span class="mb-1 block text-text-secondary">Joker rules (next game)</span>
          <select
            class="w-full rounded-md border border-chrome-border bg-chrome-surface px-3 py-2"
            :value="lobbyState.jokerRulesMode"
            @change="onJokerRulesChange"
          >
            <option value="standard">Standard</option>
            <option value="simplified">Simplified</option>
          </select>
        </label>
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
      <p v-else class="text-3.5 text-text-secondary">Waiting for the host to start the game.</p>
    </div>

    <GameTable
      v-else-if="tableProps"
      v-bind="tableProps"
      :resolved-action="resolvedAction ?? null"
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
    />
  </div>
</template>
