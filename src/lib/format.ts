const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(iso: string | Date, withYear = true): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return withYear ? `${base} ${d.getFullYear()}` : base;
}

/** "Today", "Yesterday", or the date; the year only when it is not this year. */
export function formatDay(iso: string | Date, now: Date = new Date()): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return formatDate(d, d.getFullYear() !== now.getFullYear());
}

export function formatTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${((h + 11) % 12) + 1}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

export function formatDateTime(iso: string | Date): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`;
}

export function relativeTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return formatDate(iso, new Date(iso).getFullYear() !== new Date().getFullYear());
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Saturday 3 October": the diary masthead. No year; it is always today. */
export function formatLongDay(d: Date): string {
  return `${WEEKDAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}
