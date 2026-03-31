import { describe, expect, it } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import InvalidMahjongNotification from "./InvalidMahjongNotification.vue";

function mountNotification(
  props: {
    visible?: boolean;
    message?: string;
  } = {},
) {
  return mount(InvalidMahjongNotification, {
    props: {
      visible: props.visible ?? false,
      message: props.message ?? "Invalid Mahjong declaration.",
    },
    global: {
      stubs: {
        Transition: false,
      },
    },
  });
}

describe("InvalidMahjongNotification", () => {
  it("renders notification text when visible", () => {
    const wrapper = mountNotification({
      visible: true,
      message: "Your hand is not a valid Mahjong.",
    });

    expect(wrapper.get("[data-testid='invalid-mahjong-notification']").text()).toContain(
      "Your hand is not a valid Mahjong.",
    );
  });

  it("does not render when not visible", () => {
    const wrapper = mountNotification({ visible: false });
    expect(wrapper.find("[data-testid='invalid-mahjong-notification']").exists()).toBe(false);
  });

  it("emits cancel when the Cancel button is clicked", async () => {
    const wrapper = mountNotification({ visible: true });

    await wrapper.get("[data-testid='cancel-mahjong']").trigger("click");

    expect(wrapper.emitted("cancel")).toEqual([[]]);
  });

  it("has an aria-live region and semantic cancel button", () => {
    const wrapper = mountNotification({ visible: true });
    const notification = wrapper.get("[data-testid='invalid-mahjong-notification']");
    const cancelButton = wrapper.get("[data-testid='cancel-mahjong']");

    expect(notification.attributes("aria-live")).toBe("polite");
    expect(cancelButton.element.tagName).toBe("BUTTON");
    expect(cancelButton.text()).toBe("Cancel");
  });
});
