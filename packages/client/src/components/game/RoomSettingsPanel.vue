<script setup lang="ts">
/**
 * Room settings — timer, Joker rules, dealing style, hand guidance (4B.7, 5B.6).
 * Emits single-key patches; server is authoritative.
 */
import { computed } from "vue";
import { useDebounceFn } from "@vueuse/core";
import type { GamePhase, RoomSettings } from "@mahjong-game/shared";
import BaseToggle from "../ui/BaseToggle.vue";
import BaseNumberStepper from "../ui/BaseNumberStepper.vue";

const props = withDefaults(
  defineProps<{
    settings: RoomSettings;
    canEdit: boolean;
    phase: GamePhase | "lobby";
    /** Hide top title when the parent already provides a panel header (e.g. slide-in). */
    embedded?: boolean;
  }>(),
  { embedded: false },
);

const emit = defineEmits<{
  change: [patch: Partial<RoomSettings>];
}>();

const debouncedDuration = useDebounceFn((sec: number) => {
  emit("change", { turnDurationMs: sec * 1000 });
}, 300);

const timerTimed = computed({
  get: () => props.settings.timerMode === "timed",
  set: (v: boolean) => {
    emit("change", { timerMode: v ? "timed" : "none" });
  },
});

const jokerSimplified = computed({
  get: () => props.settings.jokerRulesMode === "simplified",
  set: (v: boolean) => {
    emit("change", { jokerRulesMode: v ? "simplified" : "standard" });
  },
});

const dealingAnimated = computed({
  get: () => props.settings.dealingStyle === "animated",
  set: (v: boolean) => {
    emit("change", { dealingStyle: v ? "animated" : "instant" });
  },
});

const handGuidanceOn = computed({
  get: () => props.settings.handGuidanceEnabled,
  set: (v: boolean) => {
    emit("change", { handGuidanceEnabled: v });
  },
});

const durationSeconds = computed({
  get: () => Math.round(props.settings.turnDurationMs / 1000),
  set: (sec: number) => {
    debouncedDuration(sec);
  },
});

const showLockedNote = computed(() => !props.canEdit && props.phase !== "lobby");

const showHeading = computed(() => !props.embedded);

const controlsDisabled = computed(() => !props.canEdit);
</script>

<template>
  <div
    data-testid="room-settings-panel"
    class="rounded-md border border-chrome-border bg-chrome-surface/90 text-text-primary"
  >
    <h2
      v-if="showHeading"
      class="border-b border-chrome-border px-3 py-2 text-interactive text-3.5 font-semibold"
    >
      Room settings
    </h2>
    <div class="space-y-4 px-3 py-3 text-3.5">
      <p
        v-if="showLockedNote"
        data-testid="room-settings-locked-note"
        class="text-3 text-text-secondary"
      >
        Settings are locked during play
      </p>

      <BaseToggle v-model="timerTimed" :disabled="controlsDisabled" label="Timed turns" />
      <p class="text-3 text-text-secondary">
        When off, there is no turn timer. When on, use the duration below.
      </p>

      <BaseNumberStepper
        v-model="durationSeconds"
        :min="15"
        :max="30"
        :step="5"
        :disabled="controlsDisabled || settings.timerMode === 'none'"
        label="Turn duration (seconds)"
      />

      <div>
        <p class="mb-2 text-text-secondary">Joker rules</p>
        <BaseToggle
          v-model="jokerSimplified"
          :disabled="controlsDisabled"
          label="Simplified joker rules"
        />
        <p class="mt-1 text-3 text-text-secondary">Off: NMJL standard. On: simplified option.</p>
      </div>

      <div>
        <p class="mb-2 text-text-secondary">Dealing style</p>
        <BaseToggle
          v-model="dealingAnimated"
          :disabled="controlsDisabled"
          label="Animated traditional dealing"
        />
        <p class="mt-1 text-3 text-text-secondary">
          Off: tiles appear instantly. On: wall build, dice, and deal animation at hand start.
        </p>
      </div>

      <div>
        <p class="mb-2 text-text-secondary">Hand guidance (NMJL card hints)</p>
        <BaseToggle
          v-model="handGuidanceOn"
          :disabled="controlsDisabled"
          label="Allow hand guidance"
          aria-label="Allow hand guidance for all players"
        />
      </div>
    </div>
  </div>
</template>
