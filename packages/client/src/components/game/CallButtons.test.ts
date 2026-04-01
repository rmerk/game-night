import { describe, it, expect } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import CallButtons from "./CallButtons.vue";
import type { CallType } from "@mahjong-game/shared";

function mountCallButtons(
  props: {
    validCalls?: CallType[];
    callWindowStatus?: "open" | "frozen" | "confirming";
  } = {},
) {
  return mount(CallButtons, {
    props: {
      validCalls: props.validCalls ?? [],
      callWindowStatus: props.callWindowStatus ?? "open",
    },
    global: {
      plugins: [createPinia()],
    },
  });
}

describe("CallButtons — valid-only rendering", () => {
  it("renders only valid call buttons plus Pass", () => {
    const wrapper = mountCallButtons({ validCalls: ["pung", "kong"] });
    expect(wrapper.find("[data-testid='call-pung']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='call-kong']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='call-pass']").exists()).toBe(true);
    // Should not render other call types
    expect(wrapper.find("[data-testid='call-quint']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='call-mahjong']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='call-news']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='call-dragon_set']").exists()).toBe(false);
  });

  it("renders Mahjong first when present among valid calls", () => {
    const wrapper = mountCallButtons({ validCalls: ["pung", "mahjong", "kong"] });
    const buttons = wrapper.findAll("button");
    // Mahjong should be first, Pass should be last
    expect(buttons[0].text()).toBe("Mahjong");
    expect(buttons[buttons.length - 1].text()).toBe("Pass");
  });

  it("renders all six call types when all are valid", () => {
    const allCalls: CallType[] = ["pung", "kong", "quint", "news", "dragon_set", "mahjong"];
    const wrapper = mountCallButtons({ validCalls: allCalls });
    expect(wrapper.find("[data-testid='call-pung']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='call-kong']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='call-quint']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='call-news']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='call-dragon_set']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='call-mahjong']").exists()).toBe(true);
    expect(wrapper.find("[data-testid='call-pass']").exists()).toBe(true);
  });

  it("does not render grayed-out or disabled buttons", () => {
    const wrapper = mountCallButtons({ validCalls: ["pung"] });
    const buttons = wrapper.findAll("button");
    buttons.forEach((btn) => {
      expect(btn.attributes("disabled")).toBeUndefined();
    });
  });
});

describe("CallButtons — pass-only fallback", () => {
  it("renders only Pass button when no valid calls", () => {
    const wrapper = mountCallButtons({ validCalls: [] });
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].text()).toBe("Pass");
    expect(wrapper.find("[data-testid='call-pass']").exists()).toBe(true);
  });

  it("focuses the Pass button when it is the only available action", async () => {
    const wrapper = mount(CallButtons, {
      attachTo: document.body,
      props: {
        validCalls: [],
        callWindowStatus: "open",
      },
      global: {
        plugins: [createPinia()],
      },
    });

    const passButton = wrapper.get("[data-testid='call-pass']");
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(passButton.element);

    wrapper.unmount();
  });
});

describe("CallButtons — event emissions", () => {
  it("emits call event with call type when call button clicked", async () => {
    const wrapper = mountCallButtons({ validCalls: ["pung", "kong"] });
    await wrapper.find("[data-testid='call-pung']").trigger("click");
    expect(wrapper.emitted("call")).toEqual([["pung"]]);
  });

  it("emits call event for kong", async () => {
    const wrapper = mountCallButtons({ validCalls: ["kong"] });
    await wrapper.find("[data-testid='call-kong']").trigger("click");
    expect(wrapper.emitted("call")).toEqual([["kong"]]);
  });

  it("emits call event for mahjong", async () => {
    const wrapper = mountCallButtons({ validCalls: ["mahjong"] });
    await wrapper.find("[data-testid='call-mahjong']").trigger("click");
    expect(wrapper.emitted("call")).toEqual([["mahjong"]]);
  });

  it("emits pass event when Pass button clicked", async () => {
    const wrapper = mountCallButtons({ validCalls: ["pung"] });
    await wrapper.find("[data-testid='call-pass']").trigger("click");
    expect(wrapper.emitted("pass")).toBeTruthy();
    expect(wrapper.emitted("pass")).toHaveLength(1);
  });

  it("emits pass event even when no valid calls", async () => {
    const wrapper = mountCallButtons({ validCalls: [] });
    await wrapper.find("[data-testid='call-pass']").trigger("click");
    expect(wrapper.emitted("pass")).toHaveLength(1);
  });
});

describe("CallButtons — accessibility", () => {
  it("wraps buttons in aria-live assertive region", () => {
    const wrapper = mountCallButtons({ validCalls: ["pung"] });
    const liveRegion = wrapper.find("[aria-live='assertive']");
    expect(liveRegion.exists()).toBe(true);
    // Buttons should be inside the live region
    expect(liveRegion.findAll("button").length).toBeGreaterThan(0);
  });

  it("all buttons are <button> elements with aria-labels", () => {
    const wrapper = mountCallButtons({ validCalls: ["pung", "kong"] });
    const buttons = wrapper.findAll("button");
    buttons.forEach((btn) => {
      expect(btn.attributes("aria-label")).toBeTruthy();
    });
  });

  it("call buttons have descriptive aria-labels", () => {
    const wrapper = mountCallButtons({ validCalls: ["pung", "mahjong"] });
    expect(wrapper.find("[data-testid='call-pung']").attributes("aria-label")).toBe("Call Pung");
    expect(wrapper.find("[data-testid='call-mahjong']").attributes("aria-label")).toBe(
      "Call Mahjong",
    );
  });

  it("pass button has descriptive aria-label", () => {
    const wrapper = mountCallButtons({ validCalls: [] });
    expect(wrapper.find("[data-testid='call-pass']").attributes("aria-label")).toBe("Pass on call");
  });

  it("buttons meet 44px minimum height", () => {
    const wrapper = mountCallButtons({ validCalls: ["pung"] });
    const buttons = wrapper.findAll("button");
    buttons.forEach((btn) => {
      // Check for min-h-11 class (44px)
      expect(btn.classes().some((c: string) => c.includes("min-h-11"))).toBe(true);
    });
  });
});

describe("CallButtons — button labels", () => {
  it("displays correct labels for each call type", () => {
    const wrapper = mountCallButtons({
      validCalls: ["pung", "kong", "quint", "news", "dragon_set", "mahjong"],
    });
    expect(wrapper.find("[data-testid='call-pung']").text()).toBe("Pung");
    expect(wrapper.find("[data-testid='call-kong']").text()).toBe("Kong");
    expect(wrapper.find("[data-testid='call-quint']").text()).toBe("Quint");
    expect(wrapper.find("[data-testid='call-news']").text()).toBe("NEWS");
    expect(wrapper.find("[data-testid='call-dragon_set']").text()).toBe("Dragons");
    expect(wrapper.find("[data-testid='call-mahjong']").text()).toBe("Mahjong");
  });
});

describe("CallButtons — exit animation", () => {
  it("exit animation is owned by parent GameTable via Transition wrapper", () => {
    // CallButtons is a pure renderer — the <Transition> wrapping it lives in GameTable
    // so that the leave animation fires when the parent unmounts CallButtons.
    // See GameTable.test.ts for integration-level exit animation verification.
    const wrapper = mountCallButtons({ validCalls: ["pung"] });
    expect(wrapper.find(".call-buttons").exists()).toBe(true);
  });
});

describe("CallButtons — button ordering", () => {
  it("orders Mahjong first, then other calls, then Pass last", () => {
    const wrapper = mountCallButtons({ validCalls: ["pung", "mahjong", "kong"] });
    const buttons = wrapper.findAll("button");
    const labels = buttons.map((b) => b.text());
    expect(labels[0]).toBe("Mahjong");
    expect(labels[labels.length - 1]).toBe("Pass");
  });

  it("maintains Pung, Kong, Quint, NEWS, Dragons order for non-mahjong calls", () => {
    const wrapper = mountCallButtons({
      validCalls: ["dragon_set", "pung", "news", "quint", "kong"],
    });
    const buttons = wrapper.findAll("button");
    const labels = buttons.map((b) => b.text());
    // Should be: Pung, Kong, Quint, NEWS, Dragons, Pass
    expect(labels).toEqual(["Pung", "Kong", "Quint", "NEWS", "Dragons", "Pass"]);
  });
});

describe("CallButtons — styling", () => {
  it("call buttons use Urgent tier styling (call-window background, white text)", () => {
    const wrapper = mountCallButtons({ validCalls: ["pung"] });
    const pungBtn = wrapper.find("[data-testid='call-pung']");
    expect(pungBtn.classes().some((c: string) => c.includes("bg-state-call-window"))).toBe(true);
    expect(pungBtn.classes().some((c: string) => c.includes("text-white"))).toBe(true);
  });

  it("pass button uses Secondary tier styling (chrome background, border)", () => {
    const wrapper = mountCallButtons({ validCalls: ["pung"] });
    const passBtn = wrapper.find("[data-testid='call-pass']");
    expect(passBtn.classes().some((c: string) => c.includes("bg-chrome-surface"))).toBe(true);
    expect(passBtn.classes().some((c: string) => c.includes("border"))).toBe(true);
  });
});
