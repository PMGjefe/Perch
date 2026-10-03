// CSV parsing and importers for eBird ("My eBird Data" export) and Merlin saved-bird exports.
import { findByCommonName, findByScientificName } from '@/lib/taxonomy';
import type { SightingSource } from '@/types/db';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c !== '\r') field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

export interface ImportRow {
  species_code: string;
  common_name: string;
  observed_at: string; // ISO
  lat: number | null;
  lng: number | null;
  place_name: string | null;
  note: string;
  source: SightingSource;
  source_ref: string | null;
}

export interface ImportResult {
  source: SightingSource;
  rows: ImportRow[];
  unmatched: string[]; // species names we could not map
  skippedNoDate: number;
  duplicatesInFile: number;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

function findCol(header: string[], ...candidates: string[]): number {
  const h = header.map(norm);
  for (const c of candidates) {
    const i = h.indexOf(norm(c));
    if (i >= 0) return i;
  }
  return -1;
}

/** Detects the export format from its header. */
export function detectSource(header: string[]): SightingSource | null {
  const h = header.map(norm);
  if (h.includes('submissionid') && h.includes('commonname')) return 'ebird';
  if (h.includes('commonname') || h.includes('species') || h.includes('bird')) return 'merlin';
  return null;
}

function parseDate(dateRaw: string, timeRaw: string): Date | null {
  const d = dateRaw.trim();
  const t = timeRaw.trim();
  let y = 0, m = 0, day = 0;
  let mm: RegExpMatchArray | null;
  if ((mm = d.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) [y, m, day] = [+mm[1], +mm[2], +mm[3]];
  else if ((mm = d.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/))) [m, day, y] = [+mm[1], +mm[2], +mm[3]]; // MM-DD-YYYY (older eBird exports)
  else if ((mm = d.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})$/))) [day, m, y] = [+mm[1], monthIndex(mm[2]), +mm[3]];
  else if ((mm = d.match(/^([A-Za-z]{3})[a-z]* (\d{1,2}),? (\d{4})$/))) [m, day, y] = [monthIndex(mm[1]), +mm[2], +mm[3]];
  else {
    const parsed = new Date(d);
    if (Number.isNaN(parsed.getTime())) return null;
    [y, m, day] = [parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate()];
  }
  if (!y || !m || !day) return null;
  let hh = 12, mi = 0;
  const tm = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?/);
  if (tm) {
    hh = +tm[1];
    mi = +tm[2];
    const ampm = tm[4]?.toUpperCase();
    if (ampm === 'PM' && hh < 12) hh += 12;
    if (ampm === 'AM' && hh === 12) hh = 0;
  }
  const out = new Date(y, m - 1, day, hh, mi);
  return Number.isNaN(out.getTime()) ? null : out;
}

function monthIndex(abbr: string): number {
  return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(abbr.slice(0, 3).toLowerCase()) + 1;
}

function num(s: string | undefined): number | null {
  const t = s?.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Parse an eBird or Merlin CSV into candidate sightings. Species are matched against the bundled taxonomy. */
export function importCsv(text: string): ImportResult {
  if (text.length > 25 * 1024 * 1024) throw new Error('That file is too large (25 MB max).');
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('The file has no data rows.');
  if (rows.length > 50_001) throw new Error('That file has more than 50,000 rows. Split it and import in parts.');
  const header = rows[0];
  const source = detectSource(header);
  if (!source) throw new Error('Unrecognised CSV. Expected an eBird "My eBird Data" export or a Merlin saved-birds export.');

  const cCommon = findCol(header, 'Common Name', 'Species', 'Bird', 'Name');
  const cSci = findCol(header, 'Scientific Name', 'Sci Name', 'Latin Name');
  const cDate = findCol(header, 'Date', 'Observation Date', 'Date Observed', 'Sighting Date');
  const cTime = findCol(header, 'Time', 'Observation Time');
  const cLoc = findCol(header, 'Location', 'Location Name', 'Place', 'Site');
  const cLat = findCol(header, 'Latitude', 'Lat');
  const cLng = findCol(header, 'Longitude', 'Lng', 'Lon', 'Long');
  const cNote = findCol(header, 'Observation Details', 'Notes', 'Note', 'Comments', 'Checklist Comments');
  const cCount = findCol(header, 'Count', 'Number');
  const cRef = findCol(header, 'Submission ID', 'Checklist ID', 'ID');
  if (cCommon < 0 && cSci < 0) throw new Error('No species column found.');
  if (cDate < 0) throw new Error('No date column found.');

  const out: ImportRow[] = [];
  const unmatched = new Set<string>();
  const seen = new Set<string>();
  let skippedNoDate = 0;
  let duplicatesInFile = 0;

  for (const r of rows.slice(1)) {
    const common = cCommon >= 0 ? r[cCommon]?.trim() ?? '' : '';
    const sci = cSci >= 0 ? r[cSci]?.trim() ?? '' : '';
    const sp = (common && findByCommonName(common)) || (sci && findByScientificName(sci)) || null;
    if (!sp) {
      if (common || sci) unmatched.add(common || sci);
      continue;
    }
    const when = parseDate(r[cDate] ?? '', cTime >= 0 ? r[cTime] ?? '' : '');
    if (!when || when.getTime() > Date.now() + 86_400_000) {
      skippedNoDate++;
      continue;
    }
    const lat = cLat >= 0 ? num(r[cLat]) : null;
    const lng = cLng >= 0 ? num(r[cLng]) : null;
    const key = `${sp.code}|${when.toISOString().slice(0, 10)}|${lat?.toFixed(3) ?? ''}|${lng?.toFixed(3) ?? ''}`;
    if (seen.has(key)) {
      duplicatesInFile++;
      continue;
    }
    seen.add(key);
    const count = cCount >= 0 ? r[cCount]?.trim() : '';
    const details = cNote >= 0 ? r[cNote]?.trim() ?? '' : '';
    const note = [count && count !== 'X' && count !== '1' ? `Count: ${count}` : '', details].filter(Boolean).join('\n');
    out.push({
      species_code: sp.code,
      common_name: sp.common,
      observed_at: when.toISOString(),
      lat: lat != null && lng != null ? lat : null,
      lng: lat != null && lng != null ? lng : null,
      place_name: cLoc >= 0 ? r[cLoc]?.trim() || null : null,
      note,
      source,
      source_ref: cRef >= 0 ? r[cRef]?.trim() || null : null,
    });
  }
  return { source, rows: out, unmatched: [...unmatched], skippedNoDate, duplicatesInFile };
}
