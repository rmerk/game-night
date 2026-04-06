/**
 * Design system tokens used by both UnoCSS config and tests.
 * Extracted to src/ so test files can import without path issues.
 */

export const themeColors = {
  felt: {
    teal: "#2A6B6B",
  },
  chrome: {
    surface: "var(--chrome-surface)",
    "surface-dark": "#2C2A28",
    border: "var(--chrome-border)",
    elevated: "var(--chrome-elevated)",
  },
  gold: {
    accent: "#C4A35A",
    "accent-hover": "#D4B36A",
  },
  suit: {
    bam: "#2D8B46",
    crak: "#C23B22",
    dot: "#2E5FA1",
  },
  text: {
    primary: "var(--text-primary)",
    secondary: "var(--text-secondary)",
    "on-felt": "#E8E0D4",
    "on-dark": "#E8E0D4",
  },
  state: {
    "turn-active": "#4A9B6E",
    "call-window": "#D4A843",
    success: "#3D8B5E",
    error: "var(--state-error)",
    warning: "#D4A843",
  },
  wall: {
    normal: "#4A9B6E",
    warning: "#D4A843",
    critical: "#B8553A",
  },
  /** NMJL hand hints — warm gold / neutral only (UX-DR41); not suit colors. */
  guidance: {
    achievable: "#D4B36A",
    distant: "#8B7E72",
  },
  celebration: {
    gold: "#D4B36A",
    dim: "rgba(0, 0, 0, 0.6)",
  },
  focus: {
    "ring-on-chrome": "#8C7038",
    "ring-on-felt": "#F5F0E8",
    "ring-on-dark": "#C4A35A",
  },
} as const;

export const themeSpacing = {
  "1": "4px",
  "2": "8px",
  "3": "12px",
  "4": "16px",
  "6": "24px",
  "8": "32px",
  "12": "48px",
  "16": "64px",
  "24": "96px",
} as const;

export const themeRadius = {
  sm: "4px",
  md: "8px",
  lg: "12px",
  full: "9999px",
} as const;

export const themeShadows = {
  tile: "0 2px 4px rgba(107, 97, 88, 0.15), 0 1px 2px rgba(107, 97, 88, 0.1)",
  panel: "0 4px 12px rgba(107, 97, 88, 0.12), 0 2px 4px rgba(107, 97, 88, 0.08)",
  modal: "0 8px 24px rgba(107, 97, 88, 0.16), 0 4px 8px rgba(107, 97, 88, 0.1)",
} as const;

export const themeShortcuts: Record<string, string> = {
  "min-tap": "min-h-11 min-w-11",
  "text-game-critical": "text-5 font-semibold font-sans",
  "text-interactive": "text-4.5 font-semibold font-sans",
  "text-body": "text-4 font-normal font-sans",
  "text-card-pattern": "text-4 font-normal font-mono",
  "text-secondary": "text-3.5 font-normal font-sans",
  "focus-ring-on-chrome": "outline-2 outline-solid outline-focus-ring-on-chrome outline-offset-2",
  "focus-ring-on-felt": "outline-2 outline-solid outline-focus-ring-on-felt outline-offset-2",
  "focus-ring-on-dark": "outline-2 outline-solid outline-focus-ring-on-dark outline-offset-2",
  "guidance-achievable": "border border-gold-accent/45 bg-guidance-achievable/20 shadow-sm",
  "guidance-distant": "opacity-80 border-chrome-border bg-chrome-surface/50",
};
