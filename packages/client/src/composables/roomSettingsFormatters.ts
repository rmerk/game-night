import type { GamePhase, RoomSettings } from "@mahjong-game/shared";

export function humanLabel(key: keyof RoomSettings): string {
  switch (key) {
    case "timerMode":
      return "timer mode";
    case "turnDurationMs":
      return "turn timer";
    case "jokerRulesMode":
      return "Joker rules";
    case "dealingStyle":
      return "dealing style";
    case "handGuidanceEnabled":
      return "hand guidance";
    default: {
      const _exhaustive: never = key;
      return String(_exhaustive);
    }
  }
}

export function humanValue(key: keyof RoomSettings, next: RoomSettings): string {
  switch (key) {
    case "timerMode":
      return next.timerMode === "timed" ? `${Math.round(next.turnDurationMs / 1000)}s` : "no timer";
    case "turnDurationMs":
      return `${Math.round(next.turnDurationMs / 1000)}s`;
    case "jokerRulesMode":
      return next.jokerRulesMode === "standard" ? "Standard" : "Simplified";
    case "dealingStyle":
      return next.dealingStyle === "instant" ? "Instant" : "Animated traditional";
    case "handGuidanceEnabled":
      return next.handGuidanceEnabled ? "On" : "Off";
    default: {
      const _exhaustive: never = key;
      return String(_exhaustive);
    }
  }
}

/** Host can edit in lobby, scoreboard, or rematch — not during play/charleston. */
export function canEditRoomSettings(isHost: boolean, phase: GamePhase | "lobby"): boolean {
  if (!isHost) return false;
  return phase === "lobby" || phase === "scoreboard" || phase === "rematch";
}
