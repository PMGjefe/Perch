// Species accounts come from Wikipedia's public summary endpoint, keyed by scientific name. The
// device fetches directly; results are cached for a month in the local meta table so a species
// page reads like a field guide entry even offline once it has been opened.
/** Where fetched accounts are kept between launches (the app passes db.getMeta/setMeta). */
export interface SummaryCache {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface SpeciesSummary {
  title: string;
  extract: string;
  thumbnail: string | null;
  url: string;
}

const TTL_MS = 30 * 24 * 3600 * 1000;
const memory = new Map<string, SpeciesSummary | null>();

/** Pick the fields we show from a Wikipedia REST summary response. Null when there is no real article. */
export function parseSummary(json: unknown): SpeciesSummary | null {
  if (!json || typeof json !== 'object') return null;
  const j = json as { type?: string; title?: string; extract?: string; thumbnail?: { source?: string }; content_urls?: { mobile?: { page?: string }; desktop?: { page?: string } } };
  if (j.type === 'disambiguation' || !j.extract || !j.title) return null;
  const url = j.content_urls?.mobile?.page ?? j.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(j.title.replace(/ /g, '_'))}`;
  return { title: j.title, extract: j.extract.trim(), thumbnail: j.thumbnail?.source ?? null, url };
}

export function summaryUrl(sci: string): string {
  return `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(sci.trim().replace(/ /g, '_'))}`;
}

/** Cached account for a scientific name. Resolves null when Wikipedia has nothing or the network is down. */
export async function fetchSpeciesSummary(sci: string, cache?: SummaryCache): Promise<SpeciesSummary | null> {
  if (!sci) return null;
  if (memory.has(sci)) return memory.get(sci) ?? null;
  const key = `wiki:${sci}`;
  const cached = cache?.get(key) ?? null;
  if (cached) {
    try {
      const { at, summary } = JSON.parse(cached) as { at: number; summary: SpeciesSummary | null };
      if (Date.now() - at < TTL_MS) {
        memory.set(sci, summary);
        return summary;
      }
    } catch {
      // fall through and refetch
    }
  }
  try {
    const res = await fetch(summaryUrl(sci), { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(String(res.status));
    const summary = parseSummary(await res.json());
    memory.set(sci, summary);
    cache?.set(key, JSON.stringify({ at: Date.now(), summary }));
    return summary;
  } catch {
    return null;
  }
}
