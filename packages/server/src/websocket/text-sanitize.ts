// eslint-disable-next-line no-control-regex -- intentional: strip control characters from user input
const CONTROL_CHARS = /[\x00-\x1F\x7F]/g;

/** Same rule as display names — shared between join and chat paths. */
export function stripControlChars(s: string): string {
  return s.replace(CONTROL_CHARS, "");
}
