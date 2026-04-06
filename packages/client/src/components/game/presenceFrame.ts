/** Shared layout for Story 6B.2 — video + avatar share identical outer dimensions (no layout shift). */

/** Outer frame: 44×44 touch target on mobile with 40×40 inner media; tablet/desktop per UX-DR23. */
export const PRESENCE_FRAME_CLASS =
  "relative overflow-hidden rounded-lg border border-chrome-surface/50 bg-chrome-surface-dark/50 " +
  "max-md:h-11 max-md:w-11 " +
  "md:h-[80px] md:w-[120px] " +
  "lg:h-[96px] lg:w-[140px]";

/** Expanded mobile overlay (tap-to-expand). */
export const PRESENCE_EXPANDED_FRAME_CLASS =
  "fixed left-1/2 top-1/2 z-50 h-[140px] w-[200px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-chrome-surface/50 bg-chrome-surface-dark/50 shadow-lg";
