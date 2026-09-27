// Sighting photos live in a private bucket. The app resolves storage paths to short-lived signed
// URLs through this cache, so a card can render immediately once its URL is known and a feed can
// sign a whole page in one request.
import { useEffect, useSyncExternalStore } from 'react';

import { PHOTO_BUCKET, supabase } from '@/lib/supabase';

const TTL_SECONDS = 3600;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface Entry {
  url: string;
  expiresAt: number;
}

const cache = new Map<string, Entry>();
const inFlight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();
let version = 0;

function notify() {
  version++;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getVersion = () => version;

/** True for values that need no signing: local files and absolute URLs (seed data). */
export function isDirectUri(path: string): boolean {
  return path.startsWith('http') || path.startsWith('file:') || path.startsWith('data:');
}

function fresh(e: Entry | undefined): e is Entry {
  return !!e && e.expiresAt - REFRESH_MARGIN_MS > Date.now();
}

/** Resolve a storage path synchronously if a fresh signed URL is cached. */
export function cachedPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (isDirectUri(path)) return path;
  const e = cache.get(path);
  return fresh(e) ? e.url : null;
}

/** Sign many paths in one request. Paths already fresh in the cache are skipped. */
export async function signPhotoUrls(paths: (string | null | undefined)[]): Promise<void> {
  const need = [...new Set(paths.filter((p): p is string => !!p && !isDirectUri(p) && !fresh(cache.get(p)) && !inFlight.has(p)))];
  if (!need.length) return;
  const p = (async () => {
    try {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(need, TTL_SECONDS);
      if (error) throw error;
      const expiresAt = Date.now() + TTL_SECONDS * 1000;
      for (const row of data ?? []) {
        if (row.signedUrl && row.path) cache.set(row.path, { url: row.signedUrl, expiresAt });
      }
      notify();
    } catch {
      // Leave entries unset; consumers keep showing the placeholder and a later render retries.
    } finally {
      for (const n of need) inFlight.delete(n);
    }
  })();
  for (const n of need) inFlight.set(n, p);
  await p;
}

/** Forget a path (after the photo is replaced or deleted). */
export function invalidatePhotoUrl(path: string) {
  cache.delete(path);
  notify();
}

/** Signed (or direct) URL for a photo path; null until it is known. Triggers signing when needed. */
export function usePhotoUrl(path: string | null | undefined): string | null {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  const url = cachedPhotoUrl(path);
  useEffect(() => {
    if (path && !url) signPhotoUrls([path]);
  }, [path, url]);
  return url;
}

/** Sign a page of paths ahead of rendering (feeds, lists). */
export function usePrefetchPhotoUrls(paths: (string | null | undefined)[]) {
  const key = paths.filter(Boolean).join('|');
  useEffect(() => {
    if (key) signPhotoUrls(key.split('|'));
  }, [key]);
}
