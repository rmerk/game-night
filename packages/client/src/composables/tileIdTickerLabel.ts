/**
 * Short label for activity ticker (e.g. dot-8-2 → "8-Dot").
 * Parses canonical tile `id` strings from the shared engine.
 */
export function tileIdToTickerLabel(tileId: string): string {
  const parts = tileId.split("-");
  const head = parts[0];
  if (!head) {
    return tileId;
  }

  if (head === "joker") {
    return "Joker";
  }

  if (head === "dot" || head === "bam" || head === "crak") {
    const value = parts[1];
    if (value === undefined) {
      return tileId;
    }
    const suit = head === "dot" ? "Dot" : head === "bam" ? "Bam" : "Crack";
    return `${value}-${suit}`;
  }

  if (head === "wind" && parts[1]) {
    return parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
  }

  if (head === "dragon" && parts[1]) {
    const d = parts[1];
    if (d === "soap") {
      return "Soap";
    }
    if (d === "red") {
      return "Red Dragon";
    }
    if (d === "green") {
      return "Green Dragon";
    }
    return d;
  }

  if (head === "flower" && parts[1]) {
    return `Flower ${parts[1].toUpperCase()}`;
  }

  return tileId;
}
