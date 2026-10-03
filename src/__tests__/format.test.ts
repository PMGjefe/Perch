import { formatDate, formatDay, formatTime, plural, relativeTime } from '@/lib/format';

describe('formatDay', () => {
  const now = new Date(2025, 6, 6, 15, 0);
  it('names today and yesterday', () => {
    expect(formatDay(new Date(2025, 6, 6, 8, 0), now)).toBe('Today');
    expect(formatDay(new Date(2025, 6, 5, 23, 59), now)).toBe('Yesterday');
  });
  it('drops the year inside the current year and keeps it otherwise', () => {
    expect(formatDay(new Date(2025, 2, 1), now)).toBe('1 Mar');
    expect(formatDay(new Date(2024, 11, 31), now)).toBe('31 Dec 2024');
  });
});

describe('format', () => {
  const d = new Date(2025, 6, 6, 14, 5);
  it('formats dates and times', () => {
    expect(formatDate(d)).toBe('6 Jul 2025');
    expect(formatDate(d, false)).toBe('6 Jul');
    expect(formatTime(d)).toBe('2:05 pm');
    expect(formatTime(new Date(2025, 0, 1, 0, 30))).toBe('12:30 am');
  });
  it('gives relative times', () => {
    const now = Date.now();
    expect(relativeTime(new Date(now - 10_000).toISOString())).toBe('just now');
    expect(relativeTime(new Date(now - 5 * 60_000).toISOString())).toBe('5m');
    expect(relativeTime(new Date(now - 3 * 3_600_000).toISOString())).toBe('3h');
    expect(relativeTime(new Date(now - 2 * 86_400_000).toISOString())).toBe('2d');
  });
  it('pluralises', () => {
    expect(plural(1, 'bird')).toBe('1 bird');
    expect(plural(2, 'bird')).toBe('2 birds');
    expect(plural(3, 'species', 'species')).toBe('3 species');
  });
});
