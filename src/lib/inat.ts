// How often the world has recorded a species, from iNaturalist's public taxa endpoint. Fetched on
// the device by scientific name and cached locally for a month, like the Wikipedia account.
import type { SummaryCache } from '@/lib/wiki';

const TTL_MS = 30 * 24 * 3600 * 1000;
const memory = new Map<string, number | null>();

export function taxaUrl(sci: string): string {
  return `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(sci.trim())}&rank=species&per_page=5`;
}

/** The observation count for the exact scientific name, or null when the match is not exact. */
export function parseTaxa(json: unknown, sci: string): number | null {
  const results = (json as { results?: { name?: string; observations_count?: number }[] } | null)?.results;
  if (!Array.isArray(results)) return null;
  const hit = results.find((r) => (r.name ?? '').toLowerCase() === sci.trim().toLowerCase());
  return typeof hit?.observations_count === 'number' ? hit.observations_count : null;
}

export async function fetchGlobalCount(sci: string, cache?: SummaryCache): Promise<number | null> {
  if (!sci) return null;
  if (memory.has(sci)) return memory.get(sci) ?? null;
  const key = `inat:${sci}`;
  const cached = cache?.get(key) ?? null;
  if (cached) {
    try {
      const { at, count } = JSON.parse(cached) as { at: number; count: number | null };
      if (Date.now() - at < TTL_MS) {
        memory.set(sci, count);
        return count;
      }
    } catch {
      // refetch
    }
  }
  try {
    const res = await fetch(taxaUrl(sci), { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    const count = parseTaxa(await res.json(), sci);
    memory.set(sci, count);
    cache?.set(key, JSON.stringify({ at: Date.now(), count }));
    return count;
  } catch {
    return null;
  }
}
