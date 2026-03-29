# Story 4A.1: HTTP Room Creation & Room Codes

Status: done

## Story

As a **host player**,
I want **to create a game room via an HTTP endpoint and receive a short, human-friendly room code I can share with friends**,
So that **I can invite friends by sharing a link or code over text/voice (FR1, AR7, AR8)**.

## Acceptance Criteria

1. **Given** the server is running **When** `POST /api/rooms` is called with `{ hostName: "Rchoi" }` **Then** a room is created and the response includes `{ roomId, roomCode, roomUrl, hostToken }` where `roomCode` is 6 alphanumeric characters (e.g., `MHJG7K`)

2. **Given** a room is created **When** `GET /api/rooms/:code/status` is called with the room code **Then** the response includes `{ full: false, playerCount: 0, phase: 'lobby' }`

3. **Given** an unknown room code **When** `GET /api/rooms/:code/status` is called **Then** a 404 response is returned with `{ error: 'ROOM_NOT_FOUND' }`

4. **Given** room codes are generated **When** checking for collisions against active rooms **Then** the generator retries until a unique code is produced — no two active rooms share a code

5. **Given** Fastify is configured **When** the server starts **Then** Pino logging is enabled with child loggers per room (AR13), and the health check endpoint at `GET /health` returns 200

## Tasks / Subtasks

### Part A: Room Code Generator

- [x] Task 1: Create `room-code.ts` (AC: #1, #4)
  - [x] Implement `generateRoomCode(): string` — produces 6 uppercase alphanumeric characters
  - [x] Use `crypto.randomBytes()` for randomness (no `Math.random()`)
  - [x] Exclude ambiguous characters (0/O, 1/I/L) for human-readability over text/voice
  - [x] Implement `generateUniqueRoomCode(existingCodes: Set<string>): string` — retries until unique
  - [x] Add safety limit on retries (e.g., 100 attempts) with error if exhausted

- [x] Task 2: Create `room-code.test.ts` (AC: #1, #4)
  - [x] Generated codes are 6 characters, uppercase alphanumeric
  - [x] No ambiguous characters in output
  - [x] `generateUniqueRoomCode` avoids collision with existing codes
  - [x] Distribution is roughly uniform (statistical test over many generations)

### Part B: Room Manager

- [x] Task 3: Create `room.ts` — Room data structure (AC: #1, #2)
  - [x] Define `Room` interface: `{ roomId: string; roomCode: string; hostToken: string; players: Map<string, PlayerInfo>; gamePhase: 'lobby'; createdAt: number; logger: Logger }`
  - [x] Define `PlayerInfo`: `{ playerId: string; displayName: string; isHost: boolean; connectedAt: number }`
  - [x] `roomId` is UUID v4 via `crypto.randomUUID()`
  - [x] `hostToken` is UUID v4 via `crypto.randomUUID()`

- [x] Task 4: Create `room-manager.ts` (AC: #1, #2, #3, #4)
  - [x] `RoomManager` class with in-memory `Map<string, Room>` keyed by room code
  - [x] `createRoom(hostName: string, logger: Logger): { roomId, roomCode, roomUrl, hostToken }` — generates room code, creates Room, stores it
  - [x] `getRoom(code: string): Room | undefined` — case-insensitive lookup (uppercase input)
  - [x] `getRoomStatus(code: string): { full: boolean; playerCount: number; phase: string } | null` — returns null if not found
  - [x] `getActiveRoomCodes(): Set<string>` — for collision checking during code generation
  - [x] Child logger created per room: `logger.child({ roomCode })`

- [x] Task 5: Create `room-manager.test.ts` (AC: #1, #2, #3, #4)
  - [x] `createRoom` returns all required fields
  - [x] `roomCode` is 6 alphanumeric characters
  - [x] `roomId` and `hostToken` are valid UUIDs
  - [x] `getRoomStatus` returns correct status for existing room
  - [x] `getRoomStatus` returns null for nonexistent room code
  - [x] Multiple rooms have unique codes
  - [x] Room lookup is case-insensitive

### Part C: HTTP Routes

- [x] Task 6: Refactor `index.ts` — extract Fastify app creation (AC: #5)
  - [x] Extract Fastify app setup into a `createApp(options?)` function that returns the configured Fastify instance
  - [x] Keep `start()` function for production startup
  - [x] Export `createApp` for test use (Fastify's `inject()` method for HTTP testing without binding a port)

- [x] Task 7: Create `routes.ts` — HTTP route handlers (AC: #1, #2, #3, #5)
  - [x] `POST /api/rooms` — validates `hostName` (required string, 1-30 chars, stripped of control characters), calls `roomManager.createRoom()`, returns 201 with `{ roomId, roomCode, roomUrl, hostToken }`
  - [x] `GET /api/rooms/:code/status` — calls `roomManager.getRoomStatus()`, returns 200 with status or 404 with `{ error: 'ROOM_NOT_FOUND' }`
  - [x] `GET /health` — returns 200 with `{ status: 'ok' }` (move existing health route here)
  - [x] Register routes as a Fastify plugin: `export async function roomRoutes(app, { roomManager })`
  - [x] Input validation: reject missing/empty `hostName` with 400, reject non-string with 400
  - [x] `roomUrl` format: `${BASE_URL}/room/${roomCode}` where `BASE_URL` comes from env var (default: `http://localhost:5173`)

- [x] Task 8: Create `routes.test.ts` (AC: #1, #2, #3, #5)
  - [x] `POST /api/rooms` with valid hostName → 201 with all required fields
  - [x] `POST /api/rooms` with missing hostName → 400
  - [x] `POST /api/rooms` with empty hostName → 400
  - [x] `POST /api/rooms` with hostName > 30 chars → 400 or truncated
  - [x] `GET /api/rooms/:code/status` for existing room → 200 with correct status
  - [x] `GET /api/rooms/:code/status` for unknown code → 404 with `ROOM_NOT_FOUND`
  - [x] `GET /health` → 200 with `{ status: 'ok' }`
  - [x] Use Fastify's `app.inject()` for HTTP testing (no port binding needed)

### Part D: Logging & Server Configuration

- [x] Task 9: Configure Pino logging (AC: #5)
  - [x] Pino logger with configurable level via `LOG_LEVEL` env var (already exists in index.ts)
  - [x] Child loggers per room created in `room-manager.ts` via `logger.child({ roomCode })`
  - [x] NEVER log rack contents — add comment/convention note (AR13 — enforced in later stories)
  - [x] Log room creation events at INFO level
  - [x] Log room status lookups at DEBUG level
  - [x] Log 404s at WARN level

- [x] Task 10: Integration smoke test
  - [x] Full flow: create room → check status → verify response shapes
  - [x] Verify room code uniqueness across multiple creations
  - [x] Verify health endpoint still works after route registration

## Dev Notes

### This Is the First Server Story

The server package (`packages/server/`) currently has only a skeleton: a Fastify instance with a single `/health` endpoint. This story establishes the foundational server architecture that all subsequent Epic 4A stories build on. Get the patterns right here — they'll be replicated across 7 more stories.

### Architecture Patterns to Establish

**Validate-then-respond:** Mirror the shared/ engine's validate-then-mutate pattern. Validate input → perform operation → return typed response. No mutations before validation passes.

**Fastify plugin pattern:** Routes should be registered as Fastify plugins (`export async function roomRoutes(app, opts)`). This enables clean separation, testability, and future route grouping.

**Testable app factory:** Extract Fastify app creation into a `createApp()` function. Tests use `app.inject()` to test HTTP routes without binding ports. This is the standard Fastify testing pattern.

### Server Folder Structure (Architecture-Defined)

```
server/src/
├── rooms/
│   ├── room-manager.ts      # Room CRUD, in-memory storage
│   ├── room-manager.test.ts
│   ├── room.ts              # Room type definition
│   ├── room-code.ts         # Code generation logic
│   └── room-code.test.ts
├── http/
│   ├── routes.ts            # HTTP route handlers (Fastify plugin)
│   └── routes.test.ts
├── utils/
│   └── sanitize.ts          # Input sanitization (hostName)
└── index.ts                 # App creation + startup
```

This matches the architecture document's prescribed folder structure. Do NOT deviate from this organization.

### No Database

All state is in-memory. No PostgreSQL, no SQLite, no ORM. Database is deferred to Epic 8. The `RoomManager` uses a `Map<string, Room>` — nothing more.

### Room Code Design

- 6 uppercase alphanumeric characters (e.g., `MHJG7K`)
- Exclude ambiguous characters: `0`, `O`, `1`, `I`, `L` — these are hard to distinguish over voice/text
- Valid charset: `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (26 chars)
- 26^6 = ~308 million possible codes — collision is near-impossible for a handful of active rooms
- Use `crypto.randomBytes()`, not `Math.random()` — deterministic seeds are a collision risk
- Collision check against active rooms map before returning

### ID Generation (Architecture-Defined)

| ID Type | Format | Generator |
|---------|--------|-----------|
| Room ID | UUID v4 | `crypto.randomUUID()` |
| Room code | 6 alphanumeric | Custom generator with collision check |
| Host token | UUID v4 | `crypto.randomUUID()` |

### Input Sanitization

`hostName` is the first user-provided string the server receives. Establish the sanitization pattern here:
- Cap at 30 characters
- Strip control characters (regex: `/[\x00-\x1F\x7F]/g`)
- Reject empty after stripping
- Do NOT create a generic sanitize utility yet — just inline the validation in the route handler. A shared `sanitize.ts` will be needed when chat messages arrive (Story 6a-1), but premature abstraction is worse than duplication.

### roomUrl Construction

The `roomUrl` returned from `POST /api/rooms` needs a base URL. Use an env var `BASE_URL` (default: `http://localhost:5173` for dev). This is the client URL, not the server URL — the room URL is a link players share to join via the client SPA.

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3001` | Server listen port |
| `LOG_LEVEL` | `info` | Pino log level |
| `BASE_URL` | `http://localhost:5173` | Client URL for room link construction |

### Testing Approach

**Use Fastify's `app.inject()` method** for HTTP testing. This sends requests directly to the Fastify instance without binding a network port — faster, no port conflicts, no cleanup needed.

```typescript
const app = createApp();
const response = await app.inject({
  method: 'POST',
  url: '/api/rooms',
  payload: { hostName: 'TestHost' }
});
expect(response.statusCode).toBe(201);
```

**Co-located tests:** `room-code.test.ts` next to `room-code.ts`, `routes.test.ts` next to `routes.ts`, etc.

**Test pattern:** Follow the existing shared/ test patterns — descriptive `describe`/`it` blocks, arrange-act-assert, no mocks for in-memory operations.

### Key Dependencies — Existing Code to Use

| Need | Use This | Location |
|------|----------|----------|
| Fastify setup pattern | Existing `index.ts` | `server/src/index.ts` |
| UUID generation | `crypto.randomUUID()` | Node.js built-in |
| Random bytes | `crypto.randomBytes()` | Node.js built-in |
| Pino logger | Already a Fastify dependency | `fastify({ logger: {...} })` |
| Test runner | Vitest | Already configured in `vite.config.ts` |

### What This Story Does NOT Include

- No WebSocket server setup (Story 4a-2)
- No player joining/seat assignment (Story 4a-3)
- No session token management (Story 4a-4)
- No game state broadcasting (Story 4a-5)
- No room cleanup/garbage collection (Story 4a-8)
- No database or persistent storage (Epic 8)
- Room cleanup timers are NOT part of this story — rooms created here will persist in memory until the server restarts. Cleanup is Story 4a-8.

### Previous Epic Intelligence

- **593 tests currently passing** across all packages (571 shared + 1 server placeholder + 21 client)
- **Server placeholder test** exists at `packages/server/src/placeholder.test.ts` — can be removed or replaced
- **Existing Fastify logger** uses Pino implicitly (Fastify's built-in logger IS Pino)
- **pnpm workspace** references work — `@mahjong-game/shared` is available as `workspace:*`
- **TypeScript strict mode** enabled across all packages — no `@ts-ignore` without justification
- **Naming convention:** kebab-case files, camelCase functions, PascalCase types, UPPER_SNAKE_CASE constants

### Git Commit Patterns

Recent commits follow the format: `feat(scope): description` or `fix(scope): description`. Use `feat(server):` for this story's commits.

### Project Structure Notes

- All new files go in `packages/server/src/` under the prescribed subfolder structure
- The `rooms/` and `http/` directories need to be created
- No changes to `packages/shared/` or `packages/client/` in this story
- Server runs via `tsx` in dev (`pnpm -F @mahjong-game/server dev`)

### References

- [Source: _bmad-output/planning-artifacts/epics.md — Epic 4A, Story 4A.1]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Decision 4: Room Lifecycle, Server folder structure, ID Generation table]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Technical Stack table (Fastify ^5.0, Pino ^9.0, ws ^8.0)]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Security Model: Input Sanitization (display names capped at 30 chars)]
- [Source: _bmad-output/planning-artifacts/game-architecture.md — Debug & Development Tools (server debug endpoint pattern)]
- [Source: _bmad-output/planning-artifacts/gdd.md — Room capacity: exactly 4 players, 5th player sees "table is full"]
- [Source: _bmad-output/project-context.md — Technology stack, testing rules]
- [Source: packages/server/src/index.ts — Current server skeleton]
- [Source: packages/server/package.json — Dependencies: fastify ^5.8.0, pino ^9.0.0, ws ^8.20.0]
- [Source: packages/server/vite.config.ts — Test configuration with restoreMocks, clearMocks]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Debug Log References

- Used `FastifyBaseLogger` instead of `pino.Logger` for type compatibility with Fastify's built-in logger
- Added eslint-disable comment for intentional control character regex in input sanitization
- Removed pre-existing broken placeholder test (imported from `vite-plus/test` which caused TypeError)

### Completion Notes List

- Part A: Room code generator produces 6-character codes from 26-char charset (excludes ambiguous 0/O/1/I/L). Uses crypto.randomBytes() for randomness. generateUniqueRoomCode retries up to 100 times with collision checking.
- Part B: RoomManager class with in-memory Map<string, Room>. Creates rooms with UUID roomId/hostToken, generates unique room codes, provides case-insensitive lookup. Child Pino loggers created per room.
- Part C: HTTP routes registered as Fastify plugin. POST /api/rooms validates hostName (1-30 chars, control chars stripped), returns 201. GET /api/rooms/:code/status returns room status or 404. GET /health returns ok. index.ts refactored with createApp() factory for testability.
- Part D: Logging configured via Fastify's built-in Pino. Room creation at INFO, status lookups at DEBUG, 404s at WARN. Integration tests cover full create→status flow.
- All 624 tests passing (571 shared + 32 server + 21 client). Typecheck clean. Lint clean.

### Change Log

- 2026-03-28: Implemented HTTP room creation & room codes (Story 4A.1, all 10 tasks)
- 2026-03-28: Code review — fixed modular bias in generateRoomCode() by adding rejection sampling (H1 finding)

### File List

- packages/server/src/rooms/room-code.ts (new — room code generation with crypto.randomBytes)
- packages/server/src/rooms/room-code.test.ts (new — 7 tests for code generation and uniqueness)
- packages/server/src/rooms/room.ts (new — Room and PlayerInfo type definitions)
- packages/server/src/rooms/room-manager.ts (new — RoomManager class with CRUD operations)
- packages/server/src/rooms/room-manager.test.ts (new — 12 tests for room management)
- packages/server/src/http/routes.ts (new — HTTP route handlers as Fastify plugin)
- packages/server/src/http/routes.test.ts (new — 13 tests for HTTP endpoints including integration)
- packages/server/src/index.ts (modified — extracted createApp() factory, registered routes plugin)
- packages/server/src/placeholder.test.ts (deleted — replaced by real tests)
