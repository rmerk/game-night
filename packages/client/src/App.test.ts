import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test";
import { mount, flushPromises } from "@vue/test-utils";
import { reactive } from "vue";
import { setActivePinia, createPinia } from "pinia";
import App from "./App.vue";

// ─── Mock vue-router ──────────────────────────────────────────────────────────

vi.mock("vue-router", () => ({
  RouterView: { template: "<div />" },
}));

// ─── Mock usePreferencesStore ─────────────────────────────────────────────────

const mockPrefsStore = reactive({
  darkMode: "auto" as "auto" | "light" | "dark",
});

vi.mock("./stores/preferences", () => ({
  usePreferencesStore: () => mockPrefsStore,
}));

// ─── matchMedia stub helper ───────────────────────────────────────────────────

function stubMatchMedia(systemIsDark: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: systemIsDark && query.includes("dark"),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    media: query,
    onchange: null,
  }));
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

let wrapper: ReturnType<typeof mount>;

beforeEach(() => {
  setActivePinia(createPinia());
  // Clean up any lingering class from previous tests
  document.documentElement.classList.remove("theme-dark");
});

afterEach(() => {
  wrapper?.unmount();
  document.documentElement.classList.remove("theme-dark");
  vi.unstubAllGlobals();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("App.vue — dark mode class toggling on document.documentElement", () => {
  it("darkMode='dark' → adds theme-dark class", async () => {
    mockPrefsStore.darkMode = "dark";
    stubMatchMedia(false);

    wrapper = mount(App, { global: { stubs: { RouterView: true } } });
    await flushPromises();

    expect(document.documentElement.classList.contains("theme-dark")).toBe(true);
  });

  it("darkMode='light' → does NOT add theme-dark class", async () => {
    mockPrefsStore.darkMode = "light";
    stubMatchMedia(false);

    wrapper = mount(App, { global: { stubs: { RouterView: true } } });
    await flushPromises();

    expect(document.documentElement.classList.contains("theme-dark")).toBe(false);
  });

  it("darkMode='auto' + system dark → adds theme-dark class", async () => {
    mockPrefsStore.darkMode = "auto";
    stubMatchMedia(true);

    wrapper = mount(App, { global: { stubs: { RouterView: true } } });
    await flushPromises();

    expect(document.documentElement.classList.contains("theme-dark")).toBe(true);
  });

  it("darkMode='auto' + system light → does NOT add theme-dark class", async () => {
    mockPrefsStore.darkMode = "auto";
    stubMatchMedia(false);

    wrapper = mount(App, { global: { stubs: { RouterView: true } } });
    await flushPromises();

    expect(document.documentElement.classList.contains("theme-dark")).toBe(false);
  });

  it("applies to document.documentElement, not document.body", async () => {
    mockPrefsStore.darkMode = "dark";
    stubMatchMedia(false);

    wrapper = mount(App, { global: { stubs: { RouterView: true } } });
    await flushPromises();

    expect(document.documentElement.classList.contains("theme-dark")).toBe(true);
    expect(document.body.classList.contains("theme-dark")).toBe(false);
  });
});
