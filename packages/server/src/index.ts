import fastify from "fastify";

const app = fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });

app.get("/health", async () => ({ status: "ok" }));

const start = async () => {
  const port = Number(process.env.PORT) || 3001;
  await app.listen({ port, host: "0.0.0.0" });
};
start().catch((err) => {
  // oxlint-disable-next-line no-console -- crash handler before logger is available
  console.error(err);
  process.exit(1);
});
