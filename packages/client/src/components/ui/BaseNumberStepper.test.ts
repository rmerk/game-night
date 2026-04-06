import { describe, expect, it } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import BaseNumberStepper from "./BaseNumberStepper.vue";

describe("BaseNumberStepper", () => {
  it("renders value and spinbutton attributes", () => {
    const wrapper = mount(BaseNumberStepper, {
      props: { modelValue: 20, min: 15, max: 30, step: 5, ariaLabel: "Seconds" },
    });
    const spin = wrapper.find('[role="spinbutton"]');
    expect(spin.attributes("aria-valuenow")).toBe("20");
    expect(spin.attributes("aria-valuemin")).toBe("15");
    expect(spin.attributes("aria-valuemax")).toBe("30");
    expect(wrapper.text()).toContain("20");
  });

  it("increments and decrements by step", async () => {
    const wrapper = mount(BaseNumberStepper, {
      props: { modelValue: 20, min: 15, max: 30, step: 5, ariaLabel: "Sec" },
    });
    await wrapper.findAll("button")[1].trigger("click");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([25]);
    await wrapper.setProps({ modelValue: 25 });
    await wrapper.findAll("button")[0].trigger("click");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([20]);
  });

  it("clamps to min and max", async () => {
    const low = mount(BaseNumberStepper, {
      props: { modelValue: 15, min: 15, max: 30, step: 5, ariaLabel: "S" },
    });
    await low.findAll("button")[0].trigger("click");
    expect(low.emitted("update:modelValue")).toBeUndefined();

    const high = mount(BaseNumberStepper, {
      props: { modelValue: 30, min: 15, max: 30, step: 5, ariaLabel: "S" },
    });
    await high.findAll("button")[1].trigger("click");
    expect(high.emitted("update:modelValue")).toBeUndefined();
  });

  it("does not emit when disabled", async () => {
    const wrapper = mount(BaseNumberStepper, {
      props: {
        modelValue: 20,
        min: 15,
        max: 30,
        step: 5,
        disabled: true,
        ariaLabel: "S",
      },
    });
    await wrapper.findAll("button")[1].trigger("click");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("removes spinbutton from tab order when disabled", () => {
    const wrapper = mount(BaseNumberStepper, {
      props: {
        modelValue: 20,
        min: 15,
        max: 30,
        step: 5,
        disabled: true,
        ariaLabel: "S",
      },
    });
    expect(wrapper.find('[role="spinbutton"]').attributes("tabindex")).toBe("-1");
  });

  it("ArrowUp and ArrowDown adjust value", async () => {
    const wrapper = mount(BaseNumberStepper, {
      props: { modelValue: 20, min: 15, max: 30, step: 5, ariaLabel: "S" },
    });
    const spin = wrapper.find('[role="spinbutton"]');
    await spin.trigger("keydown", { key: "ArrowUp" });
    expect(wrapper.emitted("update:modelValue")).toEqual([[25]]);
    await wrapper.setProps({ modelValue: 25 });
    await spin.trigger("keydown", { key: "ArrowDown" });
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([20]);
  });
});
