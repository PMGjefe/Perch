// Pure helpers that turn a user's sightings into stories: outings, seasonality, a year recap.
import { localDay } from '@/lib/dates';
import { haversineM } from '@/lib/geo';
import type { Sighting } from '@/types/db';

export const MONTHS_SHORT = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface Outing<S extends Sighting = Sighting> {
  key: string;
  day: string; // YYYY-MM-DD local
  place: string | null;
  sightings: S[]; // newest first
  speciesCount: number;
  lifers: number;
}

/**
 * Group sightings (newest first) into outings: same local day, and within 2 km of the outing's
 * first pin (or same place name when there are no coordinates). `firstSeen` maps species -> first
 * sighting id so lifers can be counted per outing.
 */
export function groupOutings<S extends Sighting>(sightings: S[], firstSeen: Map<string, string>): Outing<S>[] {
  const out: Outing<S>[] = [];
  for (const s of sightings) {
    const day = localDay(s.observed_at);
    const match = out.find((o) => {
      if (o.day !== day) return false;
      const anchor = o.sightings.find((x) => x.lat != null);
      if (anchor && s.lat != null && s.lng != null) return haversineM({ lat: anchor.lat!, lng: anchor.lng! }, { lat: s.lat, lng: s.lng }) <= 2000;
      return (o.place ?? '') === (s.place_name ?? '');
    });
    if (match) match.sightings.push(s);
    else out.push({ key: `${day}:${out.length}`, day, place: s.place_name ?? null, sightings: [s], speciesCount: 0, lifers: 0 });
  }
  for (const o of out) {
    o.speciesCount = new Set(o.sightings.map((s) => s.species_code)).size;
    o.lifers = o.sightings.filter((s) => firstSeen.get(s.species_code) === s.id).length;
    if (!o.place) o.place = o.sightings.find((s) => s.place_name)?.place_name ?? null;
  }
  return out;
}

/** Which months (0-11) a set of sightings fall in, with counts. */
export function monthHistogram(sightings: Pick<Sighting, 'observed_at'>[]): number[] {
  const h = new Array<number>(12).fill(0);
  for (const s of sightings) h[new Date(s.observed_at).getMonth()]++;
  return h;
}

export interface YearRecap {
  year: number;
  sightings: number;
  species: number;
  lifers: string[]; // species codes new to the life list this year, in order seen
  daysOut: number;
  busiestMonth: { month: number; count: number } | null;
  topPlace: { place: string; count: number } | null;
  firstBird: Sighting | null;
  lastBird: Sighting | null;
  mostSeen: { code: string; count: number } | null;
  longestStreakWeeks: number;
}

/** Everything the Year in Birds recap needs, from all of a user's sightings. */
export function yearRecap(all: Sighting[], year: number): YearRecap {
  const inYear = all.filter((s) => localDay(s.observed_at).startsWith(String(year))).sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  const firstEver = new Map<string, string>();
  for (const s of [...all].sort((a, b) => a.observed_at.localeCompare(b.observed_at))) if (!firstEver.has(s.species_code)) firstEver.set(s.species_code, s.id);
  const lifers = inYear.filter((s) => firstEver.get(s.species_code) === s.id).map((s) => s.species_code);
  const days = new Set(inYear.map((s) => localDay(s.observed_at)));
  const months = monthHistogram(inYear);
  const busiest = months.reduce((best, count, month) => (count > (best?.count ?? 0) ? { month, count } : best), null as { month: number; count: number } | null);
  const placeCounts = new Map<string, number>();
  for (const s of inYear) if (s.place_name) placeCounts.set(s.place_name, (placeCounts.get(s.place_name) ?? 0) + 1);
  const topPlace = [...placeCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const speciesCounts = new Map<string, number>();
  for (const s of inYear) speciesCounts.set(s.species_code, (speciesCounts.get(s.species_code) ?? 0) + 1);
  const mostSeen = [...speciesCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  // Longest run of consecutive ISO weeks with at least one sighting.
  const weeks = [...new Set(inYear.map((s) => weekIndex(new Date(s.observed_at))))].sort((a, b) => a - b);
  let best = 0, run = 0, prev = Number.NaN;
  for (const w of weeks) {
    run = w === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return {
    year,
    sightings: inYear.length,
    species: speciesCounts.size,
    lifers,
    daysOut: days.size,
    busiestMonth: busiest,
    topPlace: topPlace ? { place: topPlace[0], count: topPlace[1] } : null,
    firstBird: inYear[0] ?? null,
    lastBird: inYear[inYear.length - 1] ?? null,
    mostSeen: mostSeen ? { code: mostSeen[0], count: mostSeen[1] } : null,
    longestStreakWeeks: best,
  };
}

function weekIndex(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  return Math.floor((d.getTime() - start.getTime()) / (7 * 86_400_000));
}

/** 0 = deep night, 1 = full day. Drives the subtle warmth shift of the app's surfaces. */
export function daylight(date = new Date()): number {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h < 5 || h >= 21) return 0;
  if (h < 7) return (h - 5) / 2; // dawn
  if (h < 18) return 1;
  if (h < 21) return 1 - (h - 18) / 3; // dusk
  return 0;
}

/** Light-aware one-liner for the diary masthead. Dawn and dusk are when birders are out; say so. */
export function greeting(now = new Date()): string {
  const d = daylight(now);
  const h = now.getHours();
  if (d === 0) return h < 5 ? 'Owls, nightjars, and the first chorus soon.' : 'Nocturnal flight calls count too.';
  if (d < 1 && h < 12) return 'Dawn chorus hours.';
  if (d < 1) return 'Golden hour. Roost flights and late songs.';
  return 'What did you see?';
}
