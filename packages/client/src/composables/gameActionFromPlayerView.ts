import type { CallType, GameAction, PlayerGameView, Tile } from "@mahjong-game/shared";
import { tilesMatch, validateDragonSetGroup, validateNewsGroup } from "@mahjong-game/shared";

const REQUIRED_FROM_RACK: Record<CallType, number> = {
  pung: 2,
  kong: 3,
  quint: 4,
  news: 3,
  dragon_set: 2,
  mahjong: 0,
};

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...rest] = arr;
  if (head === undefined) {
    return [];
  }
  const withHead = combinations(rest, k - 1).map((c) => [head, ...c]);
  const withoutHead = combinations(rest, k);
  return [...withHead, ...withoutHead];
}

function pickSameTileCallTiles(rack: Tile[], discardedTile: Tile, count: number): string[] {
  const picked: string[] = [];
  for (const t of rack) {
    if (picked.length >= count) break;
    if (tilesMatch(t, discardedTile)) {
      picked.push(t.id);
    }
  }
  for (const t of rack) {
    if (picked.length >= count) break;
    if (t.category === "joker" && !picked.includes(t.id)) {
      picked.push(t.id);
    }
  }
  return picked.slice(0, count);
}

function pickPatternCallTiles(
  rack: Tile[],
  discardedTile: Tile,
  callType: "news" | "dragon_set",
): string[] {
  const k = REQUIRED_FROM_RACK[callType];
  const combos = combinations(rack, k);
  for (const combo of combos) {
    const ok =
      callType === "news"
        ? validateNewsGroup(combo, discardedTile)
        : validateDragonSetGroup(combo, discardedTile);
    if (ok) {
      return combo.map((t) => t.id);
    }
  }
  return [];
}

/**
 * Build a server-bound `GameAction` for GameTable interactions using the current filtered view.
 */
export function tileIdsForCall(view: PlayerGameView, callType: CallType): string[] {
  const cw = view.callWindow;
  if (!cw || cw.status !== "open") {
    return [];
  }
  const discardedTile = cw.discardedTile;
  const rack = view.myRack;

  if (callType === "mahjong") {
    const first = rack[0];
    return first ? [first.id] : [];
  }

  if (callType === "news" || callType === "dragon_set") {
    return pickPatternCallTiles(rack, discardedTile, callType);
  }

  const n = REQUIRED_FROM_RACK[callType];
  return pickSameTileCallTiles(rack, discardedTile, n);
}

export function buildGameActionFromTableEvent(
  view: PlayerGameView,
  event:
    | { type: "discard"; tileId: string }
    | { type: "pass" }
    | { type: "declareMahjong" }
    | { type: "cancelMahjong" }
    | { type: "call"; callType: CallType }
    | { type: "charlestonPass"; tileIds: string[] }
    | { type: "charlestonVote"; accept: boolean }
    | { type: "courtesyPass"; count: number; tileIds: string[] }
    | { type: "socialOverrideRequest"; description: string }
    | { type: "socialOverrideVote"; approve: boolean }
    | { type: "tableTalkReport"; reportedPlayerId: string; description: string }
    | { type: "tableTalkVote"; approve: boolean },
): GameAction | null {
  const playerId = view.myPlayerId;

  switch (event.type) {
    case "discard":
      return { type: "DISCARD_TILE", playerId, tileId: event.tileId };
    case "pass":
      return { type: "PASS_CALL", playerId };
    case "declareMahjong":
      return { type: "DECLARE_MAHJONG", playerId };
    case "cancelMahjong":
      return { type: "CANCEL_MAHJONG", playerId };
    case "call": {
      const ct = event.callType;
      if (ct === "mahjong") {
        const tileIds = tileIdsForCall(view, "mahjong");
        return { type: "CALL_MAHJONG", playerId, tileIds };
      }
      if (ct === "pung") {
        const tileIds = tileIdsForCall(view, "pung");
        return tileIds.length === 2 ? { type: "CALL_PUNG", playerId, tileIds } : null;
      }
      if (ct === "kong") {
        const tileIds = tileIdsForCall(view, "kong");
        return tileIds.length === 3 ? { type: "CALL_KONG", playerId, tileIds } : null;
      }
      if (ct === "quint") {
        const tileIds = tileIdsForCall(view, "quint");
        return tileIds.length === 4 ? { type: "CALL_QUINT", playerId, tileIds } : null;
      }
      if (ct === "news") {
        const tileIds = tileIdsForCall(view, "news");
        return tileIds.length === 3 ? { type: "CALL_NEWS", playerId, tileIds } : null;
      }
      if (ct === "dragon_set") {
        const tileIds = tileIdsForCall(view, "dragon_set");
        return tileIds.length === 2 ? { type: "CALL_DRAGON_SET", playerId, tileIds } : null;
      }
      return null;
    }
    case "charlestonPass":
      return { type: "CHARLESTON_PASS", playerId, tileIds: event.tileIds };
    case "charlestonVote":
      return { type: "CHARLESTON_VOTE", playerId, accept: event.accept };
    case "courtesyPass":
      return {
        type: "COURTESY_PASS",
        playerId,
        count: event.count,
        tileIds: event.tileIds,
      };
    case "socialOverrideRequest":
      return { type: "SOCIAL_OVERRIDE_REQUEST", playerId, description: event.description };
    case "socialOverrideVote":
      return { type: "SOCIAL_OVERRIDE_VOTE", playerId, approve: event.approve };
    case "tableTalkReport":
      return {
        type: "TABLE_TALK_REPORT",
        playerId,
        reportedPlayerId: event.reportedPlayerId,
        description: event.description,
      };
    case "tableTalkVote":
      return { type: "TABLE_TALK_VOTE", playerId, approve: event.approve };
    default:
      return null;
  }
}
