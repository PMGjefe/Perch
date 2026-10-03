import { formatLongDay } from '@/lib/format';
import { greeting } from '@/lib/insights';

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
