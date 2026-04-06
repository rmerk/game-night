# Mahjong Game

Multiplayer mahjong game — pnpm monorepo with three packages.

## Architecture

- `packages/shared` — Game engine, card types, constants, test utilities (pure TS, no framework)
- `packages/client` — Vue 3 SPA (Composition API + `<script setup>`, Pinia stores, UnoCSS, Vue Router)
- `packages/server` — Fastify HTTP + WebSocket server (rooms, game state sync)

Shared is consumed by both client and server via `workspace:*`.

## Stack

| Layer | Tech |
|-------|------|
| Client | Vue 3, Pinia 3, Vue Router 4, UnoCSS, VueUse, motion-v, @vue-dnd-kit |
| Server | Fastify 5, ws, pino |
| Shared | Pure TypeScript |
| Tooling | Vite+ (`vp`), pnpm 10, TypeScript 5.9 |
| Testing | Vitest (via `vite-plus/test`), Vue Test Utils, happy-dom |

Voice / video uses [LiveKit](https://livekit.io/) alongside the game WebSocket. See [docs/livekit-deployment.md](docs/livekit-deployment.md) for production deployment, TURN/STUN, and environment variables.

## Commands

See AGENTS.md for full Vite+ workflow. Quick reference:

```bash
vp install              # Install deps (not pnpm install)
vp dev                  # Dev server (client)
pnpm test               # All tests across packages
vp test run             # Tests in current package
vp check                # Format + lint + typecheck
vue-tsc --noEmit        # Client typecheck
```

### Backpressure gate (before every commit)

```bash
pnpm test && pnpm run typecheck && vp lint
```

## Code Style

- Vue components: `<script setup lang="ts">` — always Composition API
- Imports from `vite-plus/test` (not `vitest`) for test utilities
- Imports from `vite-plus` (not `vite`) for config
- Use `vp` CLI, never pnpm/npm/yarn directly for tooling
- UnoCSS for styling (utility-first)
- Conventional Commits for git messages

## Gotchas

- **No import aliases** — no `@/` path mappings; use relative imports or `@mahjong-game/shared`
- **GameState mutates in-place** — action handlers mutate directly, they don't return new state
- **Tile IDs are unique strings** — format: `suit-value-copy` (e.g., `bam-3-2`). Copy number (1–4) differentiates identical tiles
- **DnD provider context** — `useDnDProvider()` uses `inject()`, so it must be called in a child of `DnDProvider`, not in the same component. TileRack uses a renderless `RackDnDSetup` child component for this reason
- **Seat order is counterclockwise** — SEATS array: east → south → west → north
- **UnoCSS config imports from src/** — `uno.config.ts` imports design tokens from `src/styles/design-tokens.ts` at build time
- **happy-dom for client tests** — not jsdom
- **Resolved-action toasts** — `HOST_PROMOTED`, `ROOM_SETTINGS_CHANGED`, and `REMATCH_WAITING_FOR_PLAYERS` use shared copy in `packages/client/src/composables/resolvedActionToastCopy.ts`. Wire them with one `watch` on `resolvedAction` and a `switch` on `ra.type`; `GameTable` handles in-table phases, `RoomView` gates with lobby-only (`lobbyState !== null && playerGameView === null`). Add new toast copy there instead of duplicating strings.

## Testing

- Test files co-located with source: `*.test.ts` next to `*.ts`
- Shared test utilities in `packages/shared/src/testing/`:
  - `fixtures.ts` — `createLobbyFixture()`, `createPlayState()` (deterministic seed 42)
  - `tile-builders.ts` — `suitedTile()`, `windTile()`, `dragonTile()`, `flowerTile()`, `jokerTile()`
  - `helpers.ts` — `createTestState()`, `injectTilesIntoRack()`, `getNonDiscarders()`
- Client tests: mock `@vue-dnd-kit/core` and call `setActivePinia(createPinia())` in `beforeEach`

## Cross-Session Memory (claude-mem)

Claude-mem passively records observations from every tool execution to `~/.claude-mem/claude-mem.db`. A UserPromptSubmit hook in `.claude/settings.json` automatically injects recent memory context before GDS skill invocations (`create-story`, `dev-story`, `code-review`, `retrospective`). Session start context is handled by claude-mem's built-in SessionStart hook.

### How to use `mem-search`

When hooks inject memory context (or when you need deeper history), use `mem-search` with the 3-layer workflow (`search` → `timeline` → `get_observations`). Always use the `project` parameter to scope results.

- **Code review nuance:** A past reference provides *context*, not automatic justification — still flag issues if warranted
- **End of epic:** Use `claude-mem:timeline-report` to generate a narrative. Save to `_bmad-output/implementation-artifacts/epic-{N}-timeline.md` and reference during `gds-retrospective`

## Code Navigation (claude-mem tools)

- Prefer `smart_outline` over reading full files when understanding code structure (signatures, types, exports). Use full file reads only when editing or when the structural view is insufficient
- Use `smart_search` to find symbols, functions, and classes across the codebase with folded structural views — more token-efficient than grep for understanding how code fits together

## Key Files

- `vite.config.ts` — Root config with lint rules and staged file checks
- `packages/client/src/main.ts` — Client entry
- `packages/server/src/index.ts` — Server entry
- `packages/shared/src/index.ts` — Shared barrel export
- `packages/client/src/styles/design-tokens.ts` — Design system tokens
- `packages/client/src/components/dev/` — Dev-only showcase components (routes at `/dev/*`, gated by `import.meta.env.DEV`)
