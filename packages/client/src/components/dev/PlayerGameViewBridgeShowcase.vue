<script setup lang="ts">
/**
 * Dev-only: proves `mapPlayerGameViewToGameTableProps` — the path from server `PlayerGameView`
 * (STATE_UPDATE.state) to GameTable props — without a live WebSocket.
 */
import { computed } from "vue";
import {
  DEFAULT_ROOM_SETTINGS,
  type PlayerGameView,
  type SuitedTile,
  type Tile,
} from "@mahjong-game/shared";
import TileSprite from "../tiles/TileSprite.vue";
import GameTable from "../game/GameTable.vue";
import { mapPlayerGameViewToGameTableProps } from "../../composables/mapPlayerGameViewToGameTable";

const t = (id: string, suit: "dot" | "bam" | "crak", value: number, copy: number): SuitedTile =>
  ({ id, category: "suited", suit, value, copy }) as SuitedTile;

function fixtureView(): PlayerGameView {
  const rack: Tile[] = [
    t("dot-1-1", "dot", 1, 1),
    t("dot-2-1", "dot", 2, 1),
    t("bam-3-1", "bam", 3, 1),
  ];
  const d1: Tile = t("bam-3-2", "bam", 3, 2);
  const d2: Tile = t("crak-4-1", "crak", 4, 1);
  const d3: Tile = t("dot-5-1", "dot", 5, 1);
  const d4: Tile = t("bam-6-1", "bam", 6, 1);

  return {
    roomId: "r-bridge",
    roomCode: "BRDG",
    gamePhase: "play",
    players: [
      { playerId: "pE", displayName: "Eastie", wind: "east", isHost: true, connected: true },
      { playerId: "pS", displayName: "Southie", wind: "south", isHost: false, connected: true },
      { playerId: "pW", displayName: "Westie", wind: "west", isHost: false, connected: true },
      { playerId: "pN", displayName: "Northie", wind: "north", isHost: false, connected: true },
    ],
    myPlayerId: "pS",
    myRack: rack,
    exposedGroups: {},
    discardPools: {
      pE: [d1],
      pS: [d2],
      pW: [d3],
      pN: [d4],
    },
    wallRemaining: 50,
    currentTurn: "pS",
    turnPhase: "discard",
    callWindow: null,
    scores: { pE: 10, pS: 25, pW: -5, pN: -30 },
    lastDiscard: null,
    gameResult: null,
    pendingMahjong: null,
    challengeState: null,
    socialOverrideState: null,
    tableTalkReportState: null,
    tableTalkReportCountsByPlayerId: {},
    charleston: null,
    shownHands: {},
    jokerRulesMode: "standard",
    settings: DEFAULT_ROOM_SETTINGS,
    myDeadHand: false,
    paused: false,
    deadSeatPlayerIds: [],
    departureVoteState: null,
  };
}

const tableProps = computed(() => mapPlayerGameViewToGameTableProps(fixtureView()));
</script>

<template>
  <TileSprite />
  <div>
    <div
      class="fixed top-0 left-0 right-0 z-50 bg-chrome-surface-dark/90 p-3 text-text-on-felt text-3.5"
    >
      <strong>PlayerGameView → GameTable bridge</strong>
      — same mapping used when wiring WebSocket <code class="text-2.5">STATE_UPDATE</code> to the
      table.
    </div>
    <div class="pt-14">
      <GameTable v-bind="tableProps" />
    </div>
  </div>
</template>
