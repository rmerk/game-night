import { describe, expect, it } from "vite-plus/test";
import { createLobbyState, DEFAULT_ROOM_SETTINGS } from "@mahjong-game/shared";
import type { Room } from "./room";
import { applyRoomSettingsUpdate, isBetweenGames } from "./room-settings";
import { createSilentTestLogger } from "../testing/silent-logger";

function minimalRoom(overrides: Partial<Room> = {}): Room {
  const base: Room = {
    roomId: "r",
    roomCode: "TEST",
    hostToken: "h",
    players: new Map(),
    sessions: new Map(),
    tokenMap: new Map(),
    playerTokens: new Map(),
    graceTimers: new Map(),
    lifecycleTimers: new Map(),
    socialOverrideTimer: null,
    tableTalkReportTimer: null,
    gameState: null,
    settings: { ...DEFAULT_ROOM_SETTINGS },
    jokerRulesMode: DEFAULT_ROOM_SETTINGS.jokerRulesMode,
    chatHistory: [],
    chatRateTimestamps: new Map(),
    reactionRateTimestamps: new Map(),
    paused: false,
    pausedAt: null,
    turnTimerConfig: {
      mode: DEFAULT_ROOM_SETTINGS.timerMode,
      durationMs: DEFAULT_ROOM_SETTINGS.turnDurationMs,
    },
    turnTimerHandle: null,
    turnTimerStage: null,
    turnTimerPlayerId: null,
    consecutiveTurnTimeouts: new Map(),
    afkVoteState: null,
    afkVoteCooldownPlayerIds: new Set(),
    deadSeatPlayerIds: new Set(),
    departedPlayerIds: new Set(),
    departureVoteState: null,
    createdAt: 0,
    logger: createSilentTestLogger(),
    sessionScoresFromPriorGames: {},
    sessionGameHistory: [],
  };
  return { ...base, ...overrides };
}

describe("isBetweenGames", () => {
  it("is true when lobby (no game state)", () => {
    const room = minimalRoom({ gameState: null });
    expect(isBetweenGames(room)).toBe(true);
  });
});

describe("applyRoomSettingsUpdate", () => {
  it("merges handGuidanceEnabled (5B.2)", () => {
    const room = minimalRoom();
    const r = applyRoomSettingsUpdate(
      room,
      { handGuidanceEnabled: false },
      createSilentTestLogger(),
    );
    expect(r.ok).toBe(true);
    if (r.ok === true) {
      expect(r.next.handGuidanceEnabled).toBe(false);
    }
  });

  it("rejects out-of-range turn duration", () => {
    const room = minimalRoom();
    const r = applyRoomSettingsUpdate(room, { turnDurationMs: 10_000 }, createSilentTestLogger());
    expect(r.ok).toBe(false);
    if (r.ok === false) {
      expect(r.error).toContain("turnDurationMs");
    }
  });

  it("returns noop when patch matches current settings", () => {
    const room = minimalRoom();
    const r = applyRoomSettingsUpdate(
      room,
      { jokerRulesMode: DEFAULT_ROOM_SETTINGS.jokerRulesMode },
      createSilentTestLogger(),
    );
    expect(r).toEqual({ ok: "noop" });
  });

  it("merges valid turn duration and syncs turnTimerConfig", () => {
    const room = minimalRoom();
    const r = applyRoomSettingsUpdate(room, { turnDurationMs: 25_000 }, createSilentTestLogger());
    expect(r.ok).toBe(true);
    if (r.ok === true) {
      expect(room.settings.turnDurationMs).toBe(25_000);
      expect(room.turnTimerConfig.durationMs).toBe(25_000);
      expect(room.jokerRulesMode).toBe(room.settings.jokerRulesMode);
    }
  });

  /** T10: defensive timerMode timed→none clears AFK vote + turn timer even if called with active play state. */
  it("timerMode flip to none cancels AFK vote state and turn timer hooks", () => {
    const gs = createLobbyState();
    gs.gamePhase = "play";
    const room = minimalRoom({
      gameState: gs,
      afkVoteState: {
        targetPlayerId: "p1",
        startedAt: 0,
        votes: new Map(),
      },
    });
    const logger = createSilentTestLogger();
    const r = applyRoomSettingsUpdate(room, { timerMode: "none" }, logger);
    expect(r.ok).toBe(true);
    expect(room.afkVoteState).toBeNull();
    expect(room.settings.timerMode).toBe("none");
  });
});
