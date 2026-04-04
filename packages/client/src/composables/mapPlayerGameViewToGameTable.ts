/**
 * Maps server `PlayerGameView` (payload `state` on WebSocket `STATE_UPDATE` when not in lobby — see
 * `StateUpdateMessage` in `@mahjong-game/shared` / `protocol.ts`) into props for `GameTable.vue`.
 *
 * Parse `STATE_UPDATE`, narrow `state` to `PlayerGameView`, and pass it here to drive the table
 * layout (opponents top/left/right, local bottom) without duplicating seat math.
 */
import {
  SEATS,
  getValidCallOptions,
  type CallType,
  type PlayerGameView,
  type PlayerPublicInfo,
  type SeatWind,
  type Tile,
} from "@mahjong-game/shared";
import type { LocalPlayerSummary, OpponentPlayer } from "../components/game/seat-types";

export interface GameTablePropsFromView {
  opponents: {
    top: OpponentPlayer | null;
    left: OpponentPlayer | null;
    right: OpponentPlayer | null;
  };
  localPlayer: LocalPlayerSummary | null;
  tiles: Tile[];
  isPlayerTurn: boolean;
  currentTurnSeat: SeatWind | null;
  wallRemaining: number;
  gamePhase: PlayerGameView["gamePhase"];
  gameResult: PlayerGameView["gameResult"];
  discardPools: {
    bottom?: Tile[];
    top?: Tile[];
    left?: Tile[];
    right?: Tile[];
  };
  callWindow: PlayerGameView["callWindow"];
  validCallOptions: CallType[];
  charleston: PlayerGameView["charleston"];
  myDeadHand: boolean;
  canRequestSocialOverride: boolean;
  socialOverrideState: PlayerGameView["socialOverrideState"];
  canRequestTableTalkReport: boolean;
  tableTalkReportState: PlayerGameView["tableTalkReportState"];
  tableTalkReportCountsByPlayerId: PlayerGameView["tableTalkReportCountsByPlayerId"];
  invalidMahjongMessage: string | null;
}

function initialFromName(name: string): string {
  const t = name.trim();
  return t.length > 0 ? t[0].toUpperCase() : "?";
}

function acrossSeat(w: SeatWind): SeatWind {
  const i = SEATS.indexOf(w);
  return SEATS[(i + 2) % 4];
}

function leftSeat(w: SeatWind): SeatWind {
  const i = SEATS.indexOf(w);
  return SEATS[(i + 3) % 4];
}

function rightSeat(w: SeatWind): SeatWind {
  const i = SEATS.indexOf(w);
  return SEATS[(i + 1) % 4];
}

function toOpponent(p: PlayerPublicInfo, scores: Record<string, number>): OpponentPlayer {
  return {
    id: p.playerId,
    name: p.displayName,
    initial: initialFromName(p.displayName),
    connected: p.connected,
    seatWind: p.wind,
    score: scores[p.playerId] ?? 0,
  };
}

function seatToDiscardKey(
  seat: SeatWind,
  localWind: SeatWind,
): "bottom" | "top" | "left" | "right" {
  if (seat === localWind) return "bottom";
  if (seat === acrossSeat(localWind)) return "top";
  if (seat === leftSeat(localWind)) return "left";
  return "right";
}

/**
 * Maps a filtered `PlayerGameView` to props accepted by `GameTable`.
 * Pure function — safe for unit tests and for wiring `STATE_UPDATE` handlers.
 */
export function mapPlayerGameViewToGameTableProps(view: PlayerGameView): GameTablePropsFromView {
  const myId = view.myPlayerId;
  const local = view.players.find((p) => p.playerId === myId) ?? null;
  const localWind = local?.wind ?? "east";

  const opponents: GameTablePropsFromView["opponents"] = {
    top: null,
    left: null,
    right: null,
  };

  for (const p of view.players) {
    if (p.playerId === myId) continue;
    const o = toOpponent(p, view.scores);
    if (p.wind === acrossSeat(localWind)) opponents.top = o;
    else if (p.wind === leftSeat(localWind)) opponents.left = o;
    else if (p.wind === rightSeat(localWind)) opponents.right = o;
  }

  const discardPools: GameTablePropsFromView["discardPools"] = {};
  for (const [playerId, tiles] of Object.entries(view.discardPools)) {
    const pw = view.players.find((x) => x.playerId === playerId)?.wind;
    if (!pw) continue;
    const key = seatToDiscardKey(pw, localWind);
    discardPools[key] = tiles;
  }

  const currentPlayer = view.players.find((p) => p.playerId === view.currentTurn);
  const currentTurnSeat = currentPlayer?.wind ?? null;

  let validCallOptions: CallType[] = [];
  const cw = view.callWindow;
  if (cw !== null && cw.status === "open") {
    validCallOptions = getValidCallOptions(view.myRack, cw.discardedTile);
  }

  const localPlayer: LocalPlayerSummary | null = local
    ? {
        id: local.playerId,
        name: local.displayName,
        seatWind: local.wind,
        score: view.scores[local.playerId] ?? 0,
      }
    : null;

  return {
    opponents,
    localPlayer,
    tiles: view.myRack,
    isPlayerTurn: view.currentTurn === myId,
    currentTurnSeat,
    wallRemaining: view.wallRemaining,
    gamePhase: view.gamePhase,
    gameResult: view.gameResult,
    discardPools,
    callWindow: view.callWindow,
    validCallOptions,
    charleston: view.charleston,
    myDeadHand: view.myDeadHand,
    canRequestSocialOverride:
      view.gamePhase === "play" &&
      view.callWindow !== null &&
      view.callWindow.status === "open" &&
      view.callWindow.calls.length === 0 &&
      view.callWindow.passes.length === 0 &&
      view.currentTurn === myId,
    socialOverrideState: view.socialOverrideState,
    canRequestTableTalkReport: false,
    tableTalkReportState: view.tableTalkReportState,
    tableTalkReportCountsByPlayerId: view.tableTalkReportCountsByPlayerId,
    invalidMahjongMessage: null,
  };
}
