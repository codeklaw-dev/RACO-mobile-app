/** "Good morning/afternoon/evening, Sam." for the home screen. */
export function greeting(name: string | null | undefined, now: Date = new Date()): string {
  const hour = now.getHours();
  const part = hour < 5 ? 'evening' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
  return name ? `Good ${part}, ${name}.` : `Good ${part}.`;
}

/** Joins items as "a, b and c" for copy like "Since you picked …". */
export function humanList(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** "09:00" -> "9:00 AM". */
export function formatTime(hhmm: string): string {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}
