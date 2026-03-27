# Story 1.1: Monorepo Setup & Development Tooling

Status: done

## Story

As a **developer**,
I want **a fully configured pnpm monorepo with shared/, client/, and server/ packages, TypeScript strict mode, Vitest, and basic dev tooling**,
So that **all subsequent stories have a solid, tested project foundation to build on**.

## Acceptance Criteria

1. **Given** a fresh clone of the repository, **When** `pnpm install` is run, **Then** all three packages (shared, client, server) install successfully with no errors
2. **Given** the monorepo is set up, **When** `pnpm -r test` is run, **Then** Vitest executes in all three packages (even if only placeholder tests exist)
3. **Given** TypeScript is configured, **When** `tsc --build` is run from root, **Then** all three packages compile with `strict: true` and project references enforce that shared/ imports nothing from client/ or server/
4. **Given** the client package, **When** `pnpm dev` is run in client/, **Then** Vite 8 dev server starts and serves a placeholder page
5. **Given** the server package, **When** `pnpm dev` is run in server/, **Then** tsx starts the Fastify server with a health check endpoint responding 200
6. **Given** the project root, **When** inspecting configuration files, **Then** `.nvmrc` specifies Node 22 LTS, `pnpm-workspace.yaml` lists all three packages, and `tsconfig.base.json` contains shared strict compiler options

## Tasks / Subtasks

- [x] Task 1: Initialize root project (AC: #6)
  - [x] Create `package.json` with `"name": "mahjong-game"`, root scripts (`"test": "pnpm -r test"`, `"build": "tsc --build"`, `"lint": "pnpm -r lint"`)
  - [x] Create `.nvmrc` with `22`
  - [x] Create `pnpm-workspace.yaml` with `packages: ['packages/*']`
  - [x] Create `.gitignore` (node_modules, dist, coverage, .env.local, *.tsbuildinfo)
  - [x] Create `.env.example` with documented env vars
- [x] Task 2: Create tsconfig.base.json (AC: #3)
  - [x] Exact config from architecture:
    ```json
    {
      "compilerOptions": {
        "strict": true,
        "target": "ES2022",
        "module": "ESNext",
        "moduleResolution": "bundler",
        "esModuleInterop": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "resolveJsonModule": true,
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true
      }
    }
    ```
- [x] Task 3: Create shared/ package (AC: #1, #2, #3)
  - [x] `packages/shared/package.json` — name: `@mahjong-game/shared`, only devDependencies (vitest, typescript)
  - [x] `packages/shared/tsconfig.json` — extends `../../tsconfig.base.json`, `rootDir: "src"`, `outDir: "dist"`
  - [x] `packages/shared/vitest.config.ts` — include `src/**/*.test.ts`, configure `restoreMocks`, `clearMocks`, `unstubEnvs`, `unstubGlobals`
  - [x] `packages/shared/src/index.ts` — barrel export (initially empty or placeholder types)
  - [x] `packages/shared/src/placeholder.test.ts` — minimal passing test to verify Vitest runs
- [x] Task 4: Create client/ package (AC: #1, #2, #4)
  - [x] `packages/client/package.json` — name: `@mahjong-game/client`, deps: vue, vue-router, pinia, @vueuse/core, motion-v, @vue-dnd-kit/core; devDeps: vite, @vitejs/plugin-vue, unocss, vitest, typescript, eslint, eslint-plugin-vue (oxlint and eslint-plugin-oxlint at workspace root)
  - [x] `packages/client/tsconfig.json` — extends base, `types: ["vite/client"]`, references: `[{ "path": "../shared" }]`
  - [x] `packages/client/vite.config.ts` — Vue plugin, UnoCSS plugin
  - [x] `packages/client/vitest.config.ts` — include `src/**/*.test.ts`, same mock reset config as shared
  - [x] `packages/client/uno.config.ts` — presetWind4, transformerVariantGroup, transformerDirectives
  - [x] `packages/client/index.html` — SPA entry point
  - [x] `packages/client/src/main.ts` — createApp, import `virtual:uno.css`, install Pinia, Vue Router
  - [x] `packages/client/src/App.vue` — minimal `<script setup lang="ts">` with `<RouterView />`
  - [x] `packages/client/src/router/index.ts` — minimal router (home route only for now)
  - [x] `packages/client/src/views/HomeView.vue` — placeholder page
  - [x] `packages/client/src/env.d.ts` — Vite client types reference
  - [x] `packages/client/.env` — `VITE_WS_URL=ws://localhost:3001`
  - [x] `packages/client/src/placeholder.test.ts` — minimal passing test
  - [x] Verify `pnpm dev` starts Vite dev server on default port
- [x] Task 5: Create server/ package (AC: #1, #2, #5)
  - [x] `packages/server/package.json` — name: `@mahjong-game/server`, deps: fastify, ws, pino; devDeps: tsx, vitest, typescript, @types/ws, @types/node. Script: `"dev": "tsx watch src/index.ts"`
  - [x] `packages/server/tsconfig.json` — extends base, `types: ["node"]`, references: `[{ "path": "../shared" }]`
  - [x] `packages/server/vitest.config.ts` — include `src/**/*.test.ts`, same mock reset config
  - [x] `packages/server/src/index.ts` — Fastify server with health check `GET /health` returning 200
  - [x] `packages/server/.env` — `PORT=3001`, `LOG_LEVEL=info`
  - [x] `packages/server/src/placeholder.test.ts` — minimal passing test
  - [x] Verify `pnpm dev` starts Fastify with health check responding 200
- [x] Task 6: Shared package dependency wiring (AC: #1, #3)
  - [x] Both client and server `package.json` include `"@mahjong-game/shared": "workspace:*"` in dependencies
  - [x] Verify `pnpm install` resolves workspace links
  - [x] Verify `tsc --build` from root compiles all three packages in dependency order
  - [x] Verify project references prevent illegal cross-imports (shared cannot import from client/server)
- [x] Task 7: Final verification (AC: #1-6)
  - [x] `pnpm install` — succeeds with no errors
  - [x] `pnpm -r test` — Vitest runs in all three packages, all placeholder tests pass
  - [x] `tsc --build` — compiles with zero errors under strict mode
  - [x] `pnpm --filter @mahjong-game/client dev` — Vite dev server starts
  - [x] `pnpm --filter @mahjong-game/server dev` — Fastify starts, `curl localhost:3001/health` returns 200

## Dev Notes

### Architecture Compliance

**Package Structure** — `packages/shared/`, `packages/client/`, `packages/server/` under root. Feature-based organization within each package.

**Package Names** — Scoped: `@mahjong-game/shared`, `@mahjong-game/client`, `@mahjong-game/server`

**Workspace Protocol** — Client and server reference shared via `"@mahjong-game/shared": "workspace:*"`. Shared is consumed via source imports — no build step needed. Vite resolves workspace packages to TypeScript source directly; server runs via `tsx` which handles TypeScript transparently.

**Boundary Enforcement** — TypeScript project references prevent cross-package violations at compile time. shared/ imports nothing from client/ or server/. client/ never imports server/. server/ never imports client/.

### Technology Stack (Exact Versions)

| Layer | Library | Version Constraint |
|---|---|---|
| Runtime | Node.js | 22 LTS (pinned in `.nvmrc`) |
| Package manager | pnpm | latest (`corepack enable`) |
| Frontend | Vue 3 + TypeScript | ^3.5 |
| Build | Vite | ^8.0 |
| Client state | Pinia | ^3.0 |
| CSS | UnoCSS | ^66.0 (presetWind4) |
| Composables | VueUse | ^14.0 |
| Drag-and-drop | Vue DnD Kit | ^2.0 |
| Animation | Motion for Vue (motion-v) | ^2.0 |
| Routing | Vue Router | ^4.0 |
| HTTP server | Fastify | ^5.0 |
| WebSocket | ws | ^8.0 |
| Unit testing | Vitest | ^4.0 |
| E2E testing | Playwright | ^1.58 |
| Linting (primary) | Oxlint (all packages, workspace root) | ^1.0 |
| Linting (supplementary) | ESLint + eslint-plugin-vue (client only) | latest |

**Version Constraints:**
- `strict: true` in ALL tsconfigs — no exceptions
- Vite 8 requires Node.js 20.19+ or 22.12+ (we use 22 LTS)
- VueUse v14 requires Vue ^3.5
- Pinia v3 requires Vue 3 + TypeScript 5+
- UnoCSS presetWind4 uses Wind4 theme keys: `font` not `fontFamily`, `radius` not `borderRadius`, `shadow` not `boxShadow`, `breakpoint` not `breakpoints`

### TypeScript Configuration

**tsconfig.base.json** — shared strict compiler options (see Task 2 for exact config)

**Per-package tsconfigs:**
- `shared/tsconfig.json`: extends base, `rootDir: "src"`, `outDir: "dist"`, no references
- `client/tsconfig.json`: extends base, `types: ["vite/client"]`, references shared
- `server/tsconfig.json`: extends base, `types: ["node"]`, references shared

No `@ts-ignore` without an accompanying comment explaining why.

### Vitest Configuration

All three packages must have identical mock reset behavior:
```typescript
// vitest.config.ts (each package)
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    clearMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
})
```

Client vitest.config.ts also needs the Vue plugin for component testing (future stories).

### UnoCSS Configuration

```typescript
// packages/client/uno.config.ts
import { defineConfig, presetWind4, transformerVariantGroup, transformerDirectives } from 'unocss'

export default defineConfig({
  presets: [presetWind4()],
  transformers: [transformerVariantGroup(), transformerDirectives()],
})
```

Entry point: `import 'virtual:uno.css'` in `client/src/main.ts` (no separate reset import needed with Wind4).

### Fastify Server Setup

```typescript
// packages/server/src/index.ts
import fastify from 'fastify'

const app = fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } })

app.get('/health', async () => ({ status: 'ok' }))

const start = async () => {
  const port = Number(process.env.PORT) || 3001
  await app.listen({ port, host: '0.0.0.0' })
}
start()
```

Server runs via tsx: `"dev": "tsx watch src/index.ts"` in package.json scripts.

### Naming Conventions

| Element | Convention | Example |
|---|---|---|
| TypeScript files | kebab-case | `game-engine.ts` |
| Vue components | PascalCase | `PlayerRack.vue` |
| Composables | camelCase with `use` prefix | `useGameState.ts` |
| Pinia stores | camelCase with `use` + `Store` suffix | `usePreferencesStore` |
| Types/Interfaces | PascalCase | `GameState` |
| Constants | UPPER_SNAKE_CASE | `TILE_COUNT` |
| Test files | match source + `.test.ts` | `game-engine.test.ts` |

### Import Rules

- Between packages: import from barrel (`@mahjong-game/shared`)
- Within a package: import from specific file (`../types/game-state`), never from barrel
- Shared test utilities: `import { createTestState } from '@mahjong-game/shared/testing/helpers'`

### What NOT to Do

- Do NOT install LiveKit SDK — that's Epic 6B (cut-line)
- Do NOT create component directories yet — Story 1.7 creates the first Vue component
- Do NOT create game types/engine files — Story 1.2 and 1.3 handle those
- Do NOT set up Playwright yet — E2E testing setup comes later
- Do NOT create Pinia stores yet — they're needed in later stories
- Do NOT add `console.*` in shared/ — use injected Logger interface (but Logger interface itself is a later story)
- Do NOT configure production build optimizations — Vite 8 with Rolldown handles it automatically

### Project Structure Notes

This story creates the skeleton. Only these directories need files:
```
packages/shared/src/           # index.ts + placeholder test
packages/client/src/           # main.ts, App.vue, router, placeholder view + test
packages/server/src/           # index.ts (Fastify server) + placeholder test
```

Do NOT pre-create the full directory tree from the architecture doc. Subsequent stories create directories as needed.

### References

- [Source: game-architecture.md#Project Structure] — Full directory structure
- [Source: game-architecture.md#Core Stack] — Library versions and rationale
- [Source: game-architecture.md#TypeScript Project References] — tsconfig setup
- [Source: game-architecture.md#Workspace Configuration] — pnpm workspace setup
- [Source: game-architecture.md#Development Environment] — Setup commands and prerequisites
- [Source: game-architecture.md#Naming Conventions] — File and code naming patterns
- [Source: game-architecture.md#Architectural Boundaries] — Package boundary rules
- [Source: project-context.md#Technology Stack & Versions] — Pinned versions
- [Source: project-context.md#Testing Rules] — Vitest configuration

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6 (1M context)

### Debug Log References

- Fixed `@vitejs/plugin-vue` peer dep warning by upgrading v5 → v6 for Vite 8 compatibility
- Added `.vue` SFC type declarations in `env.d.ts` to fix `tsc --build` errors for `.vue` imports
- Added `typescript` to root devDependencies for `tsc --build` to work from project root
- Added `pnpm.onlyBuiltDependencies` for esbuild postinstall script

### Completion Notes List

- All 7 tasks completed successfully
- pnpm monorepo with 3 packages: shared, client, server
- TypeScript strict mode with project references enforcing package boundaries
- Vitest configured in all 3 packages with identical mock reset behavior
- Vite 8 dev server serving Vue 3 SPA with UnoCSS (presetWind4)
- Fastify server with `/health` endpoint returning 200
- All acceptance criteria verified and passing

### Change Log

- 2026-03-26: Story implemented — full monorepo setup with all packages, tooling, and verification
- 2026-03-26: Code review fixes — gitignore `.env` files; add error handling to server start()

### File List

- package.json (root — workspace scripts, esbuild build approval)
- .nvmrc (Node 22 LTS)
- pnpm-workspace.yaml (workspace package listing)
- tsconfig.base.json (shared strict compiler options)
- tsconfig.json (root project references)
- .gitignore (node_modules, dist, coverage, .env.local, tsbuildinfo)
- .env.example (documented env vars)
- packages/shared/package.json
- packages/shared/tsconfig.json
- packages/shared/vitest.config.ts
- packages/shared/src/index.ts
- packages/shared/src/placeholder.test.ts
- packages/client/package.json
- packages/client/tsconfig.json
- packages/client/vite.config.ts
- packages/client/vitest.config.ts
- packages/client/uno.config.ts
- packages/client/index.html
- packages/client/env.d.ts
- packages/client/.env
- packages/client/src/main.ts
- packages/client/src/App.vue
- packages/client/src/router/index.ts
- packages/client/src/views/HomeView.vue
- packages/client/src/placeholder.test.ts
- packages/server/package.json
- packages/server/tsconfig.json
- packages/server/vitest.config.ts
- packages/server/.env
- packages/server/src/index.ts
- packages/server/src/placeholder.test.ts
