// Push local changes to Supabase and pull the server copy back. Safe to call often.
import { File } from 'expo-file-system';
import * as Network from 'expo-network';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import * as db from '@/lib/db';
import { invalidatePhotoUrl } from '@/lib/photos';
import { PHOTO_BUCKET, supabase } from '@/lib/supabase';
import type { Sighting } from '@/types/db';

let inFlight: Promise<SyncResult> | null = null;

// Sync status lives outside React so screens can subscribe without effects that set state.
interface SyncStatus {
  syncing: boolean;
  lastError: string | null;
  lastSyncAt: string | null;
}
let status: SyncStatus = { syncing: false, lastError: null, lastSyncAt: null };
const statusListeners = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  statusListeners.forEach((l) => l());
}
const subscribeStatus = (l: () => void) => {
  statusListeners.add(l);
  return () => {
    statusListeners.delete(l);
  };
};
const getStatus = () => status;

export interface SyncResult {
  pushed: number;
  pulled: number;
  skipped: boolean;
  error?: string;
}

export async function isOnline(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    return !!s.isConnected && s.isInternetReachable !== false;
  } catch {
    return true;
  }
}

export function syncNow(userId: string): Promise<SyncResult> {
  if (inFlight) return inFlight;
  setStatus({ syncing: true });
  inFlight = run(userId)
    .then((r) => {
      setStatus({ syncing: false, lastError: r.error ?? null, lastSyncAt: r.skipped || r.error ? status.lastSyncAt : new Date().toISOString() });
      return r;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

const PAGE = 1000; // PostgREST max_rows in supabase/config.toml
const PUSH_CHUNK = 200;

async function run(userId: string): Promise<SyncResult> {
  if (!(await isOnline())) return { pushed: 0, pulled: 0, skipped: true };
  let pushed = 0;
  let pulled = 0;
  try {
    // ---- push (one failure must not block the rest)
    const failures: string[] = [];
    const dirty = db.dirtyRows(userId);
    const deletes = dirty.filter((r) => r.deleted);
    const withPhoto = dirty.filter((r) => !r.deleted && r.local_photo_uri && !r.photo_path);
    const plain = dirty.filter((r) => !r.deleted && !(r.local_photo_uri && !r.photo_path));

    for (const row of deletes) {
      try {
        const { error } = await supabase.from('sightings').delete().eq('id', row.id);
        if (error) throw error;
        if (row.photo_path) db.queuePhotoRemoval(row.photo_path);
        db.removeRow(row.id);
        pushed++;
      } catch (e) {
        failures.push(errMsg(e));
      }
    }

    // Rows needing a photo upload go one at a time; everything else in chunks.
    for (const row of withPhoto) {
      try {
        const photoPath = await uploadPhoto(userId, row.id, row.local_photo_uri!);
        const { error } = await supabase.from('sightings').upsert(toPayload(row, userId, photoPath), { onConflict: 'id' });
        if (error) throw error;
        db.markSynced(row.id, { photo_path: photoPath });
        pushed++;
      } catch (e) {
        failures.push(errMsg(e));
      }
    }
    for (let i = 0; i < plain.length; i += PUSH_CHUNK) {
      const chunk = plain.slice(i, i + PUSH_CHUNK);
      const { error } = await supabase.from('sightings').upsert(chunk.map((r) => toPayload(r, userId, r.photo_path)), { onConflict: 'id' });
      if (!error) {
        db.markManySynced(chunk.map((r) => r.id));
        pushed += chunk.length;
        continue;
      }
      // A chunk failed: retry row by row so one bad row does not hold the rest hostage.
      for (const row of chunk) {
        const { error: rowErr } = await supabase.from('sightings').upsert(toPayload(row, userId, row.photo_path), { onConflict: 'id' });
        if (!rowErr) {
          db.markSynced(row.id);
          pushed++;
        } else if (rowErr.code === '23505' && row.source !== 'app') {
          // Imported row that already exists server-side (same species/day/place): drop the local copy.
          db.removeRow(row.id);
        } else {
          failures.push(rowErr.message);
        }
      }
    }

    // Storage objects for cleared or replaced photos.
    for (const path of db.pendingPhotoRemovals()) {
      const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([path]);
      if (!error) db.clearPhotoRemoval(path);
    }

    // ---- pull: everything changed since the watermark (server-stamped updated_at), paged
    const since = db.getMeta(`last_pull:${userId}`);
    let from = 0;
    for (;;) {
      let q = supabase.from('sightings').select('*').eq('user_id', userId).order('updated_at', { ascending: true }).order('id').range(from, from + PAGE - 1);
      if (since) q = q.gte('updated_at', since); // gte: rows sharing the boundary timestamp are re-applied harmlessly
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as Sighting[];
      if (rows.length) {
        db.applyServerRows(rows);
        db.setMeta(`last_pull:${userId}`, rows[rows.length - 1].updated_at);
        pulled += rows.length;
      }
      if (rows.length < PAGE) break;
      from += PAGE;
    }

    // ---- id sweep for rows deleted elsewhere, paged so nothing beyond the first page is mistaken for deleted
    const serverIds = new Set<string>();
    for (let start = 0; ; start += PAGE) {
      const { data, error } = await supabase.from('sightings').select('id').eq('user_id', userId).order('id').range(start, start + PAGE - 1);
      if (error) throw error;
      for (const r of (data ?? []) as { id: string }[]) serverIds.add(r.id);
      if ((data ?? []).length < PAGE) break;
    }
    db.pruneMissing(userId, serverIds);
    db.setMeta(`last_sync_at:${userId}`, new Date().toISOString());
    return { pushed, pulled, skipped: false, error: failures.length ? `${failures.length} change(s) failed: ${failures[0]}` : undefined };
  } catch (e) {
    return { pushed, pulled, skipped: false, error: errMsg(e) };
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e);
}

function toPayload(row: db.LocalSighting, userId: string, photoPath: string | null): Sighting {
  return {
    id: row.id,
    user_id: userId,
    species_code: row.species_code,
    observed_at: row.observed_at,
    lat: row.lat,
    lng: row.lng,
    place_name: row.place_name,
    photo_path: photoPath,
    note: row.note,
    visibility: row.visibility,
    sensitive: row.sensitive,
    source: row.source,
    source_ref: row.source_ref,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function uploadPhoto(userId: string, sightingId: string, uri: string): Promise<string> {
  const path = `${userId}/${sightingId}.jpg`;
  const bytes = await new File(uri).arrayBuffer();
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) throw error;
  invalidatePhotoUrl(path);
  return path;
}

/** Keeps the local store in sync: on mount, on foreground, on reconnect, and after local writes. */
export function useSync(userId: string | null) {
  const { syncing, lastError, lastSyncAt } = useSyncExternalStore(subscribeStatus, getStatus, getStatus);
  const version = db.useDbVersion();
  const localVersion = db.useLocalWriteVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `version` is the change signal for the local store
  const pending = useMemo(() => (userId ? db.pendingCount(userId) : 0), [userId, version]);

  const sync = useCallback(() => (userId ? syncNow(userId) : Promise.resolve(null)), [userId]);

  useEffect(() => {
    sync();
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') sync();
    });
    const net = Network.addNetworkStateListener((s) => {
      if (s.isConnected) sync();
    });
    return () => {
      app.remove();
      net.remove();
    };
  }, [sync]);

  // Debounced sync after a local write (rows applied from the server do not count, or syncing would never stop).
  useEffect(() => {
    if (localVersion === 0) return;
    const t = setTimeout(sync, 800);
    return () => clearTimeout(t);
  }, [localVersion, sync]);

  return { syncing, pending, lastError, lastSyncAt, sync };
}
