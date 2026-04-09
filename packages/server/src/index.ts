import fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { RoomManager } from "./rooms/room-manager";
import { validateLiveKitEnvOnBoot } from "./config/livekit";
import { roomRoutes } from "./http/routes";
import { setupWebSocketServer, type WsServerContext } from "./websocket/ws-server";

declare module "fastify" {
  interface FastifyInstance {
    wsContext?: WsServerContext;
    roomManager: RoomManager;
  }
}

/** Dev: reflect request Origin. Prod: `CORS_ORIGIN` (comma-separated) or `new URL(BASE_URL).origin`. */
function resolveCorsOrigin(): boolean | string | string[] {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (raw) {
    const list = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return list.length === 1 ? list[0] : list;
  }
  if (process.env.NODE_ENV === "production") {
    const base = process.env.BASE_URL || "http://localhost:5173";
    try {
      return new URL(base).origin;
    } catch {
      return [];
    }
  }
  return true;
}

export function createApp(): FastifyInstance {
  const app = fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });
  const roomManager = new RoomManager();

  app.register(cors, {
    origin: resolveCorsOrigin(),
    methods: ["GET", "POST", "OPTIONS"],
  });

  app.register(rateLimit, {
    max: 10,
    timeWindow: "1 minute",
    allowList: (req) => req.url === "/health",
  });

  app.decorate("roomManager", roomManager);
  app.register(roomRoutes, { roomManager });

  app.addHook("onReady", async () => {
    validateLiveKitEnvOnBoot(app.log);
    app.wsContext = setupWebSocketServer(app, roomManager);
  });

  return app;
}

if (!process.env.VITEST) {
  const app = createApp();
  const port = Number(process.env.PORT) || 3001;
  app.listen({ port, host: "0.0.0.0" }).catch((err) => {
    // oxlint-disable-next-line no-console -- crash handler before logger is available
    console.error(err);
    process.exit(1);
  });
}
