// Local SQLite store: the source of truth for the signed-in user's own sightings.
// Rows carry `dirty` (needs push) and `deleted` (tombstone until the delete is pushed).
import { File } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

import { localDay } from '@/lib/dates';
import type { Sighting } from '@/types/db';

export interface LocalSighting extends Sighting {
  local_photo_uri: string | null;
  dirty: number;
  deleted: number;
}

const db = SQLite.openDatabaseSync('perch.db');

db.execSync(`
  pragma journal_mode = wal;
  create table if not exists sightings (
    id text primary key,
    user_id text not null,
    species_code text not null,
    observed_at text not null,
    lat real, lng real,
    place_name text,
    photo_path text,
    local_photo_uri text,
    note text not null default '',
    visibility text not null default 'public',
    sensitive integer not null default 0,
    source text not null default 'app',
    source_ref text,
    created_at text not null,
    updated_at text not null,
    dirty integer not null default 1,
    deleted integer not null default 0
  );
  create index if not exists sightings_user_observed on sightings (user_id, observed_at desc);
  create table if not exists meta (key text primary key, value text);
`);
// local_day: the observation date in the device's time zone (YYYY-MM-DD), so year/day filters
// match what the diary displays instead of the UTC date inside observed_at.
if (!db.getAllSync<{ name: string }>('pragma table_info(sightings)').some((c) => c.name === 'local_day')) {
  db.execSync('alter table sightings add column local_day text');
}
for (const r of db.getAllSync<{ id: string; observed_at: string }>('select id, observed_at from sightings where local_day is null')) {
  db.runSync('update sightings set local_day = ? where id = ?', [localDay(r.observed_at), r.id]);
}

export { localDay };

// ---------------------------------------------------------------- change notifications
const listeners = new Set<() => void>();
let version = 0; // any change to local rows (user writes or server pulls)
let localVersion = 0; // user writes only: the signal that something needs pushing
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function notify(local: boolean) {
  version++;
  if (local) localVersion++;
  listeners.forEach((fn) => fn());
}
const getVersion = () => version;
const getLocalVersion = () => localVersion;
/** Increments whenever local sightings change; use as a memo dependency. */
export function useDbVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}
/** Increments only on user writes (not on rows applied from the server). Drives the push debounce. */
export function useLocalWriteVersion(): number {
  return useSyncExternalStore(subscribe, getLocalVersion, getLocalVersion);
}

// ---------------------------------------------------------------- row mapping
type Raw = Omit<LocalSighting, 'sensitive'> & { sensitive: number };

function fromRaw(r: Raw): LocalSighting {
  return { ...r, sensitive: !!r.sensitive };
}

export interface SightingFilter {
  year?: number | null;
  place?: string | null;
  speciesCode?: string | null;
}

function filterSql(f: SightingFilter | undefined, params: (string | number)[]): string {
  let sql = '';
  if (f?.year) {
    sql += ' and substr(local_day, 1, 4) = ?';
    params.push(String(f.year));
  }
  if (f?.place) {
    sql += ' and place_name = ?';
    params.push(f.place);
  }
  if (f?.speciesCode) {
    sql += ' and species_code = ?';
    params.push(f.speciesCode);
  }
  return sql;
}

// ---------------------------------------------------------------- queries
export function listSightings(userId: string, filter?: SightingFilter): LocalSighting[] {
  const params: (string | number)[] = [userId];
  const where = filterSql(filter, params);
  return db.getAllSync<Raw>(`select * from sightings where user_id = ? and deleted = 0${where} order by observed_at desc`, params).map(fromRaw);
}

export function getSighting(id: string, userId: string): LocalSighting | null {
  const r = db.getFirstSync<Raw>('select * from sightings where id = ? and user_id = ? and deleted = 0', [id, userId]);
  return r ? fromRaw(r) : null;
}

/**
 * A device is shared between accounts only through sign-in. Drop every other user's clean rows
 * (dirty rows are kept so an unsynced sighting is never lost) and their cached state.
 */
export function purgeOtherUsers(userId: string) {
  const others = db.getAllSync<{ local_photo_uri: string | null }>('select local_photo_uri from sightings where user_id <> ? and dirty = 0 and local_photo_uri is not null', [userId]);
  for (const o of others) deleteLocalFile(o.local_photo_uri);
  db.withTransactionSync(() => {
    db.runSync('delete from sightings where user_id <> ? and dirty = 0', [userId]);
    db.runSync("delete from meta where (key like 'last_pull:%' or key like 'last_sync_at:%') and key <> 'last_pull:' || ? and key <> 'last_sync_at:' || ?", [userId, userId]);
    db.runSync("delete from meta where key like 'remove_photo:%' and key not like 'remove_photo:' || ? || '/%'", [userId]);
  });
  notify(false);
}

export interface LifeListEntry {
  species_code: string;
  first_seen: string;
  last_seen: string;
  sighting_count: number;
  photo: string | null; // local uri or storage path of the earliest photo
  first_sighting_id: string;
}

export function lifeList(userId: string, filter?: SightingFilter): LifeListEntry[] {
  const params: (string | number)[] = [userId];
  const where = filterSql(filter, params);
  // window functions pick the earliest sighting per species
  return db.getAllSync<LifeListEntry>(
    `with s as (
       select species_code, observed_at, id, coalesce(local_photo_uri, photo_path) as photo,
              row_number() over (partition by species_code order by observed_at asc) as rn,
              count(*) over (partition by species_code) as n,
              max(observed_at) over (partition by species_code) as last_seen,
              first_value(coalesce(local_photo_uri, photo_path)) over (
                partition by species_code order by (coalesce(local_photo_uri, photo_path) is null), observed_at) as any_photo
       from sightings where user_id = ? and deleted = 0${where})
     select species_code, observed_at as first_seen, last_seen, n as sighting_count, any_photo as photo, id as first_sighting_id
     from s where rn = 1 order by observed_at desc`,
    params,
  );
}

export function years(userId: string): number[] {
  return db
    .getAllSync<{ y: string }>('select distinct substr(local_day, 1, 4) as y from sightings where user_id = ? and deleted = 0 order by y desc', [userId])
    .map((r) => Number(r.y));
}

export function places(userId: string): string[] {
  return db
    .getAllSync<{ p: string }>(
      "select place_name as p, count(*) as n from sightings where user_id = ? and deleted = 0 and place_name is not null and place_name <> '' group by place_name order by n desc, p",
      [userId],
    )
    .map((r) => r.p);
}

/** Up to 8 most recently logged species codes, for picker suggestions. */
export function recentSpecies(userId: string): string[] {
  return db
    .getAllSync<{ c: string }>('select species_code as c, max(observed_at) as t from sightings where user_id = ? and deleted = 0 group by species_code order by t desc limit 8', [userId])
    .map((r) => r.c);
}

export function stats(userId: string): { sightings: number; species: number } {
  const r = db.getFirstSync<{ s: number; sp: number }>('select count(*) as s, count(distinct species_code) as sp from sightings where user_id = ? and deleted = 0', [userId]);
  return { sightings: r?.s ?? 0, species: r?.sp ?? 0 };
}

// ---------------------------------------------------------------- writes
export type SightingInput = Omit<LocalSighting, 'created_at' | 'updated_at' | 'dirty' | 'deleted'> & { created_at?: string; updated_at?: string };

export function saveSighting(input: SightingInput): LocalSighting {
  const now = new Date().toISOString();
  const existing = db.getFirstSync<Raw>('select * from sightings where id = ?', [input.id]);
  const row: LocalSighting = {
    ...input,
    created_at: existing?.created_at ?? input.created_at ?? now,
    updated_at: now,
    dirty: 1,
    deleted: 0,
  };
  upsertRow(row);
  notify(true);
  return row;
}

/** Insert or update many rows in one transaction without notifying per row (imports). */
export function saveMany(rows: LocalSighting[]) {
  db.withTransactionSync(() => rows.forEach(upsertRow));
  notify(true);
}

function upsertRow(row: LocalSighting) {
  db.runSync(
    `insert into sightings (id, user_id, species_code, observed_at, lat, lng, place_name, photo_path, local_photo_uri, note, visibility, sensitive, source, source_ref, created_at, updated_at, dirty, deleted, local_day)
     values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     on conflict (id) do update set
       species_code = excluded.species_code, observed_at = excluded.observed_at, local_day = excluded.local_day, lat = excluded.lat, lng = excluded.lng,
       place_name = excluded.place_name, photo_path = excluded.photo_path, local_photo_uri = excluded.local_photo_uri,
       note = excluded.note, visibility = excluded.visibility, sensitive = excluded.sensitive, source = excluded.source,
       source_ref = excluded.source_ref, updated_at = excluded.updated_at, dirty = excluded.dirty, deleted = excluded.deleted`,
    [
      row.id, row.user_id, row.species_code, row.observed_at, row.lat, row.lng, row.place_name, row.photo_path, row.local_photo_uri,
      row.note, row.visibility, row.sensitive ? 1 : 0, row.source, row.source_ref, row.created_at, row.updated_at, row.dirty, row.deleted, localDay(row.observed_at),
    ],
  );
}

export function deleteSighting(id: string) {
  // Never pushed? Just drop it. Otherwise leave a tombstone for sync.
  const r = db.getFirstSync<{ dirty: number; local_photo_uri: string | null }>('select dirty, local_photo_uri from sightings where id = ?', [id]);
  if (!r) return;
  deleteLocalFile(r.local_photo_uri);
  const neverSynced = r.dirty === 1 && !db.getFirstSync('select 1 from meta where key = ? ', [`synced:${id}`]);
  if (neverSynced) db.runSync('delete from sightings where id = ?', [id]);
  else db.runSync('update sightings set deleted = 1, dirty = 1, local_photo_uri = null, updated_at = ? where id = ?', [new Date().toISOString(), id]);
  notify(true);
}

/** Remove a photo copy from the app's document directory. Never throws. */
export function deleteLocalFile(uri: string | null | undefined) {
  if (!uri || !uri.startsWith('file:')) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // best effort
  }
}

/** Remember a storage object to delete on the next sync (photo cleared or replaced). */
export function queuePhotoRemoval(path: string) {
  // Keyed by the owner folder (the first path segment) so purging a user also drops their queue.
  db.runSync('insert or replace into meta (key, value) values (?, ?)', [`remove_photo:${path}`, '1']);
}
/** Paths queued for deletion that no live local row still points at (a re-attached photo reuses the path). */
export function pendingPhotoRemovals(): string[] {
  const queued = db.getAllSync<{ key: string }>("select key from meta where key like 'remove_photo:%'").map((r) => r.key.slice('remove_photo:'.length));
  return queued.filter((path) => {
    const live = db.getFirstSync('select 1 from sightings where photo_path = ? and deleted = 0', [path]);
    if (live) clearPhotoRemoval(path);
    return !live;
  });
}
export function clearPhotoRemoval(path: string) {
  db.runSync('delete from meta where key = ?', [`remove_photo:${path}`]);
}

/** Import dedupe key: species + UTC date + coordinates to 3 decimals. Matches csv.ts and the server unique index. */
export function dedupeKey(speciesCode: string, observedAtIso: string, lat: number | null, lng: number | null): string {
  return `${speciesCode}|${observedAtIso.slice(0, 10)}|${lat?.toFixed(3) ?? ''}|${lng?.toFixed(3) ?? ''}`;
}

/** All dedupe keys already in the diary, for one-pass import checks. */
export function existingDedupeKeys(userId: string): Set<string> {
  const rows = db.getAllSync<{ species_code: string; observed_at: string; lat: number | null; lng: number | null }>(
    'select species_code, observed_at, lat, lng from sightings where user_id = ? and deleted = 0',
    [userId],
  );
  return new Set(rows.map((r) => dedupeKey(r.species_code, r.observed_at, r.lat, r.lng)));
}

// ---------------------------------------------------------------- sync support
export function dirtyRows(userId: string): LocalSighting[] {
  return db.getAllSync<Raw>('select * from sightings where user_id = ? and dirty = 1', [userId]).map(fromRaw);
}

export function pendingCount(userId: string): number {
  return db.getFirstSync<{ n: number }>('select count(*) as n from sightings where user_id = ? and dirty = 1', [userId])?.n ?? 0;
}

/**
 * Mark a row clean, but only if it has not been edited since the pushed copy was read
 * (`pushedUpdatedAt`). An edit made during the upload stays dirty and is pushed next time.
 */
export function markSynced(id: string, pushedUpdatedAt: string, patch: { photo_path?: string | null } = {}) {
  db.withTransactionSync(() => {
    if (patch.photo_path !== undefined) db.runSync('update sightings set photo_path = ? where id = ?', [patch.photo_path, id]);
    db.runSync('update sightings set dirty = 0 where id = ? and updated_at = ?', [id, pushedUpdatedAt]);
    db.runSync('insert or replace into meta (key, value) values (?, ?)', [`synced:${id}`, '1']);
  });
}
export function markManySynced(rows: { id: string; updated_at: string }[]) {
  db.withTransactionSync(() => {
    for (const r of rows) {
      db.runSync('update sightings set dirty = 0 where id = ? and updated_at = ?', [r.id, r.updated_at]);
      db.runSync('insert or replace into meta (key, value) values (?, ?)', [`synced:${r.id}`, '1']);
    }
  });
}

export function removeRow(id: string) {
  const r = db.getFirstSync<{ local_photo_uri: string | null }>('select local_photo_uri from sightings where id = ?', [id]);
  deleteLocalFile(r?.local_photo_uri);
  db.runSync('delete from sightings where id = ?', [id]);
  db.runSync('delete from meta where key = ?', [`synced:${id}`]);
}

/** Apply rows from the server. Local dirty rows win until they are pushed. */
export function applyServerRows(rows: Sighting[]) {
  db.withTransactionSync(() => {
    for (const s of rows) {
      const local = db.getFirstSync<{ dirty: number; local_photo_uri: string | null }>('select dirty, local_photo_uri from sightings where id = ?', [s.id]);
      if (local?.dirty) continue;
      upsertRow({ ...s, local_photo_uri: local?.local_photo_uri ?? null, dirty: 0, deleted: 0 });
      db.runSync('insert or replace into meta (key, value) values (?, ?)', [`synced:${s.id}`, '1']);
    }
  });
  notify(false);
}

/** Drop clean local rows the server no longer has (deleted from another device). Returns how many were removed. */
export function pruneMissing(userId: string, serverIds: Set<string>): number {
  const local = db.getAllSync<{ id: string }>('select id from sightings where user_id = ? and dirty = 0', [userId]);
  const gone = local.filter(({ id }) => !serverIds.has(id));
  if (!gone.length) return 0;
  db.withTransactionSync(() => {
    for (const { id } of gone) removeRow(id);
  });
  notify(false);
  return gone.length;
}

export function getMeta(key: string): string | null {
  return db.getFirstSync<{ value: string }>('select value from meta where key = ?', [key])?.value ?? null;
}
export function setMeta(key: string, value: string) {
  db.runSync('insert or replace into meta (key, value) values (?, ?)', [key, value]);
}

export function clearLocalData() {
  db.execSync('delete from sightings; delete from meta;');
  notify(false);
}

// ---- W1-picker
/** Sightings per species (code → count), so the picker can show seen counts and tag the rest as lifers. */
export function speciesCounts(userId: string): Map<string, number> {
  const rows = db.getAllSync<{ c: string; n: number }>('select species_code as c, count(*) as n from sightings where user_id = ? and deleted = 0 group by species_code', [userId]);
  return new Map(rows.map((r) => [r.c, r.n]));
}
