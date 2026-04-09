import { describe, expect, test, vi } from "vitest";
import type { SeatWind } from "@mahjong-game/shared";
import { migrateHost } from "./host-migration";
import type { PlayerInfo, Room } from "./room";
import { createSilentTestLogger, createTestRoom, type CreateTestRoomOverrides } from "../testing";

function player(
  id: string,
  wind: SeatWind,
  overrides: Partial<Omit<PlayerInfo, "playerId" | "wind">> = {},
): PlayerInfo {
  return {
    playerId: id,
    displayName: id,
    wind,
    isHost: false,
    connected: true,
    connectedAt: 0,
    ...overrides,
  };
}

function createMockRoom(overrides?: CreateTestRoomOverrides): Room {
  return createTestRoom(overrides);
}

describe("migrateHost", () => {
  test("promotes next counterclockwise connected player after east host", () => {
    const e = player("e", "east", { isHost: true });
    const s = player("s", "south");
    const w = player("w", "west");
    const n = player("n", "north");
    const room = createMockRoom({
      players: new Map([
        [e.playerId, e],
        [s.playerId, s],
        [w.playerId, w],
        [n.playerId, n],
      ]),
    });
    const logger = createSilentTestLogger();
    const info = vi.spyOn(logger, "info");

    const result = migrateHost(room, logger);
    expect(result).toEqual({ previousHostId: "e", newHostId: "s" });
    expect(room.players.get("e")?.isHost).toBe(false);
    expect(room.players.get("s")?.isHost).toBe(true);
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ roomCode: "TEST01", previousHostId: "e", newHostId: "s" }),
      "Host migrated",
    );
  });

  test("skips dead-seated and departed players", () => {
    const e = player("e", "east", { isHost: true });
    const s = player("s", "south");
    const w = player("w", "west");
    const n = player("n", "north");
    const room = createMockRoom({
      players: new Map([
        [e.playerId, e],
        [s.playerId, s],
        [w.playerId, w],
        [n.playerId, n],
      ]),
      seatStatus: {
        deadSeatPlayerIds: new Set(["s"]),
        departedPlayerIds: new Set(["w"]),
      },
    });
    const result = migrateHost(room, createSilentTestLogger());
    expect(result.newHostId).toBe("n");
  });

  test("skips disconnected players", () => {
    const e = player("e", "east", { isHost: true });
    const s = player("s", "south", { connected: false });
    const w = player("w", "west");
    const room = createMockRoom({
      players: new Map([
        [e.playerId, e],
        [s.playerId, s],
        [w.playerId, w],
      ]),
    });
    const result = migrateHost(room, createSilentTestLogger());
    expect(result.newHostId).toBe("w");
  });

  test("returns hostless when no eligible candidate", () => {
    const e = player("e", "east", { isHost: true });
    const s = player("s", "south", { connected: false });
    const room = createMockRoom({
      players: new Map([
        [e.playerId, e],
        [s.playerId, s],
      ]),
    });
    const logger = createSilentTestLogger();
    const info = vi.spyOn(logger, "info");

    const result = migrateHost(room, logger);
    expect(result).toEqual({ previousHostId: "e", newHostId: null });
    expect(room.players.get("e")?.isHost).toBe(false);
    expect(info).toHaveBeenCalledWith(
      expect.objectContaining({ roomCode: "TEST01", previousHostId: "e" }),
      "Host migration: no eligible candidate, room is hostless",
    );
  });

  test("honors excludePlayerIds", () => {
    const e = player("e", "east", { isHost: true });
    const s = player("s", "south");
    const room = createMockRoom({
      players: new Map([
        [e.playerId, e],
        [s.playerId, s],
      ]),
    });
    const result = migrateHost(room, createSilentTestLogger(), {
      excludePlayerIds: new Set(["s"]),
    });
    expect(result.newHostId).toBeNull();
  });

  test("with no current host, starts search from east", () => {
    const w = player("w", "west");
    const n = player("n", "north");
    const room = createMockRoom({
      players: new Map([
        [w.playerId, w],
        [n.playerId, n],
      ]),
    });
    const result = migrateHost(room, createSilentTestLogger());
    expect(result.previousHostId).toBeNull();
    expect(result.newHostId).toBe("w");
    expect(w.isHost).toBe(true);
  });
});
