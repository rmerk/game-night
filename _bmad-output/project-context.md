---
project_name: 'mahjong-game'
user_name: 'Rchoi'
date: '2026-03-26'
sections_completed:
  ['technology_stack', 'critical_rules', 'performance_rules', 'organization_rules', 'testing_rules', 'platform_rules', 'anti_patterns']
status: 'complete'
rule_count: 85
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing game code for Mahjong Night. Focus on unobvious details that agents might otherwise miss. Read the full architecture document (`_bmad-output/game-architecture.md`) for complete context._

---

## Technology Stack & Versions

**Runtime:** Node.js 22 LTS (pinned in `.nvmrc`)
**Package Manager:** pnpm (workspace monorepo)
**Monorepo:** `@mahjong-game/shared`, `@mahjong-game/client`, `@mahjong-game/server`

### Client
- Vue 3 v3.5.31 + TypeScript (Composition API, `<script setup>` only)
- Vite v8.0.2 (Rolldown bundler)
- Pinia v3.0.4 (client-only UI state — NOT game state)
- UnoCSS v66.6.7 (presetWind4) + CSS custom properties
- VueUse v14.2.1
- Vue DnD Kit v2.2.0 (`@vue-dnd-kit/core`)
- Motion for Vue v2.1.0 (`motion-v`)
- Vue Router (minimal — `/room/:code` only)

### Server
- Fastify v5.8.2
- ws v8.20.0
- Pino v9.x (Fastify-native logger)
- tsx (dev runtime — runs TypeScript directly, no build step)

### Shared
- Pure TypeScript, zero runtime dependencies
- Consumed via source imports (no build step)

### Testing
- Vitest v4.1.1 (unit/component, co-located `.test.ts` files)
- Playwright v1.58.2 (E2E in `client/e2e/`)
- CI command: `pnpm -r test` (runs all three packages)

### Linting
- Oxlint v1.x (primary)
- ESLint + eslint-plugin-vue (supplementary for template rules until Oxlint Q2 2026)

### Cut-line (Epic 6B)
- LiveKit v2.18.0 (`livekit-client`)

### Version Constraints
- `strict: true` in all tsconfigs — no exceptions
- Vite 8 requires Node.js 20.19+ or 22.12+ (we use 22 LTS)
- VueUse v14 requires Vue v3.5+
- Pinia v3 requires Vue 3 only + TypeScript 5+

---

## Critical Implementation Rules

### Top 5 Most Common Mistakes
1. **Optimistic updates** — Moving tiles before server confirms. See: Server Authority.
2. **`v-html` with user content** — XSS vector. See: Input Sanitization.
3. **Game logic in client/** — If both client and server need it, it belongs in shared/. See: shared/ Package Rules.
4. **Deep-mutating game state** — `Readonly<Ref>` is type-level only. See: State Access.
5. **Tile references by array index** — Indices shift on sort/call/discard. Use tile IDs. See: Tile References.

### Server Authority — No Exceptions
- The server validates ALL game actions. Clients submit actions, server validates, server broadcasts new state.
- **No optimistic updates.** Client renders ONLY from `STATE_UPDATE` messages. When a player clicks "Discard," the tile does not move until the server confirms. `Readonly<Ref>` on `useGameState` enforces this at the type level.
- Game state in `shared/` is mutated ONLY by action handlers on the server. Client never mutates game state.

### Validate-Then-Mutate (Action Handlers)
- Every action handler: validate (read-only) → mutate (only if valid) → log → return `ActionResult`
- If validation fails, return `{ accepted: false, reason }` — zero mutations applied
- Never throw exceptions for game rule violations. Exceptions = bugs. Rule violations = result objects.

### State Access — Three Tiers, Never Mixed
- **Game state:** `inject(gameStateKey)` — provided once by `RoomView`, injected by descendants. Comes from server via `useGameState` composable.
- **Component data:** Props from parent (which tile, which player)
- **Client-local state:** Pinia stores directly (`usePreferencesStore`, `useRackStore`, `useAudioStore`, `useChatStore`, `useConnectionStore`, `useHandGuidanceStore`)
- **Never** access game state via Pinia. **Never** access Pinia state via inject. **Never** import WebSocket APIs in components.
- `Readonly<Ref>` is type-level enforcement only — not a runtime freeze. Never attempt to mutate any property of the game state object, even nested ones. The server is the only source of truth.

### shared/ Package Rules
- Zero runtime dependencies. Only `devDependencies`.
- No `console.*` — use injected `Logger` interface
- No browser APIs (`window`, `document`, `localStorage`)
- No Node.js APIs (`fs`, `process`, `Buffer`)
- Import types from specific files, not barrels (within the package)
- All game logic lives here — if both client and server need it, it belongs in shared/

### Vue Component Rules
- Always `<script setup lang="ts">` — no Options API, no `<script>` without setup
- Props typed via `defineProps<{}>()` — no runtime prop validation
- Section order: imports, props/emits, inject, composables/stores, computed, methods
- Keep components under 150 lines. Extract child components or composables if exceeding.
- UnoCSS utility classes preferred over scoped styles

### Tile References
- Always reference tiles by ID (`bam-3-2`), never by array index
- Tile IDs are stable for the duration of a game; array indices shift on sort, call, and discard
- The pattern matching engine, Joker exchange, and all UI components use tile IDs

### WebSocket Protocol
- JSON over WebSocket. Version field in every message.
- Three client message types: `ACTION`, `CHAT`, `REACTION`
- Chat is a SEPARATE channel from game state — never embedded in `STATE_UPDATE`
- Reactions are fire-and-forget — no storage, no replay on reconnect
- Chat history: server retains last 200 messages, sent once on connect/reconnect
- Errors sent ONLY to the offending client — never broadcast

### Input Sanitization
- All user strings via Vue `{{ }}` interpolation — **never `v-html`**
- Chat messages: server caps at 500 chars, strips control characters
- Display names: server caps at 30 chars, strips control characters
- Reactions: must match predefined emoji allowlist
- **No DOMPurify needed for MVP.** All user content is plain text rendered via `{{ }}`. If rich text or markdown rendering is added later, add DOMPurify at that point.

### Information Boundary
- Clients receive ONLY their own rack + publicly visible state
- Opponent rack data is NEVER transmitted
- `buildPlayerView(state, playerId)` filters before every broadcast
- The ONLY exception: `GET /api/debug/rooms/:code` (dev only, disabled in production)

### Session Identity
- Server-generated UUID in `sessionStorage` (not `localStorage`)
- Tab-scoped: refresh preserves, tab close clears
- One active connection per token — second connection disconnects the first
- Token sent on every WebSocket connect for reconnection

---

## Performance Rules

### Frame Budget
- Target: 60fps for all animations (16.6ms per frame)
- Floor: 30fps on low-end mobile with WebRTC active
- Below 30fps is a bug — file and fix as P1
- This is SVG/CSS rendering, not GPU-intensive — performance issues are likely DOM thrashing or excessive re-renders, not rendering complexity

### Bundle Size
- Total budget: <5MB (excluding LiveKit WebRTC SDK)
- SVG tile sprite: ~200KB
- Audio assets: ~500KB
- App JS/CSS: remainder (~4MB budget)
- Before adding any new dependency, check its bundle size. No single dependency should exceed 50KB gzipped without explicit justification.

### Load Times
- Initial load: <3s broadband, <5s 3G
- Room join to first interaction: <2s after page load
- First-visit entrance animation (2s felt fade-in) covers the initial load naturally
- Subsequent visits: near-instant with cached assets
- Vite 8's Rolldown handles code splitting automatically — don't manually configure chunks unless profiling shows a need

### Hand Guidance Computation
- Runs client-side on every draw/discard — must complete in <100ms
- Full recompute every time — no incremental caching
- Phase 1 filtering eliminates 80-90% of hands cheaply before expensive pattern matching
- If performance degrades, optimize Phase 1 filtering first — don't add caching

### WebSocket State Updates
- Full game state (~10-15KB JSON) broadcast to each client on every action
- At one update every few seconds with 4-5 recipients, this is trivial bandwidth
- `JSON.stringify` on 15KB objects is microseconds — don't pre-optimize serialization
- If profiling shows a bottleneck, the issue is likely in `buildPlayerView` filtering, not serialization

### Vue Reactivity
- `useGameState` replaces the entire state ref on each `STATE_UPDATE` — this triggers re-renders in all watching components
- Use `computed` properties to derive slices of state — components only re-render when their specific slice changes
- Never deep-watch the entire game state (`watch(gameState, ..., { deep: true })`) — use specific computed refs instead
- Motion for Vue animations are hardware-accelerated — they don't compete with Vue's render cycle

### What NOT to Optimize
- Don't object-pool tiles — there are only 152 and they're DOM elements, not canvas sprites
- Don't lazy-load the SVG sprite — it's ~200KB and should be cached on first load
- Don't debounce `STATE_UPDATE` processing — updates are infrequent (seconds apart) and must be applied immediately
- Don't web-worker the pattern matching engine — sub-millisecond computation doesn't justify the message-passing overhead
- Don't compress WebSocket messages — JSON payloads are small, compression adds latency
- Don't manually configure Vite code splitting — Rolldown handles it automatically

---

## Code Organization Rules

### Package Boundaries (The One Rule That Matters Most)
- `shared/` → imported by client/ and server/. Pure TypeScript. Zero runtime deps.
- `client/` → imports shared/. Never imports server/.
- `server/` → imports shared/. Never imports client/.
- TypeScript project references enforce this at compile time. If it compiles, the boundary is intact.

### Where Does This Code Go?
- "Does both client and server need this?" → `shared/`
- "Is this a game rule or game state mutation?" → `shared/engine/`
- "Is this NMJL card logic?" → `shared/card/`
- "Is this a Vue component?" → `client/components/{feature}/`
- "Is this client-only reactive state?" → `client/stores/`
- "Is this a WebSocket/HTTP handler?" → `server/websocket/` or `server/http/`
- "Is this room lifecycle?" → `server/rooms/`
- "Is this a test helper?" → `shared/testing/`

### Import Rules
- Between packages: import from the barrel (`@mahjong-game/shared`)
- Within a package: import from the specific file (`../types/game-state`), never from barrel
- Shared test utilities: `import { createTestState } from '@mahjong-game/shared/testing/helpers'`

### File Creation Checklist
When creating any new `.ts` file in shared/ or server/:
1. Create the file
2. Create `{filename}.test.ts` next to it
3. Write at least one test before the implementation is complete

When creating any new `.vue` file:
1. Create the component
2. If it has logic beyond template binding, create `{ComponentName}.test.ts` next to it
3. If it's over 150 lines, split before committing

### CSS Rules
- **Preset:** `presetWind4` (Tailwind v4 compatible) — modern CSS features, OKLCH colors, auto-generated theme CSS variables, built-in reset.
- **Transformers:** `transformerVariantGroup` for grouped variants (`hover:(bg-red text-white)`), `transformerDirectives` for `@apply` in scoped styles.
- UnoCSS utility classes for layout, spacing, sizing, display — in the template
- **UnoCSS shortcuts** in `uno.config.ts` for repeated patterns (button styles, card containers, tile wrappers). Don't duplicate utility combinations across components — extract to a shortcut.
- **Theme colors** registered in `uno.config.ts` theme. Wind4 auto-generates CSS variables (`--colors-felt-teal`), so define colors in the UnoCSS theme config — not in a separate `theme.css`. Use `bg-felt-teal` in templates.
- **Wind4 theme keys** differ from Wind3: `font` not `fontFamily`, `radius` not `borderRadius`, `shadow` not `boxShadow`, `breakpoint` not `breakpoints`. See preset-wind4 docs for full mapping.
- Scoped `<style>` only when a component needs complex selectors that utility classes can't express (rare). Use `@apply` via transformer-directives if combining utilities in scoped styles.
- **Never hardcode color values in components** — always reference UnoCSS theme
- Entry point: `import 'virtual:uno.css'` in `client/src/main.ts` (no separate reset import needed with Wind4)

### Environment Variables
- Client: `VITE_` prefix required (e.g., `VITE_WS_URL`). Anything without prefix is invisible to the browser.
- Server: No prefix (e.g., `PORT`, `LOG_LEVEL`, `DEBUG_ENDPOINTS`). Never use `VITE_` for server-only values.
- Never commit `.env.local` files. `.env` files with defaults are committed. `.env.local` overrides are gitignored.

---

## Testing Rules

### Test Structure
- Co-located: `foo.ts` → `foo.test.ts` in the same directory
- E2E exception: `client/e2e/*.spec.ts` (Playwright, separate from Vitest)
- CI command: `pnpm -r test` runs all three packages
- Install `@pinia/testing` as a dev dependency in client/

### Vitest Configuration

**Auto-reset mocks in all three vitest configs:**
```typescript
// vitest.config.ts (each package)
defineConfig({
  test: {
    restoreMocks: true,
    clearMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
})
```

### What to Test, by Package

**shared/ (most critical):**
- Every action handler: valid action → correct state mutation, invalid action → rejection with zero mutations
- Pattern matching engine: ALL 50+ NMJL card hands, Joker substitution at every eligible position, concealed/exposed validation
- Card data integrity: all hands parseable, no duplicates, valid group sizes, Joker eligibility consistent
- Wall generation: correct tile count (152), correct distribution, shuffle randomness with seeded PRNG
- Scoring: payment calculations for discard Mahjong, self-drawn Mahjong, wall game

**server/:**
- Message handler: valid messages dispatched correctly, malformed messages dropped, invalid sessions rejected
- State broadcaster: player view hides opponent racks, spectator view hides all racks
- Room lifecycle: creation, join, seat assignment, cleanup triggers
- Input sanitization: chat length caps, control character stripping, emoji allowlist
- Use `vi.useFakeTimers()` for call window and grace period timer tests

**client/:**
- Composables with lifecycle hooks or inject: use `withSetup` helper pattern
- Components: blackbox approach — test behavior (user interactions, rendered output, emitted events), not implementation details
- Pinia stores: use `setActivePinia(createPinia())` in `beforeEach` for store unit tests
- Don't test pure template rendering — if a component just maps props to template, skip the test

### Testing Patterns

**Blackbox component testing — test behavior, not implementation:**
```typescript
// CORRECT: Test what the user sees and does
test('call buttons appear during call window', async () => {
  const wrapper = mount(CallButtons, {
    props: { callWindow: { status: 'open', validCalls: ['pung', 'kong'] } },
    global: { plugins: [createTestingPinia({ createSpy: vi.fn })] }
  })

  expect(wrapper.find('[data-testid="call-pung"]').exists()).toBe(true)
  await wrapper.find('[data-testid="call-pung"]').trigger('click')
  expect(wrapper.emitted('call')).toBeTruthy()
})

// WRONG: Don't test component internals
// expect(wrapper.vm.isCallWindowOpen).toBe(true)  // Never do this
```

**Pinia store testing in components — use createTestingPinia:**
```typescript
import { createTestingPinia } from '@pinia/testing'

const wrapper = mount(SettingsPanel, {
  global: {
    plugins: [
      createTestingPinia({
        createSpy: vi.fn,
        initialState: { preferences: { fontSize: 'large', darkMode: 'auto' } }
      })
    ]
  }
})
```

**Pinia store unit testing — setActivePinia:**
```typescript
import { setActivePinia, createPinia } from 'pinia'

beforeEach(() => { setActivePinia(createPinia()) })

test('defaults to auto dark mode', () => {
  const store = usePreferencesStore()
  expect(store.darkMode).toBe('auto')
})
```

**Composable testing — withSetup helper for inject/lifecycle:**
```typescript
import { withSetup } from '@mahjong-game/shared/testing/helpers'

test('useHandGuidance recomputes on state change', async () => {
  const [result, app] = withSetup(
    () => useHandGuidance(),
    { provide: { [gameStateKey]: mockGameState } }
  )
  // assertions...
  app.unmount() // Always clean up
})
```

**Async testing — always await triggers and use flushPromises:**
```typescript
import { flushPromises } from '@vue/test-utils'

await wrapper.find('[data-testid="discard-confirm"]').trigger('click')
await flushPromises() // Wait for WebSocket response simulation
expect(wrapper.find('[data-testid="call-window"]').exists()).toBe(true)
```

**Timer testing:**
```typescript
beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

test('call window expires', () => {
  const onExpire = vi.fn()
  timer.start(5000, onExpire)
  vi.advanceTimersByTime(5000)
  expect(onExpire).toHaveBeenCalledOnce()
})
```

### What NOT to Test
- Don't mock the game engine in server tests — use the real engine with test state fixtures
- Don't test Vue component internals (`wrapper.vm.*`) — blackbox only
- Don't use snapshot tests as the only assertion — always pair with behavioral assertions
- Don't test VueUse composables — they're already tested upstream
- Don't test Pinia store getters that are trivial computed properties
- Don't write E2E tests for every interaction — focus on full game flows (join → play → Mahjong → rematch)
- Don't chain multiple `nextTick` calls — use `flushPromises` instead

---

## Platform & Build Rules

### Target Browsers
- Chrome, Firefox, Safari, Edge — latest two versions
- iOS Safari 16+, Android Chrome
- No polyfills for legacy browsers — this covers 95%+ of the target audience

### Mobile-Specific
- Minimum tap targets: 44px (WCAG)
- Account for mobile browser chrome (safe area insets via `env(safe-area-inset-*)`)
- Landscape recommended, portrait supported with adapted layout
- Graceful mic/camera permission prompts — guide the user, don't assume permission granted

### Device Testing
- **Layout/viewport:** Playwright device emulation is sufficient for responsive testing
- **WebRTC (LiveKit):** MUST test on real physical iOS and Android devices — emulators can't test mic/camera permission flows or actual audio/video quality
- Don't leave mobile testing for the end — test on real devices from Epic 5A onward

### Accessibility (Non-Negotiable)
- Semantic HTML from day one — not retrofitted
- ARIA labels on all interactive elements
- Keyboard navigation: Tab cycles zones, Arrow keys within zones, Enter confirms, Escape exits focus
- `prefers-reduced-motion`: Motion for Vue handles this natively — verify it's working, don't add manual checks
- `prefers-color-scheme`: Auto dark mode via UnoCSS `dark:` variant + manual override in settings
- High contrast and color-blind support deferred to Epic 8, but don't make design choices that block them (e.g., never rely on color alone to distinguish tile suits)

### Build Artifacts
Two separate deployables — never bundled together:
- **Client:** Static bundle (HTML/CSS/JS/SVG/audio) → deployable to any static host or CDN. `VITE_WS_URL` env var points to the server's WebSocket endpoint.
- **Server:** Node.js process (Fastify + ws) → deployable to any Node.js host (VPS, container, PaaS). Requires persistent processes — no serverless.

### Build & Deploy
- Vite 8 with Rolldown handles bundling — don't configure manually unless profiling shows a need
- `import.meta.env.DEV` gates all debug features — Vite tree-shakes them from production
- No source maps in production builds (default Vite behavior)

---

## Critical Don't-Miss Rules

### Anti-Patterns — Never Do These
- **Never import from server/ in client/ or vice versa.** TypeScript project references block this at compile time, but an agent might try to work around it. The shared/ package is the only bridge.
- **Never store game state in Pinia.** Game state comes from the server via `useGameState` composable and provide/inject. Pinia is exclusively for client-local UI state.
- **Never use `setTimeout` in shared/.** Shared/ is pure game logic with no runtime dependencies. Timers live in server/ (`GameTimer`) or client/ (VueUse composables).
- **Never use `Math.random()` in shared/ for game logic.** Wall shuffle must use a seeded PRNG for reproducibility and testability. `Math.random()` is non-deterministic and untestable.
- **Never send opponent rack data to clients.** `buildPlayerView` filters this before broadcast. If you're tempted to send hidden data "for convenience," you're breaking the security model.
- **Never use `any` type.** TypeScript strict mode is on. Use `unknown` if the type is truly unknown, then narrow it.
- **Never put secrets in `VITE_*` env vars.** They're bundled into the client and visible to anyone.
- **Never use a singleton game engine across rooms.** Each room gets its own `createGameEngine(logger)` call with its own state object. An agent might try to create one engine and share it — this would cause rooms to corrupt each other's state.

### Gotchas — Easy to Get Wrong
- **Tile IDs include a copy suffix.** There are 4 copies of most tiles. `bam-3` is not a valid tile ID — `bam-3-1` through `bam-3-4` are. An agent writing tile lookup code must account for the copy suffix.
- **NEWS is not a kong.** It's 4 different wind tiles (singles), not 4 identical tiles. Jokers cannot substitute. An agent implementing call validation must treat NEWS as a special group type.
- **Year digits (2-0-2-6) are singles.** Same as NEWS — they're individual tiles, not a group of identical tiles. 0 maps to Soap/White Dragon.
- **Pairs cannot be called.** A player cannot call a discard to form a pair — pairs must come from wall draws. The only exception is calling Mahjong on the final tile. An agent implementing call detection must exclude pairs.
- **Jokers cannot be discarded.** Once a Joker is in your hand, it stays. An agent implementing the discard action must validate this.
- **Exposed group identity is fixed at exposure time.** If a player exposes a "Kong of 3-Bam" with 2 natural tiles and 2 Jokers, the group is permanently "Kong of 3-Bam." Exchanging a Joker out doesn't change the identity. This matters for Joker exchange validation.
- **Call window freeze is UX, not fairness.** In-flight calls sent before the freeze arrives at the client are still valid. The server's call buffer accepts them. Priority is always seat position, never timing.
- **Charleston blind pass timing.** During the Left pass (first Charleston) and Right pass (second Charleston), tiles must be selected BEFORE the Across pass tiles are revealed. The UI must enforce this sequence — it's not just a rule, it's a UI gating requirement.
- **`sessionStorage` vs `localStorage`.** Session tokens go in `sessionStorage` (tab-scoped). User preferences go in `localStorage` (persisted). Mixing these up breaks reconnection or preference persistence.
- **Vue `provide` must happen in setup, synchronously.** An agent can't conditionally provide game state after an async operation. `RoomView` provides immediately, even if `state` is initially null. Components check for null.
- **Always `await flushPromises()` after simulating WebSocket state updates in component tests.** Game state arrives asynchronously via WebSocket. Without flushing, assertions run against stale state — the single most common source of flaky Vue tests in this project.

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any game code
- Follow ALL rules exactly as documented
- When in doubt, prefer the more restrictive option
- Reference the full architecture document (`_bmad-output/game-architecture.md`) for detailed context

**For Humans:**
- Keep this file lean and focused on agent needs
- Update when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

Last Updated: 2026-03-26
