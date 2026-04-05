/** Turn timer mode for the room — host-editable between games (Story 4B.7). */
export type TimerMode = "timed" | "none";

/** Dealing animation preference — engine may ignore until Epic 5 (Story 4B.7). */
export type DealingStyle = "instant" | "animated";

/** Host-configurable room options — canonical client-visible shape; server keeps split fields in sync. */
export interface RoomSettings {
  readonly timerMode: TimerMode;
  /** 15_000..30_000 inclusive when timerMode === "timed"; preserved when timer is off. */
  readonly turnDurationMs: number;
  /** Same values as JokerRulesMode in game-state.ts — keep in sync. */
  readonly jokerRulesMode: "standard" | "simplified";
  readonly dealingStyle: DealingStyle;
}

export const MIN_TURN_DURATION_MS = 15_000;
export const MAX_TURN_DURATION_MS = 30_000;

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  timerMode: "timed",
  turnDurationMs: 20_000,
  jokerRulesMode: "standard",
  dealingStyle: "instant",
};
