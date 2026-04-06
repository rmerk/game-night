import { describe, it, expect, beforeEach } from "vite-plus/test";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { loadCard, type GuidanceResult } from "@mahjong-game/shared";
import NMJLCardPanel from "./NMJLCardPanel.vue";

describe("NMJLCardPanel", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  function mountPanel() {
    return mount(NMJLCardPanel, {
      props: { onEscapeFocusTarget: () => {} },
    });
  }

  it("renders all 7 categories from 2026 card data", () => {
    const card = loadCard("2026");
    expect(card.categories).toHaveLength(7);

    const wrapper = mountPanel();
    for (const cat of card.categories) {
      expect(wrapper.text()).toContain(cat.name);
    }
  });

  it("renders 54 hand patterns", () => {
    const card = loadCard("2026");
    const total = card.categories.reduce((n, c) => n + c.hands.length, 0);
    expect(total).toBe(54);

    const wrapper = mountPanel();
    const rows = wrapper.findAll("[data-testid^='nmjl-hand-row-']");
    expect(rows.length).toBe(54);
  });

  it("shows point value and C/X exposure on each row", () => {
    const wrapper = mountPanel();
    const firstRow = wrapper.find("[data-testid='nmjl-hand-row-ev-1']");
    expect(firstRow.text()).toContain("25");
    expect(firstRow.text()).toMatch(/C|X/);
  });

  it("opens detail view with group breakdown when a hand row is activated", async () => {
    const wrapper = mountPanel();
    await wrapper.find("[data-testid='nmjl-hand-row-ev-1']").trigger("click");
    expect(wrapper.find("[data-testid='hand-pattern-detail']").exists()).toBe(true);
    expect(wrapper.text()).toContain("Joker");
  });

  it("shows Joker eligibility per group in detail", async () => {
    const wrapper = mountPanel();
    await wrapper.find("[data-testid='nmjl-hand-row-ev-1']").trigger("click");
    expect(wrapper.text()).toContain("Joker OK");
    expect(wrapper.text()).toContain("No joker");
  });

  it("returns to list when Back is clicked", async () => {
    const wrapper = mountPanel();
    await wrapper.find("[data-testid='nmjl-hand-row-ev-1']").trigger("click");
    expect(wrapper.find("[data-testid='hand-pattern-detail']").exists()).toBe(true);
    await wrapper.find("[data-testid='nmjl-detail-back']").trigger("click");
    expect(wrapper.find("[data-testid='hand-pattern-detail']").exists()).toBe(false);
  });

  it("emits close when header Close is clicked", async () => {
    const wrapper = mountPanel();
    await wrapper.find("[data-testid='nmjl-card-panel-close']").trigger("click");
    expect(wrapper.emitted("close")).toBeTruthy();
  });

  it("closes detail first when Escape and detail is open", async () => {
    const wrapper = mountPanel();
    await wrapper.find("[data-testid='nmjl-hand-row-ev-1']").trigger("click");
    const ev = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    document.dispatchEvent(ev);
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[data-testid='hand-pattern-detail']").exists()).toBe(false);
    expect(wrapper.emitted("close")).toBeFalsy();
  });

  it("emits close on Escape when detail is not open", async () => {
    const wrapper = mountPanel();
    const ev = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
    document.dispatchEvent(ev);
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("close")?.length).toBe(1);
  });

  it("category headers use heading role and level", () => {
    const wrapper = mountPanel();
    const headings = wrapper.findAll('[role="heading"][aria-level="3"]');
    expect(headings.length).toBe(7);
  });

  it("lists hand patterns with native list semantics per category", () => {
    const card = loadCard("2026");
    const wrapper = mountPanel();
    const lists = wrapper.findAll(".nmjl-card-panel__scroll ul");
    expect(lists.length).toBe(card.categories.length);
    for (const list of lists) {
      expect(list.attributes("role")).not.toBe("presentation");
    }
    const items = wrapper.findAll(".nmjl-card-panel__scroll ul li");
    expect(items.length).toBe(54);
    expect(items[0]?.attributes("role")).not.toBe("presentation");
  });

  it("shows only achievable rows when guidance is active (5B.2)", () => {
    const m = new Map<string, GuidanceResult>([
      ["ev-1", { patternId: "ev-1", distance: 1, achievable: true }],
    ]);
    const wrapper = mount(NMJLCardPanel, {
      props: {
        guidanceActive: true,
        guidanceByHandId: m,
        onEscapeFocusTarget: () => {},
      },
    });
    const rows = wrapper.findAll("[data-testid^='nmjl-hand-row-']");
    expect(rows.length).toBe(1);
    expect(wrapper.find('[data-testid="nmjl-hand-row-ev-1"]').exists()).toBe(true);
  });

  it("applies guidance-achievable class for close-band distance (5B.2)", () => {
    const m = new Map<string, GuidanceResult>([
      ["ev-1", { patternId: "ev-1", distance: 2, achievable: true }],
    ]);
    const wrapper = mount(NMJLCardPanel, {
      props: {
        guidanceActive: true,
        guidanceByHandId: m,
        onEscapeFocusTarget: () => {},
      },
    });
    const btn = wrapper.find('[data-testid="nmjl-hand-row-ev-1"]');
    const li = btn.element.parentElement as HTMLElement;
    expect(li.className).toMatch(/guidance-achievable/);
  });

  it("applies guidance-distant class for far-band distance (5B.2)", () => {
    const m = new Map<string, GuidanceResult>([
      ["ev-1", { patternId: "ev-1", distance: 4, achievable: true }],
    ]);
    const wrapper = mount(NMJLCardPanel, {
      props: {
        guidanceActive: true,
        guidanceByHandId: m,
        onEscapeFocusTarget: () => {},
      },
    });
    const btn = wrapper.find('[data-testid="nmjl-hand-row-ev-1"]');
    const li = btn.element.parentElement as HTMLElement;
    expect(li.className).toMatch(/guidance-distant/);
  });
});
