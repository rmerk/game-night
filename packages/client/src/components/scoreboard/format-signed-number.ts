export function formatSignedNumber(value: number): string {
  return value > 0 ? `+${value}` : `${value}`;
}
