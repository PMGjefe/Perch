import { compactNumber } from '@/lib/format';
import { parseTaxa, taxaUrl } from '@/lib/inat';

describe('inat', () => {
  it('builds the taxa URL', () => {
    expect(taxaUrl('Turdus migratorius')).toContain('q=Turdus%20migratorius');
  });
  it('takes the count only from an exact name match', () => {
    const json = { results: [{ name: 'Turdus merula', observations_count: 5 }, { name: 'Turdus migratorius', observations_count: 1234567 }] };
    expect(parseTaxa(json, 'Turdus migratorius')).toBe(1234567);
    expect(parseTaxa(json, 'Turdus nope')).toBeNull();
    expect(parseTaxa(null, 'x')).toBeNull();
  });
  it('formats counts compactly', () => {
    expect(compactNumber(950)).toBe('950');
    expect(compactNumber(12_400)).toBe('12K');
    expect(compactNumber(1_234_567)).toBe('1.2M');
  });
});
