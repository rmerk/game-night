import { describe, it, expect } from "vite-plus/test";
import {
  themeColors,
  themeSpacing,
  themeRadius,
  themeShadows,
  themeShortcuts,
} from "./styles/design-tokens";

describe("UnoCSS theme configuration", () => {
  describe("color tokens (AC1)", () => {
    it("defines felt color tokens", () => {
      expect(themeColors.felt.teal).toBe("#2A6B6B");
    });

    it("defines chrome color tokens as CSS variables for dark mode remapping", () => {
      expect(themeColors.chrome.surface).toBe("var(--chrome-surface)");
      expect(themeColors.chrome["surface-dark"]).toBe("#2C2A28");
      expect(themeColors.chrome.border).toBe("var(--chrome-border)");
      expect(themeColors.chrome.elevated).toBe("var(--chrome-elevated)");
    });

    it("defines gold accent tokens", () => {
      expect(themeColors.gold.accent).toBe("#C4A35A");
      expect(themeColors.gold["accent-hover"]).toBeDefined();
    });

    it("defines suit color tokens", () => {
      expect(themeColors.suit.bam).toBeDefined();
      expect(themeColors.suit.crak).toBeDefined();
      expect(themeColors.suit.dot).toBeDefined();
    });

    it("defines text color tokens with CSS variables for dark mode remapping", () => {
      expect(themeColors.text.primary).toBe("var(--text-primary)");
      expect(themeColors.text.secondary).toBe("var(--text-secondary)");
      expect(themeColors.text["on-felt"]).toBe("#E8E0D4");
      expect(themeColors.text["on-dark"]).toBe("#E8E0D4");
    });

    it("defines state color tokens with error as CSS variable for dark mode", () => {
      expect(themeColors.state["turn-active"]).toBeDefined();
      expect(themeColors.state["call-window"]).toBeDefined();
      expect(themeColors.state.success).toBeDefined();
      expect(themeColors.state.error).toBe("var(--state-error)");
      expect(themeColors.state.warning).toBeDefined();
    });

    it("defines wall counter tokens", () => {
      expect(themeColors.wall.normal).toBeDefined();
      expect(themeColors.wall.warning).toBeDefined();
      expect(themeColors.wall.critical).toBeDefined();
    });

    it("defines guidance tokens", () => {
      expect(themeColors.guidance.achievable).toBeDefined();
      expect(themeColors.guidance.distant).toBeDefined();
    });

    it("defines celebration tokens", () => {
      expect(themeColors.celebration.gold).toBeDefined();
      expect(themeColors.celebration.dim).toBeDefined();
    });

    it("defines focus ring color tokens", () => {
      expect(themeColors.focus["ring-on-chrome"]).toBe("#8C7038");
      expect(themeColors.focus["ring-on-felt"]).toBe("#F5F0E8");
      expect(themeColors.focus["ring-on-dark"]).toBe("#C4A35A");
    });
  });

  describe("spacing scale (AC4)", () => {
    it("defines 4px-based spacing scale", () => {
      expect(themeSpacing["1"]).toBe("4px");
      expect(themeSpacing["2"]).toBe("8px");
      expect(themeSpacing["3"]).toBe("12px");
      expect(themeSpacing["4"]).toBe("16px");
      expect(themeSpacing["6"]).toBe("24px");
      expect(themeSpacing["8"]).toBe("32px");
      expect(themeSpacing["12"]).toBe("48px");
      expect(themeSpacing["16"]).toBe("64px");
      expect(themeSpacing["24"]).toBe("96px");
    });
  });

  describe("border radius scale (AC4)", () => {
    it("defines radius tokens", () => {
      expect(themeRadius.sm).toBe("4px");
      expect(themeRadius.md).toBe("8px");
      expect(themeRadius.lg).toBe("12px");
      expect(themeRadius.full).toBe("9999px");
    });
  });

  describe("shadow scale (AC4)", () => {
    it("defines warm-toned shadow tokens", () => {
      expect(themeShadows.tile).toContain("rgba(107, 97, 88");
      expect(themeShadows.panel).toContain("rgba(107, 97, 88");
      expect(themeShadows.modal).toContain("rgba(107, 97, 88");
    });
  });

  describe("shortcuts", () => {
    it("defines min-tap shortcut with 44px dimensions", () => {
      expect(themeShortcuts["min-tap"]).toBe("min-h-11 min-w-11");
    });

    it("defines text-game-critical with 20px semibold", () => {
      expect(themeShortcuts["text-game-critical"]).toContain("text-5");
      expect(themeShortcuts["text-game-critical"]).toContain("font-semibold");
    });

    it("defines text-interactive with 18px semibold", () => {
      expect(themeShortcuts["text-interactive"]).toContain("text-4.5");
      expect(themeShortcuts["text-interactive"]).toContain("font-semibold");
    });

    it("defines text-body with 16px regular", () => {
      expect(themeShortcuts["text-body"]).toContain("text-4");
      expect(themeShortcuts["text-body"]).toContain("font-normal");
    });

    it("defines text-card-pattern with monospace", () => {
      expect(themeShortcuts["text-card-pattern"]).toContain("font-mono");
    });

    it("defines text-secondary with 14px regular", () => {
      expect(themeShortcuts["text-secondary"]).toContain("text-3.5");
      expect(themeShortcuts["text-secondary"]).toContain("font-normal");
    });

    it("defines three focus ring variants", () => {
      expect(themeShortcuts["focus-ring-on-chrome"]).toContain("outline");
      expect(themeShortcuts["focus-ring-on-felt"]).toContain("outline");
      expect(themeShortcuts["focus-ring-on-dark"]).toContain("outline");
    });
  });
});
