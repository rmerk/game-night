# Mahjong Night

Multiplayer mahjong in a **pnpm** monorepo: shared game logic, a Vue 3 client, and a Fastify + WebSocket server.

## Repository layout

| Package | Role |
|--------|------|
| [`packages/shared`](packages/shared) | Game engine, types, constants, test utilities (pure TypeScript) |
| [`packages/client`](packages/client) | Vue 3 SPA — Pinia, Vue Router, UnoCSS, drag-and-drop |
| [`packages/server`](packages/server) | Fastify HTTP API, WebSocket sync, rooms |

Both client and server depend on `@mahjong-game/shared` via `workspace:*`.

Voice and video (WebRTC) use [LiveKit](https://livekit.io/) alongside the game WebSocket; see [docs/livekit-deployment.md](docs/livekit-deployment.md) for environment variables, TURN/STUN, and production deployment.

## Prerequisites

- **Node.js 22** (see [`.nvmrc`](.nvmrc))
- **pnpm 10** (see root [`package.json`](package.json) `packageManager`)
- **[Vite+](https://github.com/voidzero-dev/vite-plus)** CLI (`vp`) installed globally — used for install, dev server, lint, format, and tests in this repo (see [AGENTS.md](AGENTS.md))

## Getting started

From the repository root:

```bash
vp install
```

**Client** (Vite dev server; default port is usually `5173`):

```bash
pnpm --filter @mahjong-game/client dev
# or: cd packages/client && vp dev
```

**Server** (listens on `PORT`, default **3001**):

```bash
pnpm --filter @mahjong-game/server dev
# or: cd packages/server && vp run dev
```

Set `PORT` when you need a different port, for example:

```bash
PORT=4000 pnpm --filter @mahjong-game/server dev
```

The browser client calls the API on a different origin than Vite in dev; the server sends CORS headers automatically. In **production** (`NODE_ENV=production`), allowed origins default to `BASE_URL`’s origin (same as room share links). Override with comma-separated **`CORS_ORIGIN`** (e.g. `https://app.example.com,https://www.example.com`) if the SPA is served from a different origin than `BASE_URL`.

## Common commands

| Command | What it does |
|---------|----------------|
| `pnpm test` | Run tests in all packages |
| `pnpm run typecheck` | TypeScript project build + per-package typecheck where defined |
| `pnpm run build` | `tsc --build` (root) |
| `pnpm run lint` | Lint all packages (`pnpm -r lint`) |

In a single package (from that package’s directory):

```bash
vp test run      # tests for current package
vp check         # format + lint + typecheck (where configured)
```

Examples with filters:

```bash
pnpm --filter @mahjong-game/shared test
pnpm --filter @mahjong-game/client exec vue-tsc --noEmit
```

## Pre-commit check

Before committing, the project expects:

```bash
pnpm test && pnpm run typecheck && vp lint
```

## Development-only UI

With `import.meta.env.DEV`, the client exposes showcase and harness routes under `/dev/*` (for example `/dev/harness`, `/dev/tiles`). See [`packages/client/src/router/index.ts`](packages/client/src/router/index.ts).

## Further reading

- **[AGENTS.md](AGENTS.md)** — Vite+ workflow, `vp` vs package manager, CI hints
- **[CLAUDE.md](CLAUDE.md)** — Stack details, testing layout, import and game-state conventions
