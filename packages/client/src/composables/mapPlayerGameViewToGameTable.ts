/**
 * Maps server `PlayerGameView` (payload `state` on WebSocket `STATE_UPDATE` when not in lobby — see
 * `StateUpdateMessage` in `@mahjong-game/shared` / `protocol.ts`) into props for `GameTable.vue`.
 *
 * Parse `STATE_UPDATE`, narrow `state` to `PlayerGameView`, and pass it here to drive the table
 * layout (opponents top/left/right, local bottom) without duplicating seat math.
 */
import {
  MAX_PLAYERS,
  SEATS,
  getValidCallOptions,
  type CallType,
  type ExposedGroup,
  type LobbyState,
  type PlayerGameView,
  type PlayerPublicInfo,
  type ResolvedAction,
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
  /** Local player's exposed melds — for hand guidance (Story 5B.2). */
  myExposedGroups: ExposedGroup[];
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
  paused: boolean;
  deadSeatPlayerIds: readonly string[];
  departureVoteState: PlayerGameView["departureVoteState"];
  scoresByPlayerId: Record<string, number>;
  sessionScoresFromPriorGames: Record<string, number>;
  sessionGameHistory: PlayerGameView["sessionGameHistory"];
  viewerIsHost: boolean;
  /** Revealed racks after "Show My Hand" in scoreboard phase (Story 5B.5). */
  shownHands: Record<string, Tile[]>;
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

/** Table slot for reaction bubbles — matches opponent grid vs local wind (Story 6A.3 AC4). */
export type ReactionBubbleAnchor = "top" | "left" | "right" | "local";

/**
 * Maps `playerId` to the same top/left/right/local slots as `mapPlayerGameViewToGameTableProps`
 * (uses `PlayerPublicInfo.wind` + `acrossSeat` / `leftSeat` / `rightSeat`). Unknown players → `null`.
 */
export function reactionBubbleAnchorForPlayer(
  view: PlayerGameView,
  playerId: string,
): ReactionBubbleAnchor | null {
  const myId = view.myPlayerId;
  if (playerId === myId) {
    return "local";
  }
  const local = view.players.find((p) => p.playerId === myId) ?? null;
  const localWind = local?.wind ?? "east";
  const p = view.players.find((x) => x.playerId === playerId);
  if (!p) {
    return null;
  }
  const w = p.wind;
  if (w === acrossSeat(localWind)) return "top";
  if (w === leftSeat(localWind)) return "left";
  if (w === rightSeat(localWind)) return "right";
  return null;
}

/**
 * Same seat geometry as `reactionBubbleAnchorForPlayer` for in-play, using lobby `players` + `myPlayerId`.
 * Used for optional lobby reaction bubbles (Story 6A.3 AC12).
 */
export function reactionBubbleAnchorForLobby(
  lobby: Pick<LobbyState, "players" | "myPlayerId">,
  playerId: string,
): ReactionBubbleAnchor | null {
  const myId = lobby.myPlayerId;
  if (playerId === myId) {
    return "local";
  }
  const local = lobby.players.find((p) => p.playerId === myId) ?? null;
  const localWind = local?.wind ?? "east";
  const p = lobby.players.find((x) => x.playerId === playerId);
  if (!p) {
    return null;
  }
  const w = p.wind;
  if (w === acrossSeat(localWind)) return "top";
  if (w === leftSeat(localWind)) return "left";
  if (w === rightSeat(localWind)) return "right";
  return null;
}

function canRequestTableTalkReportFromView(view: PlayerGameView): boolean {
  const myId = view.myPlayerId;
  if (view.gamePhase !== "play") return false;
  if (view.socialOverrideState) return false;
  if (view.challengeState) return false;
  if (view.tableTalkReportState) return false;
  if (view.myDeadHand) return false;
  if (view.players.length !== MAX_PLAYERS) return false;
  const used = view.tableTalkReportCountsByPlayerId[myId] ?? 0;
  if (used >= 2) return false;
  return true;
}

function invalidMahjongMessageFor(
  view: PlayerGameView,
  resolvedAction?: ResolvedAction | null,
): string | null {
  const myId = view.myPlayerId;
  if (resolvedAction?.type === "INVALID_MAHJONG_WARNING" && resolvedAction.playerId === myId) {
    return resolvedAction.reason;
  }
  if (view.pendingMahjong?.playerId === myId) {
    return "This Mahjong declaration is not valid. Cancel to continue without penalty, or confirm to accept a dead hand.";
  }
  return null;
}

export interface MapPlayerGameViewOptions {
  /** From the same `STATE_UPDATE` message; used for `invalidMahjongMessage` when applicable. */
  resolvedAction?: ResolvedAction | null;
}

/**
 * Maps a filtered `PlayerGameView` to props accepted by `GameTable`.
 * Pure function — safe for unit tests and for wiring `STATE_UPDATE` handlers.
 */
export function mapPlayerGameViewToGameTableProps(
  view: PlayerGameView,
  options?: MapPlayerGameViewOptions,
): GameTablePropsFromView {
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
    myExposedGroups: view.exposedGroups[myId] ?? [],
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
    canRequestTableTalkReport: canRequestTableTalkReportFromView(view),
    tableTalkReportState: view.tableTalkReportState,
    tableTalkReportCountsByPlayerId: view.tableTalkReportCountsByPlayerId,
    invalidMahjongMessage: invalidMahjongMessageFor(view, options?.resolvedAction),
    paused: view.paused ?? false,
    deadSeatPlayerIds: view.deadSeatPlayerIds ?? [],
    departureVoteState: view.departureVoteState ?? null,
    scoresByPlayerId: view.scores,
    sessionScoresFromPriorGames: view.sessionScoresFromPriorGames,
    sessionGameHistory: view.sessionGameHistory,
    viewerIsHost: view.players.find((p) => p.playerId === myId)?.isHost ?? false,
    shownHands: view.shownHands ?? {},
  };
}
