import type { Tile } from "./tiles";
import type { GroupType } from "./card";

/** Game-level phase */
export type GamePhase = "lobby" | "charleston" | "play" | "scoreboard" | "rematch";

/** Turn-level phase within active play */
export type TurnPhase = "draw" | "discard" | "callWindow";

/** Seat wind assignment (counterclockwise play order) */
export type SeatWind = "east" | "south" | "west" | "north";

/** Identity of an exposed group — fixed at exposure time, never changes */
export interface GroupIdentity {
  readonly type: GroupType;
  readonly suit?: string;
  readonly value?: number | string;
  readonly wind?: string;
  readonly dragon?: string;
}

/** Exposed group on a player's table — populated in Epic 3A when groups are called */
export interface ExposedGroup {
  readonly type: GroupType;
  readonly tiles: Tile[];
  readonly identity: GroupIdentity;
}

/** Per-player state within a game */
export interface PlayerState {
  readonly id: string;
  readonly seatWind: SeatWind;
  readonly rack: Tile[];
  readonly exposedGroups: ExposedGroup[];
  readonly discardPool: Tile[];
}

/** Result of a wall game (draw) — no winner, no payments */
export interface WallGameResult {
  readonly winnerId: null;
  readonly points: 0;
}

/** Per-player payment amounts — positive = receives, negative = pays */
export type PaymentBreakdown = Record<string, number>;

/** Result of a Mahjong win — winner, matched pattern, and payment distribution */
export interface MahjongGameResult {
  readonly winnerId: string;
  readonly patternId: string;
  readonly patternName: string;
  readonly points: number;
  readonly selfDrawn: boolean;
  readonly discarderId?: string;
  readonly payments: PaymentBreakdown;
}

/** Game result — wall game (draw) or Mahjong win */
export type GameResult = WallGameResult | MahjongGameResult;

/** Types of group calls (same-tile and pattern-defined) */
export type CallType = "pung" | "kong" | "quint" | "news" | "dragon_set";

/** A recorded call in the call window buffer */
export interface CallRecord {
  readonly callType: CallType;
  readonly playerId: string;
  readonly tileIds: string[];
}

/** Call window state — opened after each discard to allow other players to call the tile */
export interface CallWindowState {
  readonly status: "open";
  readonly discardedTile: Tile;
  readonly discarderId: string;
  readonly passes: string[];
  readonly calls: CallRecord[];
  readonly openedAt: number;
}

/** Complete game state — mutated in-place by action handlers via validate-then-mutate pattern */
export interface GameState {
  gamePhase: GamePhase;
  players: Record<string, PlayerState>;
  wall: Tile[];
  wallRemaining: number;
  currentTurn: string;
  turnPhase: TurnPhase;
  lastDiscard: { tile: Tile; discarderId: string } | null;
  callWindow: CallWindowState | null;
  scores: Record<string, number>;
  gameResult: GameResult | null;
}

/** Result of processing a game action */
export interface ActionResult {
  readonly accepted: boolean;
  readonly reason?: string;
  readonly resolved?: ResolvedAction;
}

/** Describes what happened after a successful action */
export type ResolvedAction =
  | { readonly type: "GAME_STARTED" }
  | { readonly type: "DRAW_TILE"; readonly playerId: string }
  | { readonly type: "DISCARD_TILE"; readonly playerId: string; readonly tileId: string }
  | { readonly type: "WALL_GAME" }
  | {
      readonly type: "CALL_WINDOW_OPENED";
      readonly discarderId: string;
      readonly discardedTileId: string;
    }
  | { readonly type: "CALL_WINDOW_CLOSED"; readonly reason: "all_passed" | "timer_expired" }
  | { readonly type: "PASS_CALL"; readonly playerId: string }
  | { readonly type: "CALL_PUNG"; readonly playerId: string }
  | { readonly type: "CALL_KONG"; readonly playerId: string }
  | { readonly type: "CALL_QUINT"; readonly playerId: string }
  | { readonly type: "CALL_NEWS"; readonly playerId: string }
  | { readonly type: "CALL_DRAGON_SET"; readonly playerId: string };
