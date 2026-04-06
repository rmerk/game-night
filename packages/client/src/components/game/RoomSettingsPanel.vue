<script setup lang="ts">
/**
 * Collapsible host room settings — timer, Joker rules, dealing style (Story 4B.7).
 * Emits single-key patches; server is authoritative.
 */
import { computed } from "vue";
import { useDebounceFn } from "@vueuse/core";
import type { GamePhase, RoomSettings } from "@mahjong-game/shared";

const props = defineProps<{
  settings: RoomSettings;
  canEdit: boolean;
  phase: GamePhase | "lobby";
}>();

const emit = defineEmits<{
  change: [patch: Partial<RoomSettings>];
}>();

const debouncedDuration = useDebounceFn((sec: number) => {
  emit("change", { turnDurationMs: sec * 1000 });
}, 300);

function onTimerModeChange(ev: Event) {
  const v = (ev.target as HTMLSelectElement).value;
  if (v !== "timed" && v !== "none") return;
  emit("change", { timerMode: v });
}

function onDurationInput(ev: Event) {
  const raw = Number((ev.target as HTMLInputElement).value);
  if (!Number.isFinite(raw)) return;
  debouncedDuration(raw);
}

function onJokerChange(ev: Event) {
  const v = (ev.target as HTMLSelectElement).value;
  if (v !== "standard" && v !== "simplified") return;
  emit("change", { jokerRulesMode: v });
}

function onDealingChange(ev: Event) {
  const v = (ev.target as HTMLSelectElement).value;
  if (v !== "instant" && v !== "animated") return;
  emit("change", { dealingStyle: v });
}

function onHandGuidanceChange(ev: Event) {
  const v = (ev.target as HTMLSelectElement).value;
  if (v !== "on" && v !== "off") return;
  emit("change", { handGuidanceEnabled: v === "on" });
}

const showLockedNote = computed(() => !props.canEdit && props.phase !== "lobby");
</script>

<template>
  <details
    data-testid="room-settings-panel"
    class="rounded-md border border-chrome-border bg-chrome-surface/90 text-text-primary"
  >
    <summary
      class="cursor-pointer select-none px-3 py-2 text-3.5 font-medium focus-visible:focus-ring-on-chrome"
    >
      Room settings
    </summary>
    <div class="space-y-3 border-t border-chrome-border px-3 py-3 text-3.5">
      <p
        v-if="showLockedNote"
        data-testid="room-settings-locked-note"
        class="text-3 text-text-secondary"
      >
        Settings are locked during play
      </p>

      <div>
        <label class="mb-1 block text-text-secondary" for="room-settings-timer-mode"
          >Timer mode</label
        >
        <select
          id="room-settings-timer-mode"
          data-testid="room-settings-timer-mode"
          class="w-full rounded-md border border-chrome-border bg-chrome-surface px-3 py-2"
          :disabled="!canEdit"
          :value="settings.timerMode"
          @change="onTimerModeChange"
        >
          <option value="timed">Timed turns</option>
          <option value="none">No timer</option>
        </select>
      </div>

      <div>
        <label class="mb-1 block text-text-secondary" for="room-settings-turn-duration"
          >Turn duration (seconds)</label
        >
        <input
          id="room-settings-turn-duration"
          data-testid="room-settings-turn-duration"
          type="number"
          min="15"
          max="30"
          step="1"
          class="w-full rounded-md border border-chrome-border bg-chrome-surface px-3 py-2"
          :disabled="!canEdit || settings.timerMode === 'none'"
          :value="Math.round(settings.turnDurationMs / 1000)"
          @input="onDurationInput"
        />
      </div>

      <div>
        <label class="mb-1 block text-text-secondary" for="room-settings-joker-rules"
          >Joker rules</label
        >
        <select
          id="room-settings-joker-rules"
          data-testid="room-settings-joker-rules"
          class="w-full rounded-md border border-chrome-border bg-chrome-surface px-3 py-2"
          :disabled="!canEdit"
          :value="settings.jokerRulesMode"
          @change="onJokerChange"
        >
          <option value="standard">Standard</option>
          <option value="simplified">Simplified</option>
        </select>
      </div>

      <div>
        <label class="mb-1 block text-text-secondary" for="room-settings-dealing-style"
          >Dealing style</label
        >
        <select
          id="room-settings-dealing-style"
          data-testid="room-settings-dealing-style"
          class="w-full rounded-md border border-chrome-border bg-chrome-surface px-3 py-2"
          :disabled="!canEdit"
          :value="settings.dealingStyle"
          @change="onDealingChange"
        >
          <option value="instant">Instant</option>
          <option value="animated">Animated traditional</option>
        </select>
      </div>

      <div>
        <label class="mb-1 block text-text-secondary" for="room-settings-hand-guidance"
          >Hand guidance (NMJL card hints)</label
        >
        <select
          id="room-settings-hand-guidance"
          data-testid="room-settings-hand-guidance"
          class="w-full rounded-md border border-chrome-border bg-chrome-surface px-3 py-2"
          :disabled="!canEdit"
          :value="settings.handGuidanceEnabled ? 'on' : 'off'"
          @change="onHandGuidanceChange"
        >
          <option value="on">Allowed</option>
          <option value="off">Off for everyone</option>
        </select>
      </div>
    </div>
  </details>
</template>
