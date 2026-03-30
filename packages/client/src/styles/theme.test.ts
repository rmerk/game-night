import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vite-plus/test";

const __dir = dirname(fileURLToPath(import.meta.url));
const themeCSS = readFileSync(resolve(__dir, "theme.css"), "utf-8");

describe("theme.css custom properties", () => {
  describe("animation timing tokens (AC3)", () => {
    it("defines four timing tiers", () => {
      expect(themeCSS).toContain("--timing-tactile: 120ms");
      expect(themeCSS).toContain("--timing-expressive: 400ms");
      expect(themeCSS).toContain("--timing-entrance: 200ms");
      expect(themeCSS).toContain("--timing-exit: 150ms");
    });

    it("defines easing functions", () => {
      expect(themeCSS).toContain("--ease-tactile: ease-out");
      expect(themeCSS).toContain("--ease-expressive: cubic-bezier(0.16, 1, 0.3, 1)");
      expect(themeCSS).toContain("--ease-entrance: ease-out");
      expect(themeCSS).toContain("--ease-exit: ease-in");
    });
  });

  describe("reduced motion (AC3)", () => {
    it("overrides all durations to 0ms under prefers-reduced-motion", () => {
      const reducedMotionBlock = themeCSS.slice(themeCSS.indexOf("prefers-reduced-motion"));
      expect(reducedMotionBlock).toContain("--timing-tactile: 0ms");
      expect(reducedMotionBlock).toContain("--timing-expressive: 0ms");
      expect(reducedMotionBlock).toContain("--timing-entrance: 0ms");
      expect(reducedMotionBlock).toContain("--timing-exit: 0ms");
    });
  });

  describe("focus ring tokens (AC5)", () => {
    it("defines three context-adaptive focus ring colors", () => {
      expect(themeCSS).toContain("--focus-ring-on-chrome: #8C7038");
      expect(themeCSS).toContain("--focus-ring-on-felt: #F5F0E8");
      expect(themeCSS).toContain("--focus-ring-on-dark: #C4A35A");
    });
  });

  describe("mood switching (AC7)", () => {
    it("defines mood-arriving class with warmer tone", () => {
      expect(themeCSS).toContain(".mood-arriving");
    });

    it("defines mood-playing class with cooler tone", () => {
      expect(themeCSS).toContain(".mood-playing");
    });

    it("defines mood-lingering class with muted tone", () => {
      expect(themeCSS).toContain(".mood-lingering");
    });

    it("defines mood token custom properties", () => {
      expect(themeCSS).toContain("--mood-surface");
      expect(themeCSS).toContain("--mood-emphasis");
      expect(themeCSS).toContain("--mood-gold-temp");
    });
  });

  describe("chrome-layer tokens (AC8)", () => {
    it("defines chrome-layer custom properties in :root", () => {
      expect(themeCSS).toContain("--chrome-surface: #F5F0E8");
      expect(themeCSS).toContain("--chrome-elevated: #FAF7F2");
      expect(themeCSS).toContain("--chrome-border: #D4CFC5");
      expect(themeCSS).toContain("--text-primary: #2C2420");
      expect(themeCSS).toContain("--text-secondary: #6B6158");
    });
  });

  describe("dark mode (AC6, AC8)", () => {
    const darkBlock = themeCSS.slice(themeCSS.indexOf("prefers-color-scheme: dark"));

    it("includes prefers-color-scheme: dark media query", () => {
      expect(themeCSS).toContain("prefers-color-scheme: dark");
    });

    it("remaps chrome-layer tokens in dark mode", () => {
      expect(darkBlock).toContain("--chrome-surface: #2C2A28");
      expect(darkBlock).toContain("--chrome-elevated: #3A3735");
      expect(darkBlock).toContain("--chrome-border: #4A4540");
      expect(darkBlock).toContain("--text-primary: #E8E0D4");
      expect(darkBlock).toContain("--text-secondary: #A89E94");
    });

    it("remaps state-error to brighter coral in dark mode", () => {
      expect(darkBlock).toContain("--state-error: #E8896E");
    });
  });
});
