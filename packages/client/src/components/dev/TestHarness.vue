<script setup lang="ts">
import { shallowRef, triggerRef, computed } from 'vue'
import { createLobbyState, handleAction } from '@mahjong-game/shared'
import type { GameState, GameAction, ActionResult } from '@mahjong-game/shared'

// ── State ────────────────────────────────────────────────────────────────────

const gameState = shallowRef<GameState>(createLobbyState())
const lastResult = shallowRef<ActionResult | null>(null)
const PLAYER_IDS = ['p1', 'p2', 'p3', 'p4']

// ── Helpers ──────────────────────────────────────────────────────────────────

function dispatch(action: GameAction): ActionResult {
  const result = handleAction(gameState.value, action)
  lastResult.value = result
  triggerRef(gameState)
  return result
}

function initGame(): void {
  const fresh = createLobbyState()
  gameState.value = fresh
  triggerRef(gameState)
  dispatch({ type: 'START_GAME', playerIds: PLAYER_IDS })
}

// ── Computed ─────────────────────────────────────────────────────────────────

const state = computed(() => gameState.value)
const isGameOver = computed(() => state.value.gamePhase === 'scoreboard')
const isWallGame = computed(
  () => isGameOver.value && state.value.gameResult?.winnerId === null,
)
const orderedPlayers = computed(() =>
  PLAYER_IDS.map((id) => state.value.players[id]).filter(Boolean),
)

function isCurrentPlayer(playerId: string): boolean {
  return state.value.currentTurn === playerId
}

// ── Actions ──────────────────────────────────────────────────────────────────

function drawTile(): void {
  dispatch({ type: 'DRAW_TILE', playerId: state.value.currentTurn })
}

function discardTile(playerId: string, tileId: string): void {
  dispatch({ type: 'DISCARD_TILE', playerId, tileId })
}

// ── Suit colors ──────────────────────────────────────────────────────────────

const SUIT_COLOR: Record<string, string> = {
  bam: 'text-green-600',
  crak: 'text-red-600',
  dot: 'text-blue-600',
  wind: 'text-gray-700',
  dragon: 'text-purple-700',
  flower: 'text-yellow-600',
  joker: 'text-pink-600',
}

function tileColor(suit: string): string {
  return SUIT_COLOR[suit] ?? 'text-gray-800'
}

// Initialise on mount
initGame()
</script>

<template>
  <div class="p-4 font-mono text-sm bg-gray-50 min-h-screen">
    <!-- Header -->
    <div class="flex items-center gap-4 mb-4">
      <h1 class="text-xl font-bold">🀄 Test Harness</h1>
      <button
        class="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        @click="initGame"
      >
        New Game
      </button>
      <span class="text-gray-500">
        Phase: <strong>{{ state.gamePhase }}</strong> | Turn Phase:
        <strong>{{ state.turnPhase }}</strong> | Wall:
        <strong>{{ state.wallRemaining }}</strong>
      </span>
    </div>

    <!-- Wall Game Banner -->
    <div
      v-if="isWallGame"
      class="mb-4 p-4 bg-amber-100 border-2 border-amber-400 rounded text-center text-lg font-bold text-amber-800"
    >
      🏁 Wall Game — Draw (no winner)
    </div>

    <!-- Last action result -->
    <div
      v-if="lastResult && !lastResult.accepted"
      class="mb-4 p-2 bg-red-100 border border-red-400 rounded text-red-700"
    >
      ❌ Rejected: {{ lastResult.reason }}
    </div>

    <!-- Draw button (shown when it's a player's draw turn) -->
    <div v-if="!isGameOver && state.turnPhase === 'draw'" class="mb-4">
      <button
        class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold"
        @click="drawTile"
      >
        Draw for {{ state.currentTurn }}
      </button>
    </div>

    <!-- Players grid -->
    <div class="grid grid-cols-2 gap-4">
      <div
        v-for="player in orderedPlayers"
        :key="player.id"
        class="border-2 rounded p-3"
        :class="isCurrentPlayer(player.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'"
      >
        <!-- Player header -->
        <div class="flex items-center gap-2 mb-2">
          <span class="font-bold uppercase">{{ player.id }}</span>
          <span class="text-gray-500">({{ player.seatWind }})</span>
          <span
            v-if="isCurrentPlayer(player.id)"
            class="ml-auto px-2 py-0.5 bg-blue-600 text-white rounded text-xs"
          >
            ▶ TURN
          </span>
        </div>

        <!-- Rack -->
        <div class="mb-2">
          <div class="text-xs text-gray-500 mb-1">Rack ({{ player.rack.length }})</div>
          <div class="flex flex-wrap gap-1">
            <button
              v-for="tile in player.rack"
              :key="tile.id"
              class="px-1.5 py-0.5 border rounded text-xs"
              :class="[
                tileColor(tile.suit),
                isCurrentPlayer(player.id) && state.turnPhase === 'discard' && tile.suit !== 'joker'
                  ? 'border-blue-400 hover:bg-blue-100 cursor-pointer'
                  : 'border-gray-300 cursor-default',
              ]"
              :disabled="!(isCurrentPlayer(player.id) && state.turnPhase === 'discard' && tile.suit !== 'joker')"
              @click="
                isCurrentPlayer(player.id) && state.turnPhase === 'discard' && tile.suit !== 'joker'
                  ? discardTile(player.id, tile.id)
                  : undefined
              "
              :title="tile.id"
            >
              {{ tile.id }}
            </button>
          </div>
        </div>

        <!-- Discard pool -->
        <div>
          <div class="text-xs text-gray-500 mb-1">Discards ({{ player.discardPool.length }})</div>
          <div class="flex flex-wrap gap-1 min-h-4">
            <span
              v-for="tile in player.discardPool"
              :key="tile.id"
              class="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs"
              :class="tileColor(tile.suit)"
            >
              {{ tile.id }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
