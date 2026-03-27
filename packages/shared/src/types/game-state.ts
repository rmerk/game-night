import type { Tile } from "./tiles";

/** Game-level phase */
export type GamePhase = "lobby" | "charleston" | "play" | "scoreboard" | "rematch";

/** Turn-level phase within active play */
export type TurnPhase = "draw" | "discard" | "callWindow";

/** Seat wind assignment (counterclockwise play order) */
export type SeatWind = "east" | "south" | "west" | "north";

/** Stub for exposed groups — full implementation in Epic 3A */
export interface ExposedGroup {
  readonly type: string;
  readonly tiles: Tile[];
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

/** Game result — currently only wall game; Mahjong result added in later epic */
export type GameResult = WallGameResult;

/** Complete game state — mutated in-place by action handlers via validate-then-mutate pattern */
export interface GameState {
  gamePhase: GamePhase;
  players: Record<string, PlayerState>;
  wall: Tile[];
  wallRemaining: number;
  currentTurn: string;
  turnPhase: TurnPhase;
  lastDiscard: { tile: Tile; discarderId: string } | null;
  callWindow: null;
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
  | { readonly type: "WALL_GAME" };
