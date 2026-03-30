# Epic 5A Prep: Client Composables & Test Infrastructure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the client-server bridge composables (`useWebSocket`, `useGameState`) and test infrastructure that all Epic 5A UI stories depend on.

**Architecture:** A `useWebSocket` composable manages the raw WebSocket lifecycle (connect, send, receive, status tracking). A `useGameState` composable consumes it, handling the game protocol (JOIN_ROOM, STATE_UPDATE parsing, session tokens, action dispatch). Game state is exposed via Vue's provide/inject pattern — `RoomView` provides, descendants inject via `useGameStateContext()`. Connection status lives in a Pinia store (`useConnectionStore`) for UI components that need it without injecting game state.

**Tech Stack:** Vue 3 Composition API, TypeScript, Pinia 3, VueUse 14 (`createEventHook`), `@pinia/testing`, Vitest with happy-dom

**Key constraint:** Components NEVER import WebSocket APIs directly. They use `inject(gameStateKey)` for game state and `useConnectionStore()` for connection status. The `sendAction()` method on the game state context is the only way to dispatch actions.

---

## File Structure

```
packages/client/src/
├── testing/
│   ├── mock-websocket.ts       # MockWebSocket class for deterministic testing
│   └── helpers.ts              # withSetup() for composable tests
├── stores/
│   ├── connection.ts           # useConnectionStore — connection status, room code, errors
│   └── connection.test.ts
├── composables/
│   ├── useWebSocket.ts         # Low-level WebSocket lifecycle + typed message parsing
│   ├── useWebSocket.test.ts
│   ├── useGameState.ts         # Game state management, provide/inject, session tokens
│   └── useGameState.test.ts
└── keys.ts                     # InjectionKey for game state context
```

---

### Task 1: Test Infrastructure — MockWebSocket + withSetup Helper

**Files:**
- Create: `packages/client/src/testing/mock-websocket.ts`
- Create: `packages/client/src/testing/helpers.ts`
- Modify: `packages/client/package.json` (add `@pinia/testing`)

This task builds the test utilities that all subsequent tasks depend on. No TDD loop here — these ARE the test tools.

- [ ] **Step 1: Install @pinia/testing**

```bash
cd /Users/rchoi/Personal/mahjong-game && pnpm -F @mahjong-game/client add -D @pinia/testing
```

Expected: `@pinia/testing` appears in client `package.json` devDependencies.

- [ ] **Step 2: Create MockWebSocket**

Create `packages/client/src/testing/mock-websocket.ts`:

```typescript
/**
 * Deterministic WebSocket mock for composable tests.
 * Captures sent messages and lets tests simulate server responses.
 */
export class MockWebSocket {
  static instances: MockWebSocket[] = [];

  readonly url: string;
  readyState: number = WebSocket.CONNECTING;

  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  /** All data passed to send(), in order. */
  sent: string[] = [];
  /** Close code passed to close(), if called. */
  closedWith: { code?: number; reason?: string } | null = null;

  constructor(url: string | URL) {
    this.url = typeof url === "string" ? url : url.toString();
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    if (this.readyState !== WebSocket.OPEN) {
      throw new DOMException("WebSocket is not open", "InvalidStateError");
    }
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closedWith = { code, reason };
    this.readyState = WebSocket.CLOSING;
    // Simulate async close event on next microtask
    queueMicrotask(() => {
      this.readyState = WebSocket.CLOSED;
      this.onclose?.(new CloseEvent("close", { code: code ?? 1000, reason }));
    });
  }

  // --- Test helpers (not part of WebSocket API) ---

  /** Simulate the server accepting the connection. */
  simulateOpen(): void {
    this.readyState = WebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  /** Simulate a server message. Pass an object — it will be JSON-stringified. */
  simulateMessage(data: unknown): void {
    const raw = typeof data === "string" ? data : JSON.stringify(data);
    this.onmessage?.(new MessageEvent("message", { data: raw }));
  }

  /** Simulate a connection error. */
  simulateError(): void {
    this.onerror?.(new Event("error"));
  }

  /** Simulate the server closing the connection. */
  simulateClose(code = 1000, reason = ""): void {
    this.readyState = WebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close", { code, reason }));
  }

  /** Parse the last sent message as JSON. Throws if nothing was sent. */
  lastSentParsed<T = unknown>(): T {
    if (this.sent.length === 0) throw new Error("No messages sent");
    return JSON.parse(this.sent[this.sent.length - 1]) as T;
  }

  /** Reset all instances. Call in afterEach(). */
  static reset(): void {
    MockWebSocket.instances = [];
  }
}

/** Install MockWebSocket as the global WebSocket for tests. Returns cleanup function. */
export function installMockWebSocket(): () => void {
  const original = globalThis.WebSocket;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  globalThis.WebSocket = MockWebSocket as any;
  return () => {
    globalThis.WebSocket = original;
    MockWebSocket.reset();
  };
}
```

- [ ] **Step 3: Create withSetup helper**

Create `packages/client/src/testing/helpers.ts`:

```typescript
import { createApp, type App, type InjectionKey } from "vue";
import { createPinia } from "pinia";

/**
 * Run a composable inside a real Vue app context.
 * Returns [composableResult, app] — always call app.unmount() in cleanup.
 *
 * Usage:
 *   const [result, app] = withSetup(() => useMyComposable(), {
 *     provide: { [myKey]: mockValue }
 *   })
 *   // assertions...
 *   app.unmount()
 */
export function withSetup<T>(
  composable: () => T,
  options: {
    provide?: Record<string | symbol, unknown>;
  } = {},
): [T, App] {
  let result!: T;

  const app = createApp({
    setup() {
      result = composable();
      return () => null;
    },
  });

  app.use(createPinia());

  if (options.provide) {
    for (const [key, value] of Object.entries(options.provide)) {
      app.provide(key, value);
    }
    // Handle symbol keys (InjectionKeys)
    for (const sym of Object.getOwnPropertySymbols(options.provide)) {
      app.provide(sym as InjectionKey<unknown>, options.provide[sym as unknown as string]);
    }
  }

  app.mount(document.createElement("div"));

  return [result, app];
}
```

- [ ] **Step 4: Verify test infrastructure compiles**

```bash
cd /Users/rchoi/Personal/mahjong-game && pnpm -F @mahjong-game/client typecheck
```

Expected: No type errors in the new files.

- [ ] **Step 5: Commit**

```bash
cd /Users/rchoi/Personal/mahjong-game && git add packages/client/src/testing/ packages/client/package.json pnpm-lock.yaml && git commit -m "$(cat <<'EOF'
feat(client): add test infrastructure for composable testing

- MockWebSocket class for deterministic WebSocket testing
- withSetup() helper for running composables in Vue app context
- Install @pinia/testing for Pinia store testing
EOF
)"
```

---

### Task 2: useConnectionStore — Pinia Store for Connection Status

**Files:**
- Create: `packages/client/src/stores/connection.ts`
- Create: `packages/client/src/stores/connection.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/client/src/stores/connection.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useConnectionStore } from "./connection";

describe("useConnectionStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("starts disconnected with no room code", () => {
    const store = useConnectionStore();
    expect(store.status).toBe("disconnected");
    expect(store.roomCode).toBeNull();
    expect(store.lastError).toBeNull();
  });

  it("transitions to connecting", () => {
    const store = useConnectionStore();
    store.setConnecting("MHJG7K");
    expect(store.status).toBe("connecting");
    expect(store.roomCode).toBe("MHJG7K");
    expect(store.lastError).toBeNull();
  });

  it("transitions to connected", () => {
    const store = useConnectionStore();
    store.setConnecting("MHJG7K");
    store.setConnected();
    expect(store.status).toBe("connected");
    expect(store.roomCode).toBe("MHJG7K");
  });

  it("transitions to disconnected and clears room code", () => {
    const store = useConnectionStore();
    store.setConnecting("MHJG7K");
    store.setConnected();
    store.setDisconnected();
    expect(store.status).toBe("disconnected");
    expect(store.roomCode).toBeNull();
  });

  it("records last error", () => {
    const store = useConnectionStore();
    store.setError("ROOM_NOT_FOUND", "Room does not exist");
    expect(store.lastError).toEqual({
      code: "ROOM_NOT_FOUND",
      message: "Room does not exist",
    });
  });

  it("clears error on new connection attempt", () => {
    const store = useConnectionStore();
    store.setError("ROOM_NOT_FOUND", "Room does not exist");
    store.setConnecting("NEWCODE");
    expect(store.lastError).toBeNull();
  });

  it("provides isConnected getter", () => {
    const store = useConnectionStore();
    expect(store.isConnected).toBe(false);
    store.setConnecting("MHJG7K");
    expect(store.isConnected).toBe(false);
    store.setConnected();
    expect(store.isConnected).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/rchoi/Personal/mahjong-game && pnpm -F @mahjong-game/client test run src/stores/connection.test.ts
```

Expected: FAIL — `useConnectionStore` not found.

- [ ] **Step 3: Implement useConnectionStore**

Create `packages/client/src/stores/connection.ts`:

```typescript
import { defineStore } from "pinia";
import { ref, computed } from "vue";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface ConnectionError {
  code: string;
  message: string;
}

export const useConnectionStore = defineStore("connection", () => {
  const status = ref<ConnectionStatus>("disconnected");
  const roomCode = ref<string | null>(null);
  const lastError = ref<ConnectionError | null>(null);

  const isConnected = computed(() => status.value === "connected");

  function setConnecting(code: string): void {
    status.value = "connecting";
    roomCode.value = code;
    lastError.value = null;
  }

  function setConnected(): void {
    status.value = "connected";
  }

  function setDisconnected(): void {
    status.value = "disconnected";
    roomCode.value = null;
  }

  function setError(code: string, message: string): void {
    lastError.value = { code, message };
  }

  return {
    status,
    roomCode,
    lastError,
    isConnected,
    setConnecting,
    setConnected,
    setDisconnected,
    setError,
  };
});
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/rchoi/Personal/mahjong-game && pnpm -F @mahjong-game/client test run src/stores/connection.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/rchoi/Personal/mahjong-game && git add packages/client/src/stores/ && git commit -m "$(cat <<'EOF'
feat(client): add useConnectionStore for connection status tracking

Pinia store tracking WebSocket connection status, room code, and
errors. Used by UI components to show connection state without
importing WebSocket APIs directly.
EOF
)"
```

---

### Task 3: Injection Key + GameStateContext Type

**Files:**
- Create: `packages/client/src/keys.ts`

This is a small task — define the injection key and context type that Tasks 4 and 5 depend on. No tests needed (pure types + symbol).

- [ ] **Step 1: Create keys.ts**

Create `packages/client/src/keys.ts`:

```typescript
import type { InjectionKey, DeepReadonly, Ref } from "vue";
import type {
  LobbyState,
  PlayerGameView,
  ResolvedAction,
  GameAction,
} from "@mahjong-game/shared";

/** The game state provided by RoomView and injected by game components. */
export interface GameStateContext {
  /** Current game state — null before first STATE_UPDATE. */
  state: DeepReadonly<Ref<LobbyState | PlayerGameView | null>>;
  /** Most recent resolved action for animation context. Resets on each STATE_UPDATE. */
  resolvedAction: Readonly<Ref<ResolvedAction | null>>;
  /** This player's ID, set after JOIN_ROOM succeeds. */
  myPlayerId: Readonly<Ref<string | null>>;
  /** Dispatch a game action to the server. Throws if not connected. */
  sendAction: (action: GameAction) => void;
}

export const gameStateKey: InjectionKey<GameStateContext> = Symbol("gameState");
```

- [ ] **Step 2: Verify it compiles**

```bash
cd /Users/rchoi/Personal/mahjong-game && pnpm -F @mahjong-game/client typecheck
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/rchoi/Personal/mahjong-game && git add packages/client/src/keys.ts && git commit -m "$(cat <<'EOF'
feat(client): define gameStateKey injection key and GameStateContext type

InjectionKey for game state provide/inject pattern. RoomView will
provide via useGameState(), components inject via useGameStateContext().
EOF
)"
```

---

### Task 4: useWebSocket — WebSocket Lifecycle Composable

**Files:**
- Create: `packages/client/src/composables/useWebSocket.ts`
- Create: `packages/client/src/composables/useWebSocket.test.ts`

This composable manages the raw WebSocket connection: connect, send typed messages, parse incoming messages, track status. It does NOT understand game state — that's `useGameState`'s job.

- [ ] **Step 1: Write the failing tests**

Create `packages/client/src/composables/useWebSocket.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { nextTick } from "vue";
import { withSetup } from "../testing/helpers";
import { MockWebSocket, installMockWebSocket } from "../testing/mock-websocket";
import { useWebSocket } from "./useWebSocket";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import type { App } from "vue";

describe("useWebSocket", () => {
  let cleanup: () => void;
  let app: App;

  beforeEach(() => {
    cleanup = installMockWebSocket();
  });

  afterEach(() => {
    app?.unmount();
    cleanup();
  });

  function setup() {
    const [result, _app] = withSetup(() => useWebSocket());
    app = _app;
    return result;
  }

  function latestMockWs(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }

  describe("connection lifecycle", () => {
    it("starts disconnected", () => {
      const ws = setup();
      expect(ws.status.value).toBe("disconnected");
    });

    it("transitions to connecting on connect()", async () => {
      const ws = setup();
      ws.connect("ws://localhost:3001");
      await nextTick();
      expect(ws.status.value).toBe("connecting");
      expect(MockWebSocket.instances).toHaveLength(1);
      expect(latestMockWs().url).toBe("ws://localhost:3001");
    });

    it("transitions to connected when WebSocket opens", async () => {
      const ws = setup();
      ws.connect("ws://localhost:3001");
      latestMockWs().simulateOpen();
      await nextTick();
      expect(ws.status.value).toBe("connected");
    });

    it("transitions to disconnected on close", async () => {
      const ws = setup();
      ws.connect("ws://localhost:3001");
      latestMockWs().simulateOpen();
      latestMockWs().simulateClose();
      await nextTick();
      expect(ws.status.value).toBe("disconnected");
    });

    it("disconnect() closes the WebSocket", async () => {
      const ws = setup();
      ws.connect("ws://localhost:3001");
      latestMockWs().simulateOpen();
      ws.disconnect();
      expect(latestMockWs().closedWith).toBeTruthy();
    });
  });

  describe("sending messages", () => {
    it("sends JSON-serialized messages with version field", async () => {
      const ws = setup();
      ws.connect("ws://localhost:3001");
      latestMockWs().simulateOpen();

      ws.send({ type: "JOIN_ROOM", roomCode: "MHJG7K", displayName: "Rchoi" });

      const sent = latestMockWs().lastSentParsed();
      expect(sent).toEqual({
        version: PROTOCOL_VERSION,
        type: "JOIN_ROOM",
        roomCode: "MHJG7K",
        displayName: "Rchoi",
      });
    });

    it("throws if sending while disconnected", () => {
      const ws = setup();
      expect(() =>
        ws.send({ type: "JOIN_ROOM", roomCode: "X", displayName: "Y" }),
      ).toThrow();
    });
  });

  describe("receiving messages", () => {
    it("emits parsed STATE_UPDATE messages", async () => {
      const ws = setup();
      ws.connect("ws://localhost:3001");
      latestMockWs().simulateOpen();

      const received: unknown[] = [];
      ws.onStateUpdate((msg) => received.push(msg));

      latestMockWs().simulateMessage({
        version: 1,
        type: "STATE_UPDATE",
        state: { gamePhase: "lobby", players: [], myPlayerId: "p1", roomId: "r1", roomCode: "MHJG7K" },
      });

      expect(received).toHaveLength(1);
      expect((received[0] as { type: string }).type).toBe("STATE_UPDATE");
    });

    it("emits parsed ERROR messages", async () => {
      const ws = setup();
      ws.connect("ws://localhost:3001");
      latestMockWs().simulateOpen();

      const errors: unknown[] = [];
      ws.onError((msg) => errors.push(msg));

      latestMockWs().simulateMessage({
        version: 1,
        type: "ERROR",
        code: "ROOM_NOT_FOUND",
        message: "Room does not exist",
      });

      expect(errors).toHaveLength(1);
      expect((errors[0] as { code: string }).code).toBe("ROOM_NOT_FOUND");
    });

    it("emits parsed SYSTEM_EVENT messages", async () => {
      const ws = setup();
      ws.connect("ws://localhost:3001");
      latestMockWs().simulateOpen();

      const events: unknown[] = [];
      ws.onSystemEvent((msg) => events.push(msg));

      latestMockWs().simulateMessage({
        version: 1,
        type: "SYSTEM_EVENT",
        event: "SESSION_SUPERSEDED",
      });

      expect(events).toHaveLength(1);
    });

    it("ignores malformed messages", async () => {
      const ws = setup();
      ws.connect("ws://localhost:3001");
      latestMockWs().simulateOpen();

      const received: unknown[] = [];
      ws.onStateUpdate((msg) => received.push(msg));

      latestMockWs().simulateMessage("not json " + "{" + "{" + "{");
      latestMockWs().simulateMessage({ no_type: true });

      expect(received).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/rchoi/Personal/mahjong-game && pnpm -F @mahjong-game/client test run src/composables/useWebSocket.test.ts
```

Expected: FAIL — `useWebSocket` not found.

- [ ] **Step 3: Implement useWebSocket**

Create `packages/client/src/composables/useWebSocket.ts`:

```typescript
import { ref, readonly, onScopeDispose } from "vue";
import { createEventHook } from "@vueuse/core";
import type {
  StateUpdateMessage,
  ServerErrorMessage,
  SystemEventMessage,
  JoinRoomMessage,
  ActionMessage,
} from "@mahjong-game/shared";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

type OutgoingMessage = Omit<JoinRoomMessage, "version"> | Omit<ActionMessage, "version">;

type ServerMessage = StateUpdateMessage | ServerErrorMessage | SystemEventMessage;

export function useWebSocket() {
  const status = ref<ConnectionStatus>("disconnected");
  let ws: WebSocket | null = null;

  const stateUpdateHook = createEventHook<StateUpdateMessage>();
  const errorHook = createEventHook<ServerErrorMessage>();
  const systemEventHook = createEventHook<SystemEventMessage>();

  function connect(url: string): void {
    disconnect();
    status.value = "connecting";

    ws = new WebSocket(url);

    ws.onopen = () => {
      status.value = "connected";
    };

    ws.onclose = () => {
      status.value = "disconnected";
      ws = null;
    };

    ws.onerror = () => {
      // Error is followed by close event — status handled there
    };

    ws.onmessage = (event: MessageEvent) => {
      const parsed = parseMessage(event.data);
      if (!parsed) return;

      switch (parsed.type) {
        case "STATE_UPDATE":
          stateUpdateHook.trigger(parsed as StateUpdateMessage);
          break;
        case "ERROR":
          errorHook.trigger(parsed as ServerErrorMessage);
          break;
        case "SYSTEM_EVENT":
          systemEventHook.trigger(parsed as SystemEventMessage);
          break;
      }
    };
  }

  function disconnect(): void {
    if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CLOSING) {
      ws.close(1000);
    }
    ws = null;
  }

  function send(message: OutgoingMessage): void {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }
    ws.send(JSON.stringify({ version: PROTOCOL_VERSION, ...message }));
  }

  onScopeDispose(() => {
    disconnect();
  });

  return {
    status: readonly(status),
    connect,
    disconnect,
    send,
    onStateUpdate: stateUpdateHook.on,
    onError: errorHook.on,
    onSystemEvent: systemEventHook.on,
  };
}

function parseMessage(data: unknown): ServerMessage | null {
  if (typeof data !== "string") return null;
  try {
    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed.type !== "string") return null;
    return parsed as ServerMessage;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/rchoi/Personal/mahjong-game && pnpm -F @mahjong-game/client test run src/composables/useWebSocket.test.ts
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Run full client test suite for regressions**

```bash
cd /Users/rchoi/Personal/mahjong-game && pnpm -F @mahjong-game/client test run
```

Expected: All tests pass (existing + new).

- [ ] **Step 6: Commit**

```bash
cd /Users/rchoi/Personal/mahjong-game && git add packages/client/src/composables/useWebSocket.ts packages/client/src/composables/useWebSocket.test.ts && git commit -m "$(cat <<'EOF'
feat(client): add useWebSocket composable for WebSocket lifecycle

Low-level composable managing WebSocket connection, typed message
sending (with auto version field), and parsed message events via
VueUse createEventHook. Components never use this directly — it's
consumed by useGameState.
EOF
)"
```

---

### Task 5: useGameState — Game State Composable with Provide/Inject

**Files:**
- Create: `packages/client/src/composables/useGameState.ts`
- Create: `packages/client/src/composables/useGameState.test.ts`

This is the main composable — it wires everything together: connects WebSocket, sends JOIN_ROOM, processes STATE_UPDATE into reactive state, manages session tokens, updates connection store, and exposes the `GameStateContext` for provide/inject.

- [ ] **Step 1: Write the failing tests**

Create `packages/client/src/composables/useGameState.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { nextTick } from "vue";
import { withSetup } from "../testing/helpers";
import { MockWebSocket, installMockWebSocket } from "../testing/mock-websocket";
import { useGameState, useGameStateContext } from "./useGameState";
import { gameStateKey } from "../keys";
import { useConnectionStore } from "../stores/connection";
import { PROTOCOL_VERSION } from "@mahjong-game/shared";
import type { LobbyState, PlayerGameView, StateUpdateMessage } from "@mahjong-game/shared";
import type { App } from "vue";

describe("useGameState", () => {
  let cleanup: () => void;
  let app: App;

  beforeEach(() => {
    cleanup = installMockWebSocket();
    // Mock sessionStorage
    vi.stubGlobal("sessionStorage", {
      _store: {} as Record<string, string>,
      getItem(key: string) { return this._store[key] ?? null; },
      setItem(key: string, val: string) { this._store[key] = val; },
      removeItem(key: string) { delete this._store[key]; },
    });
  });

  afterEach(() => {
    app?.unmount();
    cleanup();
    vi.unstubAllGlobals();
  });

  function latestMockWs(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
  }

  function createLobbyState(overrides?: Partial<LobbyState>): LobbyState {
    return {
      roomId: "room-1",
      roomCode: "MHJG7K",
      gamePhase: "lobby",
      players: [
        { playerId: "player-0", displayName: "Rchoi", wind: "east", isHost: true, connected: true },
      ],
      myPlayerId: "player-0",
      ...overrides,
    };
  }

  function simulateStateUpdate(state: LobbyState | PlayerGameView, token?: string): void {
    const msg: StateUpdateMessage = {
      version: PROTOCOL_VERSION,
      type: "STATE_UPDATE",
      state,
      ...(token ? { token } : {}),
    };
    latestMockWs().simulateMessage(msg);
  }

  describe("connection flow", () => {
    it("connects to WebSocket and sends JOIN_ROOM on open", async () => {
      const [ctx, _app] = withSetup(() =>
        useGameState("ws://localhost:3001", "MHJG7K", "Rchoi"),
      );
      app = _app;

      // WebSocket should have been created
      expect(MockWebSocket.instances).toHaveLength(1);
      expect(latestMockWs().url).toBe("ws://localhost:3001");

      // Simulate server accepting connection
      latestMockWs().simulateOpen();
      await nextTick();

      // Should have sent JOIN_ROOM
      const sent = latestMockWs().lastSentParsed<{ type: string; roomCode: string; displayName: string }>();
      expect(sent.type).toBe("JOIN_ROOM");
      expect(sent.roomCode).toBe("MHJG7K");
      expect(sent.displayName).toBe("Rchoi");
    });

    it("updates connection store on connect/disconnect", async () => {
      const [ctx, _app] = withSetup(() => {
        const gameState = useGameState("ws://localhost:3001", "MHJG7K", "Rchoi");
        const store = useConnectionStore();
        return { gameState, store };
      });
      app = _app;

      expect(ctx.store.status).toBe("connecting");
      expect(ctx.store.roomCode).toBe("MHJG7K");

      latestMockWs().simulateOpen();
      await nextTick();
      expect(ctx.store.status).toBe("connected");

      latestMockWs().simulateClose();
      await nextTick();
      expect(ctx.store.status).toBe("disconnected");
    });
  });

  describe("state management", () => {
    it("starts with null state", () => {
      const [ctx, _app] = withSetup(() =>
        useGameState("ws://localhost:3001", "MHJG7K", "Rchoi"),
      );
      app = _app;
      expect(ctx.state.value).toBeNull();
      expect(ctx.myPlayerId.value).toBeNull();
    });

    it("updates state on STATE_UPDATE", async () => {
      const [ctx, _app] = withSetup(() =>
        useGameState("ws://localhost:3001", "MHJG7K", "Rchoi"),
      );
      app = _app;

      latestMockWs().simulateOpen();
      await nextTick();

      const lobby = createLobbyState();
      simulateStateUpdate(lobby);
      await nextTick();

      expect(ctx.state.value).toEqual(lobby);
      expect(ctx.myPlayerId.value).toBe("player-0");
    });

    it("tracks resolvedAction from STATE_UPDATE", async () => {
      const [ctx, _app] = withSetup(() =>
        useGameState("ws://localhost:3001", "MHJG7K", "Rchoi"),
      );
      app = _app;

      latestMockWs().simulateOpen();
      await nextTick();

      latestMockWs().simulateMessage({
        version: PROTOCOL_VERSION,
        type: "STATE_UPDATE",
        state: createLobbyState(),
        resolvedAction: { type: "PLAYER_JOINED", playerId: "player-0", playerName: "Rchoi" },
      });
      await nextTick();

      expect(ctx.resolvedAction.value).toEqual({
        type: "PLAYER_JOINED",
        playerId: "player-0",
        playerName: "Rchoi",
      });
    });
  });

  describe("session token management", () => {
    it("stores token from STATE_UPDATE in sessionStorage", async () => {
      const [ctx, _app] = withSetup(() =>
        useGameState("ws://localhost:3001", "MHJG7K", "Rchoi"),
      );
      app = _app;

      latestMockWs().simulateOpen();
      await nextTick();

      simulateStateUpdate(createLobbyState(), "test-token-123");
      await nextTick();

      expect(sessionStorage.getItem("mahjong-session-token")).toBe("test-token-123");
    });

    it("sends stored token in JOIN_ROOM for reconnection", async () => {
      sessionStorage.setItem("mahjong-session-token", "existing-token");

      const [ctx, _app] = withSetup(() =>
        useGameState("ws://localhost:3001", "MHJG7K", "Rchoi"),
      );
      app = _app;

      latestMockWs().simulateOpen();
      await nextTick();

      const sent = latestMockWs().lastSentParsed<{ token?: string }>();
      expect(sent.token).toBe("existing-token");
    });
  });

  describe("action dispatch", () => {
    it("sendAction sends ACTION message with correct format", async () => {
      const [ctx, _app] = withSetup(() =>
        useGameState("ws://localhost:3001", "MHJG7K", "Rchoi"),
      );
      app = _app;

      latestMockWs().simulateOpen();
      await nextTick();

      ctx.sendAction({ type: "DISCARD_TILE", playerId: "ignored", tileId: "bam-3-1" });

      const sent = latestMockWs().lastSentParsed<{
        type: string;
        action: { type: string; tileId: string };
      }>();
      expect(sent.type).toBe("ACTION");
      expect(sent.action.type).toBe("DISCARD_TILE");
      expect(sent.action.tileId).toBe("bam-3-1");
    });

    it("sendAction throws when not connected", () => {
      const [ctx, _app] = withSetup(() =>
        useGameState("ws://localhost:3001", "MHJG7K", "Rchoi"),
      );
      app = _app;

      expect(() =>
        ctx.sendAction({ type: "DISCARD_TILE", playerId: "p1", tileId: "bam-3-1" }),
      ).toThrow();
    });
  });

  describe("error handling", () => {
    it("updates connection store on server error", async () => {
      const [ctx, _app] = withSetup(() => {
        const gameState = useGameState("ws://localhost:3001", "MHJG7K", "Rchoi");
        const store = useConnectionStore();
        return { gameState, store };
      });
      app = _app;

      latestMockWs().simulateOpen();
      await nextTick();

      latestMockWs().simulateMessage({
        version: PROTOCOL_VERSION,
        type: "ERROR",
        code: "ROOM_NOT_FOUND",
        message: "Room does not exist",
      });
      await nextTick();

      expect(ctx.store.lastError).toEqual({
        code: "ROOM_NOT_FOUND",
        message: "Room does not exist",
      });
    });
  });

  describe("useGameStateContext", () => {
    it("returns context when provided", () => {
      const mockContext = {
        state: { value: null },
        resolvedAction: { value: null },
        myPlayerId: { value: null },
        sendAction: () => {},
      };

      const [result, _app] = withSetup(() => useGameStateContext(), {
        provide: { [gameStateKey as unknown as string]: mockContext },
      });
      app = _app;

      expect(result).toBe(mockContext);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/rchoi/Personal/mahjong-game && pnpm -F @mahjong-game/client test run src/composables/useGameState.test.ts
```

Expected: FAIL — `useGameState` not found.

- [ ] **Step 3: Implement useGameState**

Create `packages/client/src/composables/useGameState.ts`:

```typescript
import { shallowRef, readonly, inject } from "vue";
import type { DeepReadonly, Ref } from "vue";
import type {
  LobbyState,
  PlayerGameView,
  ResolvedAction,
  GameAction,
} from "@mahjong-game/shared";
import { useWebSocket } from "./useWebSocket";
import { useConnectionStore } from "../stores/connection";
import { gameStateKey, type GameStateContext } from "../keys";

const SESSION_TOKEN_KEY = "mahjong-session-token";

/**
 * Create the game state context for a room. Called once by RoomView.
 *
 * Connects to the WebSocket server, sends JOIN_ROOM, processes
 * STATE_UPDATE messages into reactive state, and manages session tokens.
 */
export function useGameState(
  wsUrl: string,
  roomCode: string,
  displayName: string,
): GameStateContext {
  const state = shallowRef<LobbyState | PlayerGameView | null>(null);
  const resolvedAction = shallowRef<ResolvedAction | null>(null);
  const myPlayerId = shallowRef<string | null>(null);

  const connectionStore = useConnectionStore();
  const ws = useWebSocket();

  // Listen for state updates
  ws.onStateUpdate((msg) => {
    state.value = msg.state;
    resolvedAction.value = msg.resolvedAction ?? null;
    myPlayerId.value = msg.state.myPlayerId;

    // Store session token if provided (first join)
    if (msg.token) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, msg.token);
    }
  });

  // Listen for errors
  ws.onError((msg) => {
    connectionStore.setError(msg.code, msg.message);
  });

  // Listen for system events
  ws.onSystemEvent((msg) => {
    if (msg.event === "SESSION_SUPERSEDED") {
      connectionStore.setDisconnected();
      connectionStore.setError("SESSION_SUPERSEDED", "Another tab took over this session");
    } else if (msg.event === "ROOM_CLOSING") {
      connectionStore.setDisconnected();
      connectionStore.setError("ROOM_CLOSING", `Room closed: ${msg.reason}`);
    }
  });

  // Track connection status in store
  connectionStore.setConnecting(roomCode);

  // On WebSocket open: send JOIN_ROOM
  const unwatchStatus = ws.onStateUpdate; // dummy - we use the ws hooks
  // We need to detect when ws connects to send JOIN_ROOM
  // Watch the ws status ref for the transition to connected
  const stopWatch = watchWebSocketStatus(ws.status, () => {
    connectionStore.setConnected();
    // Send JOIN_ROOM with optional stored token
    const token = sessionStorage.getItem(SESSION_TOKEN_KEY) ?? undefined;
    ws.send({
      type: "JOIN_ROOM",
      roomCode,
      displayName,
      ...(token ? { token } : {}),
    });
  }, () => {
    connectionStore.setDisconnected();
  });

  // Connect
  ws.connect(wsUrl);

  function sendAction(action: GameAction): void {
    ws.send({ type: "ACTION", action });
  }

  return {
    state: readonly(state) as DeepReadonly<Ref<LobbyState | PlayerGameView | null>>,
    resolvedAction: readonly(resolvedAction),
    myPlayerId: readonly(myPlayerId),
    sendAction,
  };
}

/**
 * Inject the game state context provided by RoomView.
 * Throws if called outside a RoomView descendant.
 */
export function useGameStateContext(): GameStateContext {
  const ctx = inject(gameStateKey);
  if (!ctx) {
    throw new Error("useGameStateContext() must be used within a component that provides gameStateKey (e.g., RoomView)");
  }
  return ctx;
}

/** Watch WebSocket status for connect/disconnect transitions. */
function watchWebSocketStatus(
  status: Readonly<Ref<string>>,
  onConnected: () => void,
  onDisconnected: () => void,
): void {
  // Use Vue's watch internally
  import("vue").then(({ watch }) => {
    watch(status, (newStatus, oldStatus) => {
      if (newStatus === "connected" && oldStatus !== "connected") {
        onConnected();
      } else if (newStatus === "disconnected" && oldStatus === "connected") {
        onDisconnected();
      }
    });
  });
}
```

**IMPORTANT:** The `watchWebSocketStatus` function above uses a dynamic import which is fragile. Replace it with a simpler approach — use the `watch` import directly:

```typescript
import { shallowRef, readonly, inject, watch } from "vue";
import type { DeepReadonly, Ref } from "vue";
import type {
  LobbyState,
  PlayerGameView,
  ResolvedAction,
  GameAction,
} from "@mahjong-game/shared";
import { useWebSocket } from "./useWebSocket";
import { useConnectionStore } from "../stores/connection";
import { gameStateKey, type GameStateContext } from "../keys";

const SESSION_TOKEN_KEY = "mahjong-session-token";

export function useGameState(
  wsUrl: string,
  roomCode: string,
  displayName: string,
): GameStateContext {
  const state = shallowRef<LobbyState | PlayerGameView | null>(null);
  const resolvedAction = shallowRef<ResolvedAction | null>(null);
  const myPlayerId = shallowRef<string | null>(null);

  const connectionStore = useConnectionStore();
  const ws = useWebSocket();

  ws.onStateUpdate((msg) => {
    state.value = msg.state;
    resolvedAction.value = msg.resolvedAction ?? null;
    myPlayerId.value = msg.state.myPlayerId;

    if (msg.token) {
      sessionStorage.setItem(SESSION_TOKEN_KEY, msg.token);
    }
  });

  ws.onError((msg) => {
    connectionStore.setError(msg.code, msg.message);
  });

  ws.onSystemEvent((msg) => {
    if (msg.event === "SESSION_SUPERSEDED") {
      connectionStore.setDisconnected();
      connectionStore.setError("SESSION_SUPERSEDED", "Another tab took over this session");
    } else if (msg.event === "ROOM_CLOSING") {
      connectionStore.setDisconnected();
      connectionStore.setError("ROOM_CLOSING", `Room closed: ${msg.reason}`);
    }
  });

  connectionStore.setConnecting(roomCode);

  watch(ws.status, (newStatus, oldStatus) => {
    if (newStatus === "connected" && oldStatus !== "connected") {
      connectionStore.setConnected();
      const token = sessionStorage.getItem(SESSION_TOKEN_KEY) ?? undefined;
      ws.send({
        type: "JOIN_ROOM",
        roomCode,
        displayName,
        ...(token ? { token } : {}),
      });
    } else if (newStatus === "disconnected" && oldStatus === "connected") {
      connectionStore.setDisconnected();
    }
  });

  ws.connect(wsUrl);

  function sendAction(action: GameAction): void {
    ws.send({ type: "ACTION", action });
  }

  return {
    state: readonly(state) as DeepReadonly<Ref<LobbyState | PlayerGameView | null>>,
    resolvedAction: readonly(resolvedAction),
    myPlayerId: readonly(myPlayerId),
    sendAction,
  };
}

export function useGameStateContext(): GameStateContext {
  const ctx = inject(gameStateKey);
  if (!ctx) {
    throw new Error(
      "useGameStateContext() must be used within a component that provides gameStateKey (e.g., RoomView)",
    );
  }
  return ctx;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/rchoi/Personal/mahjong-game && pnpm -F @mahjong-game/client test run src/composables/useGameState.test.ts
```

Expected: All 9 tests PASS. If the `useGameStateContext` test fails due to symbol key handling in `withSetup`, update the test to provide via `app.provide(gameStateKey, mockContext)` directly.

- [ ] **Step 5: Run full test suite for regressions**

```bash
cd /Users/rchoi/Personal/mahjong-game && pnpm -r test
```

Expected: All tests pass across all 3 packages. Zero regressions.

- [ ] **Step 6: Typecheck**

```bash
cd /Users/rchoi/Personal/mahjong-game && pnpm -F @mahjong-game/client typecheck
```

Expected: No type errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/rchoi/Personal/mahjong-game && git add packages/client/src/composables/useGameState.ts packages/client/src/composables/useGameState.test.ts && git commit -m "$(cat <<'EOF'
feat(client): add useGameState composable for server-authoritative game state

Main composable connecting WebSocket to reactive game state. Handles:
- JOIN_ROOM on WebSocket open (with session token for reconnection)
- STATE_UPDATE → shallowRef game state + resolvedAction
- Session token storage in sessionStorage
- Error/system event forwarding to connection store
- sendAction() for dispatching game actions

Provided by RoomView via gameStateKey, injected by components
via useGameStateContext().
EOF
)"
```

---

### Task 6: Delete Placeholder Test + Final Verification

**Files:**
- Delete: `packages/client/src/placeholder.test.ts`

- [ ] **Step 1: Remove placeholder test**

Delete `packages/client/src/placeholder.test.ts` — it's been replaced by real tests.

```bash
cd /Users/rchoi/Personal/mahjong-game && rm packages/client/src/placeholder.test.ts
```

- [ ] **Step 2: Run full test suite across all packages**

```bash
cd /Users/rchoi/Personal/mahjong-game && pnpm -r test
```

Expected: All tests pass. Client should have ~30+ tests (7 connection store + 9 useWebSocket + 9 useGameState + existing TestHarness tests).

- [ ] **Step 3: Lint check**

```bash
cd /Users/rchoi/Personal/mahjong-game && pnpm lint
```

Expected: 0 errors. Fix any lint issues before committing.

- [ ] **Step 4: Typecheck all packages**

```bash
cd /Users/rchoi/Personal/mahjong-game && pnpm -F @mahjong-game/client typecheck
```

Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/rchoi/Personal/mahjong-game && git add -A && git commit -m "$(cat <<'EOF'
chore(client): remove placeholder test, replaced by composable tests
EOF
)"
```
