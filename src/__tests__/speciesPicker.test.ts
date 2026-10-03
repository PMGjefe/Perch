import { findByCommonName, searchSpecies, SPECIES } from '@/lib/taxonomy';

// The picker boosts species already in the diary by 15. These tests pin down what that can and
// cannot do to the ranking, so a seen bird floats up without ever burying what the user typed.
const SEEN_BOOST = 15;

describe('species picker ranking', () => {
  const tit = findByCommonName('Blue Tit') ?? findByCommonName('Eurasian Blue Tit');
  const jay = findByCommonName('Blue Jay');
  if (!tit || !jay) throw new Error('taxonomy is missing the test species');
  const codes = (rows: { code: string }[]) => rows.map((r) => r.code);
  // Only the tit has been seen.
  const boost = (c: string) => (c === tit.code ? SEEN_BOOST : 0);

  it('lifts a seen word-prefix match above unseen word-prefix matches', () => {
    // "blue t" is a word-prefix match for the tit and for a handful of teals, turacos and guans.
    const plain = codes(searchSpecies('blue t'));
    const boosted = codes(searchSpecies('blue t', 30, boost));
    expect(plain.indexOf(tit.code)).toBeGreaterThan(0);
    expect(boosted[0]).toBe(tit.code);
    expect(boosted).toHaveLength(plain.length);
  });

  it('never lifts a seen bird above an unseen exact-prefix match', () => {
    // 'Blue Jay' starts with "blue" (80); the boosted tit tops out at 75.
    const all = codes(searchSpecies('blue', SPECIES.length, boost));
    const plain = codes(searchSpecies('blue', SPECIES.length));
    expect(all.indexOf(jay.code)).toBe(0);
    expect(all.indexOf(tit.code)).toBeGreaterThan(all.indexOf(jay.code));
    // ...but it does move ahead of every unseen word-prefix match it shared a score with.
    expect(all.indexOf(tit.code)).toBeLessThan(plain.indexOf(tit.code));
    const heron = findByCommonName('Great Blue Heron');
    if (heron) {
      expect(plain.indexOf(heron.code)).toBeLessThan(plain.indexOf(tit.code));
      expect(all.indexOf(tit.code)).toBeLessThan(all.indexOf(heron.code));
    }
  });

  it('still returns the bird whose full name was typed', () => {
    expect(searchSpecies('blue jay', 30, boost)[0].code).toBe(jay.code);
    expect(searchSpecies('Blue Jay', 30, () => 50)[0].code).toBe(jay.code);
  });

  it('never surfaces a species that did not match', () => {
    expect(codes(searchSpecies('jay', 30, boost))).not.toContain(tit.code);
    expect(searchSpecies('   ', 30, () => 100)).toEqual([]);
  });

  it('is unchanged without a boost', () => {
    expect(searchSpecies('blue')).toEqual(searchSpecies('blue', 30, () => 0));
    expect(searchSpecies('blue')).toEqual(searchSpecies('blue', 30, undefined));
    expect(searchSpecies('bald ea', 30, () => 0)[0].code).toBe('baleag');
  });
});
