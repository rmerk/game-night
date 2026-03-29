import { describe, expect, it } from "vitest";
import type { SeatWind } from "@mahjong-game/shared";
import { assignNextSeat } from "./seat-assignment";
import type { Room } from "./room";

function createTestRoom(playerIds: string[] = []): Room {
  const room = {
    roomId: "test-room-id",
    roomCode: "TEST01",
    hostToken: "test-host-token",
    players: new Map(),
    sessions: new Map(),
    tokenMap: new Map(),
    playerTokens: new Map(),
    graceTimers: new Map(),
    gameState: null,
    createdAt: Date.now(),
    logger: { info: () => {}, warn: () => {}, debug: () => {}, child: () => ({}) } as never,
  };

  for (const id of playerIds) {
    room.players.set(id, {
      playerId: id,
      displayName: `Player ${id}`,
      wind: "east",
      isHost: false,
      connected: true,
      connectedAt: Date.now(),
    });
  }

  return room;
}

describe("assignNextSeat", () => {
  it("assigns player-0 with east wind to empty room", () => {
    const room = createTestRoom();
    const seat = assignNextSeat(room);
    expect(seat).toEqual({ playerId: "player-0", wind: "east" });
  });

  it("assigns player-1 with south wind when player-0 is taken", () => {
    const room = createTestRoom(["player-0"]);
    const seat = assignNextSeat(room);
    expect(seat).toEqual({ playerId: "player-1", wind: "south" });
  });

  it("assigns seats sequentially through all 4 positions", () => {
    const room = createTestRoom();
    const expected: Array<{ playerId: string; wind: SeatWind }> = [
      { playerId: "player-0", wind: "east" },
      { playerId: "player-1", wind: "south" },
      { playerId: "player-2", wind: "west" },
      { playerId: "player-3", wind: "north" },
    ];

    for (const exp of expected) {
      const seat = assignNextSeat(room);
      expect(seat).toEqual(exp);
      room.players.set(exp.playerId, {
        playerId: exp.playerId,
        displayName: `Player`,
        wind: exp.wind,
        isHost: false,
        connected: true,
        connectedAt: Date.now(),
      });
    }
  });

  it("returns null when room is full (4 players)", () => {
    const room = createTestRoom(["player-0", "player-1", "player-2", "player-3"]);
    const seat = assignNextSeat(room);
    expect(seat).toBeNull();
  });

  it("fills gaps when a middle seat is available", () => {
    const room = createTestRoom(["player-0", "player-2", "player-3"]);
    const seat = assignNextSeat(room);
    expect(seat).toEqual({ playerId: "player-1", wind: "south" });
  });

  it("fills gap at player-0 if missing", () => {
    const room = createTestRoom(["player-1", "player-2"]);
    const seat = assignNextSeat(room);
    expect(seat).toEqual({ playerId: "player-0", wind: "east" });
  });
});
