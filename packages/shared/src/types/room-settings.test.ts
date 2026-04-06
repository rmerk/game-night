import { describe, expect, it } from "vite-plus/test";
import { DEFAULT_ROOM_SETTINGS, MAX_TURN_DURATION_MS, MIN_TURN_DURATION_MS } from "./room-settings";

describe("RoomSettings defaults (Story 4B.7)", () => {
  it("DEFAULT_ROOM_SETTINGS has expected shape", () => {
    expect(DEFAULT_ROOM_SETTINGS.timerMode).toBe("timed");
    expect(DEFAULT_ROOM_SETTINGS.turnDurationMs).toBe(20_000);
    expect(DEFAULT_ROOM_SETTINGS.jokerRulesMode).toBe("standard");
    expect(DEFAULT_ROOM_SETTINGS.dealingStyle).toBe("instant");
    expect(DEFAULT_ROOM_SETTINGS.handGuidanceEnabled).toBe(true);
  });

  it("min/max turn duration ordering", () => {
    expect(MIN_TURN_DURATION_MS).toBeLessThan(MAX_TURN_DURATION_MS);
  });
});
