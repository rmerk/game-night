<script setup lang="ts">
import { ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { devShowcaseDefs } from "../dev-showcase-routes";
import { includeDevPages } from "../include-dev-pages";
import { getApiBaseUrl } from "../composables/apiBaseUrl";

const showDevEntry = includeDevPages();
const router = useRouter();

const hostName = ref("");
const joinRoomCode = ref("");
const createRoomError = ref<string | null>(null);
const createRoomLoading = ref(false);

async function createRoomAndGo() {
  const name = hostName.value.trim();
  if (!name) {
    createRoomError.value = "Enter your name.";
    return;
  }
  createRoomError.value = null;
  createRoomLoading.value = true;
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostName: name }),
    });
    const data = (await res.json()) as { roomCode?: string; error?: string };
    if (!res.ok) {
      createRoomError.value = data.error ?? `HTTP ${res.status}`;
      return;
    }
    if (!data.roomCode) {
      createRoomError.value = "Invalid response from server.";
      return;
    }
    await router.push({
      name: "room",
      params: { code: data.roomCode },
      query: { name },
    });
  } catch {
    createRoomError.value = "Could not reach the game server. Is it running on port 3001?";
  } finally {
    createRoomLoading.value = false;
  }
}

function joinExistingRoom() {
  const code = joinRoomCode.value.trim().toUpperCase();
  if (code.length !== 6 || !/^[A-Z0-9]{6}$/.test(code)) {
    createRoomError.value = "Enter the 6-character room code.";
    return;
  }
  createRoomError.value = null;
  void router.push({ name: "room", params: { code } });
}
</script>

<template>
  <main
    class="mx-auto flex max-w-lg flex-col justify-center gap-6 px-4 py-12 min-h-screen text-center sm:text-left"
  >
    <div class="flex flex-col gap-2">
      <h1 class="text-4xl font-bold">Mahjong Night</h1>
      <p v-if="showDevEntry" class="text-stone-600 dark:text-stone-400 text-sm leading-relaxed">
        This preview build ships developer showcases (UI experiments and a local engine demo). There
        is no public lobby or multiplayer matchmaking here yet — run
        <code class="rounded bg-stone-200 px-1 py-0.5 text-xs dark:bg-stone-700">vp dev</code>
        locally for full development.
      </p>
      <p v-else class="text-stone-600 dark:text-stone-400 text-sm leading-relaxed">
        Open a room on the local server, then share the link with up to three friends. Run the API
        on port 3001 and the client with
        <code class="rounded bg-stone-200 px-1 py-0.5 text-xs dark:bg-stone-700">vp dev</code>
        .
      </p>
    </div>

    <section class="flex flex-col gap-3 border-t border-stone-200 pt-6 dark:border-stone-700">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-stone-500">Play online</h2>
      <div class="flex flex-col gap-2 text-left max-w-md">
        <label class="text-sm text-stone-600 dark:text-stone-400" for="host-name">Your name</label>
        <input
          id="host-name"
          v-model="hostName"
          type="text"
          maxlength="30"
          class="rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
          placeholder="Host"
          @keydown.enter="createRoomAndGo"
        />
        <button
          type="button"
          class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 dark:bg-blue-500 dark:hover:bg-blue-400"
          :disabled="createRoomLoading"
          @click="createRoomAndGo"
        >
          {{ createRoomLoading ? "Creating…" : "Create room" }}
        </button>
        <p v-if="createRoomError" class="text-sm text-red-600 dark:text-red-400">
          {{ createRoomError }}
        </p>
        <p class="text-xs text-stone-500 dark:text-stone-400">
          After creating, you will join as host. Other players enter the room code below.
        </p>
        <label class="mt-4 text-sm text-stone-600 dark:text-stone-400" for="join-code"
          >Join existing room</label
        >
        <div class="flex flex-wrap gap-2">
          <input
            id="join-code"
            v-model="joinRoomCode"
            type="text"
            maxlength="6"
            class="w-36 rounded-md border border-stone-300 bg-white px-3 py-2 font-mono uppercase tracking-wide text-stone-900 dark:border-stone-600 dark:bg-stone-900 dark:text-stone-100"
            placeholder="ABC12D"
            autocapitalize="characters"
            @keydown.enter="joinExistingRoom"
          />
          <button
            type="button"
            class="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-800 hover:bg-stone-100 dark:border-stone-600 dark:text-stone-100 dark:hover:bg-stone-800"
            @click="joinExistingRoom"
          >
            Join room
          </button>
        </div>
      </div>
    </section>

    <section
      v-if="showDevEntry"
      class="flex flex-col gap-3 border-t border-stone-200 pt-6 dark:border-stone-700"
    >
      <h2 class="text-sm font-semibold uppercase tracking-wide text-stone-500">Dev showcases</h2>
      <ul class="flex flex-col gap-3 text-left">
        <li v-for="d in devShowcaseDefs" :key="d.path">
          <RouterLink
            :to="d.path"
            class="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {{ d.label }}
          </RouterLink>
          <p class="text-stone-600 dark:text-stone-400 mt-0.5 text-xs leading-relaxed">
            {{ d.blurb }}
          </p>
        </li>
      </ul>
    </section>
  </main>
</template>
