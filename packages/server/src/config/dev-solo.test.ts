import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import {
  isDevSoloStartEnabled,
  makeDevSoloGhostSpecs,
  removeAddedDevSoloGhostPlayers,
  stripDevSoloGhostPlayers,
} from "./dev-solo";
import { createTestPlayer, createTestRoom } from "../testing/create-test-room";

describe("dev-solo config", () => {
  let origNodeEnv: string | undefined;
  let origSolo: string | undefined;

  beforeEach(() => {
    origNodeEnv = process.env.NODE_ENV;
    origSolo = process.env.MAHJONG_DEV_SOLO_START;
  });

  afterEach(() => {
    if (origNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = origNodeEnv;
    if (origSolo === undefined) delete process.env.MAHJONG_DEV_SOLO_START;
    else process.env.MAHJONG_DEV_SOLO_START = origSolo;
  });

  it("isDevSoloStartEnabled is false in production", () => {
    process.env.NODE_ENV = "production";
    process.env.MAHJONG_DEV_SOLO_START = "1";
    expect(isDevSoloStartEnabled()).toBe(false);
  });

  it("isDevSoloStartEnabled requires opt-in when not production", () => {
    process.env.NODE_ENV = "test";
    delete process.env.MAHJONG_DEV_SOLO_START;
    expect(isDevSoloStartEnabled()).toBe(false);
    process.env.MAHJONG_DEV_SOLO_START = "1";
    expect(isDevSoloStartEnabled()).toBe(true);
    process.env.MAHJONG_DEV_SOLO_START = "true";
    expect(isDevSoloStartEnabled()).toBe(true);
  });

  it("makeDevSoloGhostSpecs returns three unique ids for a room", () => {
    const specs = makeDevSoloGhostSpecs("room-uuid");
    expect(specs).toHaveLength(3);
    const ids = specs.map((s) => s.playerId);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => id.startsWith("dev-solo-room-uuid-"))).toBe(true);
  });

  it("stripDevSoloGhostPlayers removes map entries and clears tracking", () => {
    const room = createTestRoom();
    const host = createTestPlayer("h", "east", true);
    room.players.set(host.playerId, host);
    const g = makeDevSoloGhostSpecs("rid")[0];
    room.players.set(g.playerId, {
      playerId: g.playerId,
      displayName: g.displayName,
      wind: g.wind,
      isHost: false,
      connected: false,
      connectedAt: 0,
    });
    room.devSoloGhostPlayerIds = [g.playerId];
    room.seatStatus.deadSeatPlayerIds.add(g.playerId);

    stripDevSoloGhostPlayers(room);

    expect(room.players.has(g.playerId)).toBe(false);
    expect(room.players.has(host.playerId)).toBe(true);
    expect(room.devSoloGhostPlayerIds).toBeUndefined();
    expect(room.seatStatus.deadSeatPlayerIds.has(g.playerId)).toBe(false);
  });

  it("removeAddedDevSoloGhostPlayers clears orphans without devSoloGhostPlayerIds", () => {
    const room = createTestRoom();
    const g = makeDevSoloGhostSpecs("rid")[0];
    room.players.set(g.playerId, {
      playerId: g.playerId,
      displayName: g.displayName,
      wind: g.wind,
      isHost: false,
      connected: false,
      connectedAt: 0,
    });
    room.seatStatus.deadSeatPlayerIds.add(g.playerId);
    removeAddedDevSoloGhostPlayers(room, [g.playerId]);
    expect(room.players.has(g.playerId)).toBe(false);
    expect(room.seatStatus.deadSeatPlayerIds.has(g.playerId)).toBe(false);
  });
});
