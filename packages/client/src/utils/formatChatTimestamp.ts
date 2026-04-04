const formatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

export function formatChatTimestamp(ms: number): string {
  return formatter.format(new Date(ms));
}
