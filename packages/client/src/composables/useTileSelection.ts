import {
  computed,
  shallowRef,
  toValue,
  type ComputedRef,
  type MaybeRefOrGetter,
  type Ref,
} from "vue";

/**
 * Generic "select N distinct items" state for Charleston, call confirmation, joker exchange, etc.
 * Does not use rackStore.selectedTileId (play-phase discard).
 */
export function useTileSelection(targetCount: MaybeRefOrGetter<number>) {
  const selectedIds = shallowRef(new Set<string>());

  const count = computed(() => selectedIds.value.size);
  const target = computed(() => toValue(targetCount));

  const isComplete = computed(() => {
    const t = target.value;
    if (t <= 0) {
      return true;
    }
    return count.value >= t;
  });

  const progressText = computed(() => {
    const t = target.value;
    if (t <= 0) {
      return "No tiles to select";
    }
    return `${count.value} of ${t} selected`;
  });

  /** Ordered tile ids when selection satisfies target; empty until complete (per story spec). */
  const confirmedIds: ComputedRef<string[]> = computed(() => {
    if (!isComplete.value) {
      return [];
    }
    return [...selectedIds.value];
  });

  function toggleTile(id: string) {
    const t = target.value;
    if (t <= 0) {
      return;
    }

    const next = new Set(selectedIds.value);
    if (next.has(id)) {
      next.delete(id);
      selectedIds.value = next;
      return;
    }

    if (next.size >= t) {
      return;
    }

    next.add(id);
    selectedIds.value = next;
  }

  function reset() {
    selectedIds.value = new Set();
  }

  function cancel() {
    reset();
  }

  return {
    selectedIds: selectedIds as Ref<Set<string>>,
    isComplete,
    progressText,
    confirmedIds,
    toggleTile,
    reset,
    cancel,
  };
}
