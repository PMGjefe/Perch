import { localDay } from '@/lib/dates';
import { formatLongDay } from '@/lib/format';
import { greeting, outingLine } from '@/lib/insights';

describe('formatLongDay', () => {
  it('spells out weekday, day and month with no year', () => {
    expect(formatLongDay(new Date(2026, 9, 3))).toBe('Saturday 3 October');
    expect(formatLongDay(new Date(2026, 0, 1))).toBe('Thursday 1 January');
  });
});

describe('greeting', () => {
  const at = (h: number, m = 0) => new Date(2026, 9, 3, h, m);
  it('follows the light through the day', () => {
    expect(greeting(at(3))).toBe('Owls, nightjars, and the first chorus soon.');
    expect(greeting(at(5, 30))).toBe('Dawn chorus hours.');
    expect(greeting(at(13))).toBe('What did you see?');
    expect(greeting(at(19))).toBe('Golden hour. Roost flights and late songs.');
    expect(greeting(at(22))).toBe('Nocturnal flight calls count too.');
  });
});

describe('outingLine', () => {
  const now = new Date(2026, 9, 3, 9, 30); // Saturday morning
  const outing = (when: Date, over: { place?: string | null; speciesCount?: number } = {}) => ({
    day: localDay(when.toISOString()),
    place: 'Rainham Marshes',
    speciesCount: 3,
    sightings: [{ observed_at: when.toISOString() }],
    ...over,
  });

  it('says how today is going so far', () => {
    expect(outingLine(outing(new Date(2026, 9, 3, 7)), now)).toBe('Out today · 3 species so far at Rainham Marshes');
    expect(outingLine(outing(new Date(2026, 9, 3, 7), { place: null, speciesCount: 1 }), now)).toBe('Out today · 1 species so far');
  });

  it('lowercases yesterday mid-sentence and keeps other days as formatDay gives them', () => {
    expect(outingLine(outing(new Date(2026, 9, 2, 18)), now)).toBe('Last outing yesterday · 3 species at Rainham Marshes');
    expect(outingLine(outing(new Date(2026, 8, 12, 18), { place: null }), now)).toBe('Last outing 12 Sep · 3 species');
    expect(outingLine(outing(new Date(2025, 11, 31, 18)), now)).toBe('Last outing 31 Dec 2025 · 3 species at Rainham Marshes');
  });

  it('is empty with nothing logged yet', () => {
    expect(outingLine(undefined, now)).toBeNull();
  });
});
