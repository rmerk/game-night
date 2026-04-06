import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { WebSocket } from "ws";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import {
  createSilentTestLogger,
  createMockWs,
  createTestPlayer,
  createTestRoomWithSessions,
} from "../testing";
import { handleLiveKitTokenRequest } from "./livekit-handler";

vi.mock("livekit-server-sdk", () => ({
  AccessToken: class {
    addGrant(): void {}
    async toJwt(): Promise<string> {
      return "mock.jwt.token";
    }
  },
}));

describe("handleLiveKitTokenRequest", () => {
  const logger = createSilentTestLogger();

  beforeEach(() => {
    process.env.LIVEKIT_URL = "wss://example.livekit.cloud";
    process.env.LIVEKIT_API_KEY = "test-key";
    process.env.LIVEKIT_API_SECRET = "test-secret";
  });

  afterEach(() => {
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;
  });

  it("sends LIVEKIT_TOKEN with JWT and URL for a seated player", async () => {
    const ws = createMockWs() as WebSocket & { sent: string[] };
    const sent: string[] = [];
    (ws as unknown as { send: (data: string) => void }).send = vi.fn((data: string) => {
      sent.push(data);
    });

    const player = createTestPlayer("player-0", "east", true);
    const room = createTestRoomWithSessions([player], [ws], {
      roomCode: "ABC123",
      logger,
    });

    await handleLiveKitTokenRequest(
      ws,
      { version: PROTOCOL_VERSION, type: "REQUEST_LIVEKIT_TOKEN" },
      room,
      "player-0",
      logger,
    );

    expect(sent).toHaveLength(1);
    const msg = JSON.parse(sent[0]) as Record<string, unknown>;
    expect(msg.type).toBe("LIVEKIT_TOKEN");
    expect(msg.token).toBe("mock.jwt.token");
    expect(msg.url).toBe("wss://example.livekit.cloud");
  });

  it("sends ERROR for a departed / spectator-equivalent player", async () => {
    const ws = createMockWs() as WebSocket & { sent: string[] };
    const sent: string[] = [];
    (ws as unknown as { send: (data: string) => void }).send = vi.fn((data: string) => {
      sent.push(data);
    });

    const player = createTestPlayer("player-0", "east", true);
    const room = createTestRoomWithSessions([player], [ws], {
      roomCode: "ABC123",
      logger,
    });
    room.seatStatus.departedPlayerIds.add("player-0");

    await handleLiveKitTokenRequest(
      ws,
      { version: PROTOCOL_VERSION, type: "REQUEST_LIVEKIT_TOKEN" },
      room,
      "player-0",
      logger,
    );

    expect(sent).toHaveLength(1);
    const msg = JSON.parse(sent[0]) as Record<string, unknown>;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("LIVEKIT_NOT_ELIGIBLE");
  });

  it("sends ERROR when LiveKit env is not configured", async () => {
    delete process.env.LIVEKIT_URL;
    delete process.env.LIVEKIT_API_KEY;
    delete process.env.LIVEKIT_API_SECRET;

    const ws = createMockWs() as WebSocket & { sent: string[] };
    const sent: string[] = [];
    (ws as unknown as { send: (data: string) => void }).send = vi.fn((data: string) => {
      sent.push(data);
    });

    const player = createTestPlayer("player-0", "east", true);
    const room = createTestRoomWithSessions([player], [ws], {
      roomCode: "ABC123",
      logger,
    });

    await handleLiveKitTokenRequest(
      ws,
      { version: PROTOCOL_VERSION, type: "REQUEST_LIVEKIT_TOKEN" },
      room,
      "player-0",
      logger,
    );

    expect(sent).toHaveLength(1);
    const msg = JSON.parse(sent[0]) as Record<string, unknown>;
    expect(msg.type).toBe("ERROR");
    expect(msg.code).toBe("LIVEKIT_UNAVAILABLE");
  });
});
