import { findByCommonName, findByScientificName, searchSpecies, SPECIES, speciesByCode, speciesName } from '@/lib/taxonomy';

describe('taxonomy', () => {
  it('bundles species only, in taxonomic order', () => {
    expect(SPECIES.length).toBeGreaterThan(10000);
    for (let i = 1; i < SPECIES.length; i++) expect(SPECIES[i].order).toBeGreaterThan(SPECIES[i - 1].order);
  });
  it('looks up by code and names', () => {
    expect(speciesByCode('amerob')?.common).toBe('American Robin');
    expect(speciesName('nope')).toBe('nope');
    expect(findByCommonName("steller's jay")?.code).toBe('stejay');
    expect(findByCommonName('Steller’s Jay')?.code).toBe('stejay'); // curly apostrophe
    expect(findByScientificName('Turdus migratorius')?.code).toBe('amerob');
  });
  it('ranks exact and prefix matches first', () => {
    expect(searchSpecies('American Robin')[0].code).toBe('amerob');
    expect(searchSpecies('bald ea')[0].code).toBe('baleag');
    expect(searchSpecies('rob')[0].common.toLowerCase().startsWith('rob')).toBe(true);
  });
  it('matches word prefixes in any order and scientific names', () => {
    expect(searchSpecies('crowned kinglet').map((s) => s.code)).toEqual(expect.arrayContaining(['gockin', 'ruckin']));
    expect(searchSpecies('Calypte anna')[0].code).toBe('annhum');
  });
  it('returns nothing for empty input and respects the limit', () => {
    expect(searchSpecies('   ')).toEqual([]);
    expect(searchSpecies('a', 5)).toHaveLength(5);
  });
});
