import { detectSource, importCsv, parseCsv } from '@/lib/csv';

const EBIRD = `Submission ID,Common Name,Scientific Name,Taxonomic Order,Count,State/Province,County,Location ID,Location,Latitude,Longitude,Date,Time,Protocol,Duration (Min),All Obs Reported,Distance Traveled (km),Area Covered (ha),Number of Observers,Breeding Code,Observation Details,Checklist Comments,ML Catalog Numbers
S1,American Robin,Turdus migratorius,27000,3,US-WA,King,L1,"Discovery Park, Seattle",47.6580,-122.4090,2025-01-04,08:12 AM,Traveling,90,1,2.5,,1,,"Singing, ""loud""",Nice,
S1,Steller's Jay,Cyanocitta stelleri,20000,2,US-WA,King,L1,"Discovery Park, Seattle",47.6580,-122.4090,2025-01-04,08:12 AM,Traveling,90,1,2.5,,1,,,,
S1,American Robin,Turdus migratorius,27000,1,US-WA,King,L1,"Discovery Park, Seattle",47.6580,-122.4090,2025-01-04,08:12 AM,Traveling,90,1,2.5,,1,,,,
S2,gull sp.,Larus sp.,30000,X,US-WA,King,L9,Alki,47.58,-122.41,03-15-2024,04:30 PM,Stationary,20,1,,,1,,,,
S3,Anna's Hummingbird,Calypte anna,12000,1,US-WA,King,L2,Home,47.66,-122.33,2026-02-02,,Incidental,,0,,,1,,,,
`;

const MERLIN = `Common Name,Scientific Name,Date,Location,Latitude,Longitude,Notes
Northern Flicker,Colaptes auratus,"Mar 21, 2026",Seward Park,47.618,-122.35,heard drumming
Bushtit,Psaltriparus minimus,21 Mar 2026,Seward Park,47.618,-122.35,
Made Up Bird,Fakeus birdus,2026-03-21,Nowhere,,,
Golden-crowned Kinglet,,2026/03/22,Ravenna Park,,,
`;

describe('parseCsv', () => {
  it('handles quoted commas, escaped quotes, CRLF and a BOM', () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ]);
  });
  it('drops blank lines', () => {
    expect(parseCsv('a\n\n\nb\n')).toEqual([['a'], ['b']]);
  });
});

describe('detectSource', () => {
  it('recognises eBird and Merlin headers', () => {
    expect(detectSource(['Submission ID', 'Common Name'])).toBe('ebird');
    expect(detectSource(['Common Name', 'Date'])).toBe('merlin');
    expect(detectSource(['foo', 'bar'])).toBeNull();
  });
});

describe('importCsv (eBird)', () => {
  const r = importCsv(EBIRD);
  it('maps species, drops in-file duplicates and unknown taxa', () => {
    expect(r.source).toBe('ebird');
    expect(r.rows.map((x) => x.species_code)).toEqual(['amerob', 'stejay', 'annhum']);
    expect(r.duplicatesInFile).toBe(1);
    expect(r.unmatched).toEqual(['gull sp.']);
  });
  it('parses ISO dates with 12-hour times in local time', () => {
    const d = new Date(r.rows[0].observed_at);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2025, 0, 4, 8, 12]);
  });
  it('defaults a missing time to midday and keeps the submission id', () => {
    const anna = r.rows[2];
    expect(new Date(anna.observed_at).getHours()).toBe(12);
    expect(anna.source_ref).toBe('S3');
    expect(anna.place_name).toBe('Home');
  });
  it('folds count and details into the note', () => {
    expect(r.rows[0].note).toBe('Count: 3\nSinging, "loud"');
    expect(r.rows[1].note).toBe('Count: 2');
  });
});

describe('importCsv (Merlin)', () => {
  const r = importCsv(MERLIN);
  it('accepts several date formats and blank coordinates', () => {
    expect(r.source).toBe('merlin');
    expect(r.rows.map((x) => x.species_code)).toEqual(['norfli', 'bushti', 'gockin']);
    expect(r.rows[2].lat).toBeNull();
    expect(new Date(r.rows[0].observed_at).getDate()).toBe(21);
    expect(new Date(r.rows[2].observed_at).getDate()).toBe(22);
  });
  it('reports unmatched names', () => {
    expect(r.unmatched).toEqual(['Made Up Bird']);
  });
});

describe('importCsv errors', () => {
  it('rejects files without a date column', () => {
    expect(() => importCsv('Common Name,Location\nAmerican Robin,Home\n')).toThrow(/date/i);
  });
  it('rejects unknown formats', () => {
    expect(() => importCsv('a,b\n1,2\n')).toThrow(/Unrecognised/);
  });
});
