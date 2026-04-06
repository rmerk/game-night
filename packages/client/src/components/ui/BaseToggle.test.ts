import { describe, expect, it } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import BaseToggle from "./BaseToggle.vue";

describe("BaseToggle", () => {
  it("renders switch with aria-checked matching modelValue", () => {
    const on = mount(BaseToggle, {
      props: { modelValue: true, ariaLabel: "Test switch" },
    });
    const btn = on.find('[role="switch"]');
    expect(btn.attributes("aria-checked")).toBe("true");

    const off = mount(BaseToggle, {
      props: { modelValue: false, ariaLabel: "Test switch" },
    });
    expect(off.find('[role="switch"]').attributes("aria-checked")).toBe("false");
  });

  it("toggles on click and emits update:modelValue", async () => {
    const wrapper = mount(BaseToggle, {
      props: { modelValue: false, ariaLabel: "Timer" },
    });
    await wrapper.find('[role="switch"]').trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([[true]]);
  });

  it("does not emit when disabled", async () => {
    const wrapper = mount(BaseToggle, {
      props: { modelValue: false, disabled: true, ariaLabel: "X" },
    });
    await wrapper.find('[role="switch"]').trigger("click");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("toggles on Space and Enter", async () => {
    const wrapper = mount(BaseToggle, {
      props: { modelValue: false, ariaLabel: "X" },
    });
    const btn = wrapper.find('[role="switch"]');
    await btn.trigger("keydown", { key: " " });
    expect(wrapper.emitted("update:modelValue")).toEqual([[true]]);
    await wrapper.setProps({ modelValue: true });
    await btn.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([false]);
  });

  it("shows label when provided", () => {
    const wrapper = mount(BaseToggle, {
      props: { modelValue: false, label: "Timed turns" },
    });
    expect(wrapper.text()).toContain("Timed turns");
  });

  it("omits aria-label on the switch when a visible label is provided", () => {
    const wrapper = mount(BaseToggle, {
      props: { modelValue: false, label: "Timed turns" },
    });
    expect(wrapper.find('[role="switch"]').attributes("aria-label")).toBeUndefined();
  });

  it("uses explicit ariaLabel when provided alongside label", () => {
    const wrapper = mount(BaseToggle, {
      props: {
        modelValue: false,
        label: "Allow hand guidance",
        ariaLabel: "Allow hand guidance for all players",
      },
    });
    expect(wrapper.find('[role="switch"]').attributes("aria-label")).toBe(
      "Allow hand guidance for all players",
    );
  });
});
