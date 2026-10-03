import { daylight, groupOutings, monthHistogram, yearRecap } from '@/lib/insights';
import type { Sighting } from '@/types/db';

const base = (over: Partial<Sighting>): Sighting => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  user_id: 'u',
  species_code: 'amerob',
  observed_at: '2026-03-01T10:00:00.000Z',
  lat: 47.65,
  lng: -122.4,
  place_name: 'Discovery Park',
  photo_path: null,
  note: '',
  visibility: 'public',
  sensitive: false,
  source: 'app',
  source_ref: null,
  created_at: '',
  updated_at: '',
  ...over,
});

describe('groupOutings', () => {
  it('groups same-day sightings within 2 km and splits far or other-day ones', () => {
    const a = base({ id: 'a', observed_at: '2026-03-01T10:00:00.000Z' });
    const b = base({ id: 'b', observed_at: '2026-03-01T10:30:00.000Z', species_code: 'stejay', lat: 47.655, lng: -122.405 });
    const c = base({ id: 'c', observed_at: '2026-03-01T15:00:00.000Z', lat: 47.9, lng: -122.4, place_name: 'Far' });
    const d = base({ id: 'd', observed_at: '2026-03-02T09:00:00.000Z' });
    const first = new Map([['amerob', 'd'], ['stejay', 'b']]);
    const outings = groupOutings([d, c, b, a], first);
    expect(outings.map((o) => o.sightings.map((s) => s.id))).toEqual([['d'], ['c'], ['b', 'a']]);
    expect(outings[2].speciesCount).toBe(2);
    expect(outings[2].lifers).toBe(1);
    expect(outings[0].lifers).toBe(1);
  });
  it('falls back to place name without coordinates', () => {
    const a = base({ id: 'a', lat: null, lng: null, place_name: 'Yard' });
    const b = base({ id: 'b', lat: null, lng: null, place_name: 'Yard', observed_at: '2026-03-01T11:00:00.000Z' });
    const c = base({ id: 'c', lat: null, lng: null, place_name: 'Park', observed_at: '2026-03-01T12:00:00.000Z' });
    expect(groupOutings([c, b, a], new Map())).toHaveLength(2);
  });
});

describe('monthHistogram and yearRecap', () => {
  const all = [
    base({ id: '1', observed_at: '2025-12-20T10:00:00.000Z', species_code: 'amerob' }),
    base({ id: '2', observed_at: '2026-01-04T10:00:00.000Z', species_code: 'amerob' }),
    base({ id: '3', observed_at: '2026-01-04T11:00:00.000Z', species_code: 'stejay', place_name: 'Union Bay' }),
    base({ id: '4', observed_at: '2026-01-11T11:00:00.000Z', species_code: 'baleag', place_name: 'Union Bay' }),
    base({ id: '5', observed_at: '2026-03-01T11:00:00.000Z', species_code: 'amerob', place_name: 'Union Bay' }),
  ];
  it('counts months', () => {
    const h = monthHistogram(all.slice(1));
    expect(h[0]).toBe(3);
    expect(h[2]).toBe(1);
  });
  it('builds the recap', () => {
    const r = yearRecap(all, 2026);
    expect(r.sightings).toBe(4);
    expect(r.species).toBe(3);
    expect(r.lifers).toEqual(['stejay', 'baleag']); // robin was first seen in 2025
    expect(r.daysOut).toBe(3);
    expect(r.busiestMonth).toEqual({ month: 0, count: 3 });
    expect(r.topPlace).toEqual({ place: 'Union Bay', count: 3 });
    expect(r.mostSeen).toEqual({ code: 'amerob', count: 2 });
    expect(r.firstBird?.id).toBe('2');
    expect(r.lastBird?.id).toBe('5');
    expect(r.longestStreakWeeks).toBe(2);
  });
});

describe('daylight', () => {
  it('is dark at night, full in the day, partial at dawn and dusk', () => {
    expect(daylight(new Date(2026, 0, 1, 2))).toBe(0);
    expect(daylight(new Date(2026, 0, 1, 12))).toBe(1);
    expect(daylight(new Date(2026, 0, 1, 6))).toBeCloseTo(0.5);
    expect(daylight(new Date(2026, 0, 1, 19, 30))).toBeCloseTo(0.5);
  });
});
