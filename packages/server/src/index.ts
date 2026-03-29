import fastify, { type FastifyInstance } from "fastify";
import { RoomManager } from "./rooms/room-manager";
import { roomRoutes } from "./http/routes";

export function createApp(): FastifyInstance {
  const app = fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });
  const roomManager = new RoomManager();

  app.register(roomRoutes, { roomManager });

  return app;
}

const start = async () => {
  const app = createApp();
  const port = Number(process.env.PORT) || 3001;
  await app.listen({ port, host: "0.0.0.0" });
};
start().catch((err) => {
  // oxlint-disable-next-line no-console -- crash handler before logger is available
  console.error(err);
  process.exit(1);
});
