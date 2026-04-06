/**
 * Host room settings merge + sync with legacy split fields (`jokerRulesMode`, `turnTimerConfig`).
 * Single mutation path for SET_ROOM_SETTINGS and SET_JOKER_RULES (Story 4B.7).
 */
import type { FastifyBaseLogger } from "fastify";
import type { JokerRulesMode, RoomSettings } from "@mahjong-game/shared";
import { MAX_TURN_DURATION_MS, MIN_TURN_DURATION_MS } from "@mahjong-game/shared";
import { cancelLifecycleTimer } from "./room-lifecycle";
import { cancelTurnTimer } from "../websocket/turn-timer";
import type { Room } from "./room";

/** Lobby, scoreboard, or rematch — settings may change; play/charleston blocked (FR4). */
export function isBetweenGames(room: Room): boolean {
  if (room.gameState === null) return true;
  const p = room.gameState.gamePhase;
  return p === "scoreboard" || p === "rematch";
}

export type RoomSettingsPatch = Partial<{
  timerMode: RoomSettings["timerMode"];
  turnDurationMs: number;
  jokerRulesMode: JokerRulesMode;
  dealingStyle: RoomSettings["dealingStyle"];
  handGuidanceEnabled: boolean;
}>;

function mergeRoomSettings(
  current: RoomSettings,
  patch: RoomSettingsPatch,
): { ok: true; value: RoomSettings } | { ok: false; error: string } {
  let next: RoomSettings = { ...current };

  if (patch.timerMode !== undefined) {
    if (patch.timerMode !== "timed" && patch.timerMode !== "none") {
      return { ok: false, error: "timerMode: must be 'timed' or 'none'" };
    }
    next = { ...next, timerMode: patch.timerMode };
  }

  if (patch.turnDurationMs !== undefined) {
    const v = patch.turnDurationMs;
    if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v)) {
      return { ok: false, error: "turnDurationMs: must be a finite integer" };
    }
    if (next.timerMode === "none") {
      next = { ...next, turnDurationMs: current.turnDurationMs };
    } else {
      if (v < MIN_TURN_DURATION_MS || v > MAX_TURN_DURATION_MS) {
        return {
          ok: false,
          error: `turnDurationMs: must be between ${MIN_TURN_DURATION_MS} and ${MAX_TURN_DURATION_MS} ms`,
        };
      }
      next = { ...next, turnDurationMs: v };
    }
  }

  if (patch.jokerRulesMode !== undefined) {
    if (patch.jokerRulesMode !== "standard" && patch.jokerRulesMode !== "simplified") {
      return { ok: false, error: "jokerRulesMode: must be 'standard' or 'simplified'" };
    }
    next = { ...next, jokerRulesMode: patch.jokerRulesMode };
  }

  if (patch.dealingStyle !== undefined) {
    if (patch.dealingStyle !== "instant" && patch.dealingStyle !== "animated") {
      return { ok: false, error: "dealingStyle: must be 'instant' or 'animated'" };
    }
    next = { ...next, dealingStyle: patch.dealingStyle };
  }

  if (patch.handGuidanceEnabled !== undefined) {
    if (typeof patch.handGuidanceEnabled !== "boolean") {
      return { ok: false, error: "handGuidanceEnabled: must be boolean" };
    }
    next = { ...next, handGuidanceEnabled: patch.handGuidanceEnabled };
  }

  if (next.timerMode === "timed") {
    if (next.turnDurationMs < MIN_TURN_DURATION_MS || next.turnDurationMs > MAX_TURN_DURATION_MS) {
      return { ok: false, error: "turnDurationMs: out of range for timed mode" };
    }
  }

  return { ok: true, value: next };
}

function diffSettingsKeys(previous: RoomSettings, next: RoomSettings): (keyof RoomSettings)[] {
  const out: (keyof RoomSettings)[] = [];
  for (const k of [
    "timerMode",
    "turnDurationMs",
    "jokerRulesMode",
    "dealingStyle",
    "handGuidanceEnabled",
  ] as const) {
    if (previous[k] !== next[k]) out.push(k);
  }
  return out;
}

export type ApplyRoomSettingsResult =
  | {
      ok: true;
      previous: RoomSettings;
      next: RoomSettings;
      changedKeys: readonly (keyof RoomSettings)[];
    }
  | { ok: false; error: string }
  | { ok: "noop" };

/**
 * Validates `patch`, merges into `room.settings`, syncs split fields, runs timer-mode side-effects.
 * Returns `noop` when nothing changes; mutates `room` on success.
 */
export function applyRoomSettingsUpdate(
  room: Room,
  patch: RoomSettingsPatch,
  logger: FastifyBaseLogger,
): ApplyRoomSettingsResult {
  if (Object.keys(patch).length === 0) {
    return { ok: "noop" };
  }

  const merged = mergeRoomSettings(room.settings, patch);
  if (!merged.ok) {
    return { ok: false, error: merged.error };
  }

  const previous = room.settings;
  const next = merged.value;
  const changedKeys = diffSettingsKeys(previous, next);
  if (changedKeys.length === 0) {
    return { ok: "noop" };
  }

  if (previous.timerMode === "timed" && next.timerMode === "none") {
    cancelTurnTimer(room, logger);
    room.turnTimer.consecutiveTimeouts.clear();
    room.turnTimer.afkVoteCooldownPlayerIds.clear();
    if (room.votes.afk !== null) {
      cancelLifecycleTimer(room, "afk-vote-timeout");
      room.votes.afk = null;
    }
  }

  room.settings = next;
  room.jokerRulesMode = next.jokerRulesMode;
  room.turnTimer.config = { mode: next.timerMode, durationMs: next.turnDurationMs };

  return { ok: true, previous, next, changedKeys };
}
