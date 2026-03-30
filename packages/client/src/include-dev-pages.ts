/**
 * Whether dev showcase routes (/dev/*) should be registered and linked.
 * True for `vp dev`, or when `VITE_INCLUDE_DEV_PAGES=true` at build time (e.g. GitHub Pages).
 */
export function includeDevPagesEnabled(
  isDevMode: boolean,
  viteIncludeDevPages: string | undefined,
): boolean {
  return isDevMode || viteIncludeDevPages === "true";
}

export function includeDevPages(): boolean {
  return includeDevPagesEnabled(import.meta.env.DEV, import.meta.env.VITE_INCLUDE_DEV_PAGES);
}
