import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '@/lib/auth';
import * as db from '@/lib/db';

/**
 * Shows the welcome screen to a brand-new account, once per user per device. It waits until the
 * tabs are mounted (so the auth gate's replace has settled) and never fires for an account that
 * already has sightings here. The flag lives in SQLite meta and survives account switches.
 */
export function WelcomeGate() {
  const { session } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const uid = session?.user.id;
    if (!uid || segments[0] !== '(tabs)') return; // tabs mounted: the auth gate's replace has settled
    if (db.getMeta(`welcomed:${uid}`)) return;
    if (db.stats(uid).sightings > 0) {
      db.setMeta(`welcomed:${uid}`, 'skipped');
      return;
    }
    db.setMeta(`welcomed:${uid}`, new Date().toISOString()); // set BEFORE push: once per user per device
    router.push('/welcome');
  }, [session, segments, router]);

  return null;
}
