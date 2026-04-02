import { describe, expect, it } from "vite-plus/test";
import { createApp } from "../index";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROOM_CODE_REGEX = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

function buildApp() {
  return createApp();
}

describe("GET /health", () => {
  it("returns 200 with ok status", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });
});

describe("POST /api/rooms", () => {
  it("creates a room with valid hostName and returns 201", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { hostName: "TestHost" },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.roomId).toMatch(UUID_REGEX);
    expect(body.roomCode).toMatch(ROOM_CODE_REGEX);
    expect(body.hostToken).toMatch(UUID_REGEX);
    expect(body.hostName).toBe("TestHost");
    expect(body.roomUrl).toContain(`/room/${body.roomCode}`);
  });

  it("returns 400 when hostName is missing", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "INVALID_HOST_NAME" });
  });

  it("returns 400 when hostName is empty string", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { hostName: "" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "INVALID_HOST_NAME" });
  });

  it("returns 400 when hostName is not a string", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { hostName: 12345 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "INVALID_HOST_NAME" });
  });

  it("truncates hostName longer than 30 characters", async () => {
    const app = buildApp();
    const longName = "A".repeat(50);
    const response = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { hostName: longName },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().hostName).toBe("A".repeat(30));
  });

  it("strips control characters from hostName", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { hostName: "Test\x00Host\x1F" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().hostName).toBe("TestHost");
  });

  it("returns 400 when hostName is only whitespace", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { hostName: "   " },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "INVALID_HOST_NAME" });
  });
});

describe("GET /api/rooms/:code/status", () => {
  it("returns status for an existing room", async () => {
    const app = buildApp();

    // Create a room first
    const createResponse = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { hostName: "TestHost" },
    });
    const { roomCode } = createResponse.json();

    const response = await app.inject({
      method: "GET",
      url: `/api/rooms/${roomCode}/status`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      full: false,
      playerCount: 0,
      phase: "lobby",
    });
  });

  it("returns 404 for unknown room code", async () => {
    const app = buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/rooms/ZZZZZZ/status",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "ROOM_NOT_FOUND" });
  });

  it("performs case-insensitive lookup", async () => {
    const app = buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { hostName: "TestHost" },
    });
    const { roomCode } = createResponse.json();

    const response = await app.inject({
      method: "GET",
      url: `/api/rooms/${roomCode.toLowerCase()}/status`,
    });

    expect(response.statusCode).toBe(200);
  });
});

describe("rate limiting", () => {
  it("rejects room creation after exceeding rate limit", async () => {
    const app = buildApp();
    await app.ready();

    // Send 11 requests sequentially (limit is 10 per minute). Parallel injects would not hit the limiter correctly.
    const responses = await Array.from({ length: 11 }, (_, i) => i).reduce(
      async (accPromise, i) => {
        const acc = await accPromise;
        const res = await app.inject({
          method: "POST",
          url: "/api/rooms",
          payload: { hostName: `Host${i}` },
        });
        acc.push(res);
        return acc;
      },
      Promise.resolve([] as Awaited<ReturnType<typeof app.inject>>[]),
    );

    // First 10 should succeed
    for (let i = 0; i < 10; i++) {
      expect(responses[i].statusCode).toBe(201);
    }

    // 11th should be rate limited
    expect(responses[10].statusCode).toBe(429);

    await app.close();
  });

  it("does not rate limit health checks", async () => {
    const app = buildApp();
    await app.ready();

    const healthResponses = await Promise.all(
      Array.from({ length: 20 }, () => app.inject({ method: "GET", url: "/health" })),
    );
    for (const res of healthResponses) {
      expect(res.statusCode).toBe(200);
    }

    await app.close();
  });
});

describe("Integration: full room flow", () => {
  it("creates a room and retrieves its status", async () => {
    const app = buildApp();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/rooms",
      payload: { hostName: "Rchoi" },
    });
    expect(createResponse.statusCode).toBe(201);

    const { roomCode } = createResponse.json();

    const statusResponse = await app.inject({
      method: "GET",
      url: `/api/rooms/${roomCode}/status`,
    });
    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json().phase).toBe("lobby");
  });

  it("generates unique room codes across multiple creations", async () => {
    const app = buildApp();

    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        app.inject({
          method: "POST",
          url: "/api/rooms",
          payload: { hostName: `Host${i}` },
        }),
      ),
    );

    const codes = new Set(
      responses.map((r) => {
        const body: { roomCode: string } = r.json();
        return body.roomCode;
      }),
    );
    expect(codes.size).toBe(10);
  });
});
