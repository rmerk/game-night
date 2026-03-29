import fastify, { type FastifyInstance } from "fastify";
import { RoomManager } from "./rooms/room-manager";
import { roomRoutes } from "./http/routes";
import { setupWebSocketServer, type WsServerContext } from "./websocket/ws-server";

declare module "fastify" {
  interface FastifyInstance {
    wsContext?: WsServerContext;
  }
}

export function createApp(): FastifyInstance {
  const app = fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });
  const roomManager = new RoomManager();

  app.register(roomRoutes, { roomManager });

  app.addHook("onReady", async () => {
    app.wsContext = setupWebSocketServer(app);
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
