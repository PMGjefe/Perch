// Bundled eBird/Clements taxonomy: type-ahead search that works offline.
import raw from '../../assets/taxonomy/species.json';

export interface SpeciesEntry {
  code: string;
  common: string;
  sci: string;
  family: string;
  familySci: string;
  order: number;
}

export const SPECIES: SpeciesEntry[] = raw as SpeciesEntry[];

const byCode = new Map<string, SpeciesEntry>();
const byCommonLower = new Map<string, SpeciesEntry>();
const bySciLower = new Map<string, SpeciesEntry>();
for (const s of SPECIES) {
  byCode.set(s.code, s);
  byCommonLower.set(s.common.toLowerCase(), s);
  bySciLower.set(s.sci.toLowerCase(), s);
}

export function speciesByCode(code: string | null | undefined): SpeciesEntry | undefined {
  return code ? byCode.get(code) : undefined;
}

export function speciesName(code: string | null | undefined): string {
  return speciesByCode(code)?.common ?? code ?? 'Unknown species';
}

export function findByCommonName(name: string): SpeciesEntry | undefined {
  return byCommonLower.get(normalize(name).toLowerCase());
}

export function findByScientificName(name: string): SpeciesEntry | undefined {
  return bySciLower.get(name.trim().toLowerCase());
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’]/g, "'").trim();
}

/**
 * Rank species for a query. Matches on common name (word prefixes, then substring),
 * scientific name and eBird code. Cheap enough to run on every keystroke over 11k rows.
 *
 * `boost` adds to the score of a species that already matched; it never surfaces a non-match.
 * A boost of 15 lifts a seen word-prefix match (60 → 75) above an unseen word-prefix (60) but
 * never above an unseen exact-prefix (80) or exact match (100), so typing the full name still wins.
 */
export function searchSpecies(query: string, limit = 30, boost?: (code: string) => number): SpeciesEntry[] {
  const q = normalize(query).toLowerCase();
  if (!q) return [];
  const words = q.split(/\s+/).filter(Boolean);
  const scored: { s: SpeciesEntry; score: number }[] = [];
  for (const s of SPECIES) {
    const common = s.common.toLowerCase();
    let score = 0;
    if (common === q) score = 100;
    else if (common.startsWith(q)) score = 80;
    else if (words.every((w) => common.split(/[\s-]+/).some((cw) => cw.startsWith(w)))) score = 60;
    else if (common.includes(q)) score = 40;
    else if (s.sci.toLowerCase().startsWith(q)) score = 35;
    else if (s.code === q) score = 30;
    else if (words.every((w) => s.sci.toLowerCase().includes(w))) score = 20;
    if (score) {
      score += boost?.(s.code) ?? 0;
      scored.push({ s, score: score - Math.min(common.length, 40) / 100 });
    }
  }
  scored.sort((a, b) => b.score - a.score || a.s.order - b.s.order);
  return scored.slice(0, limit).map((x) => x.s);
}
