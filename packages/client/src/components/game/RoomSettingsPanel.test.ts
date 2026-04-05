import { describe, it, expect } from "vite-plus/test";
import { mount, flushPromises } from "@vue/test-utils";
import { DEFAULT_ROOM_SETTINGS } from "@mahjong-game/shared";
import RoomSettingsPanel from "./RoomSettingsPanel.vue";

describe("RoomSettingsPanel (4B.7)", () => {
  it("emits single-key patches from selects", async () => {
    const wrapper = mount(RoomSettingsPanel, {
      props: {
        settings: DEFAULT_ROOM_SETTINGS,
        canEdit: true,
        phase: "lobby",
      },
    });
    await wrapper.get('[data-testid="room-settings-joker-rules"]').setValue("simplified");
    await flushPromises();
    const ev = wrapper.emitted("change");
    expect(ev?.length).toBeGreaterThanOrEqual(1);
    expect(ev?.[ev.length - 1]?.[0]).toEqual({ jokerRulesMode: "simplified" });
  });

  it("disables controls when canEdit is false", () => {
    const wrapper = mount(RoomSettingsPanel, {
      props: {
        settings: DEFAULT_ROOM_SETTINGS,
        canEdit: false,
        phase: "scoreboard",
      },
    });
    expect(wrapper.get('[data-testid="room-settings-timer-mode"]').element).toHaveProperty(
      "disabled",
      true,
    );
    expect(wrapper.find('[data-testid="room-settings-locked-note"]').exists()).toBe(true);
  });

  it("disables duration input when timerMode is none", () => {
    const wrapper = mount(RoomSettingsPanel, {
      props: {
        settings: { ...DEFAULT_ROOM_SETTINGS, timerMode: "none" },
        canEdit: true,
        phase: "lobby",
      },
    });
    expect(wrapper.get('[data-testid="room-settings-turn-duration"]').element).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("does not show locked note in lobby when non-host", () => {
    const wrapper = mount(RoomSettingsPanel, {
      props: {
        settings: DEFAULT_ROOM_SETTINGS,
        canEdit: false,
        phase: "lobby",
      },
    });
    expect(wrapper.find('[data-testid="room-settings-locked-note"]').exists()).toBe(false);
  });
});
