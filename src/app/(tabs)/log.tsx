import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';

import { type Lifer, LiferMoment } from '@/components/LiferMoment';
import { SightingForm } from '@/components/SightingForm';
import { Screen, Text } from '@/components/ui';
import { useAuth, useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { speciesByCode } from '@/lib/taxonomy';

/** A brand-new account cannot have server rows this device has not seen yet. */
const FRESH_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000;

export default function LogScreen() {
  const userId = useUserId();
  const { profile, session } = useAuth();
  const router = useRouter();
  // The welcome screen sends `pick=1` so the species picker opens straight away.
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const [resetKey, setResetKey] = useState(0);
  const [lifer, setLifer] = useState<Lifer | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const lastReset = useRef(0);

  // A form left open for a while has a stale time and location; start fresh when the tab comes back.
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (lastReset.current && now - lastReset.current > 5 * 60 * 1000) setResetKey((k) => k + 1);
      lastReset.current = now;
    }, []),
  );

  // A plain label above the headline; the bird's name is the title.
  const header = (
    <View>
      <Text variant="caption" muted>
        New sighting
      </Text>
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen padded={false} style={{ flex: 1 }}>
        <SightingForm
          key={resetKey}
          userId={userId}
          resetKey={resetKey}
          sticky
          header={header}
          // Only on the form's very first mount after arriving from welcome; a save or the 5-minute reset bumps resetKey.
          autoOpenPicker={pick === '1' && resetKey === 0}
          onSaved={(s) => {
            setResetKey((k) => k + 1);
            // A lifer is a species with exactly one sighting: the one just saved.
            // Trust the local store once the first pull from the server has happened, or when the
            // account is so new there cannot be server rows this device has missed.
            const createdAt = profile?.created_at ?? session?.user.created_at;
            const freshAccount = !!createdAt && Date.now() - new Date(createdAt).getTime() < FRESH_ACCOUNT_WINDOW_MS;
            const synced = !!db.getMeta(`last_sync_at:${userId}`);
            const count = db.listSightings(userId, { speciesCode: s.species_code }).length;
            if ((synced || freshAccount) && count === 1) {
              const sp = speciesByCode(s.species_code);
              // Life-list number = rank by first-seen date, matching the numbering on the Life tab.
              const number = db.lifeList(userId).filter((e) => e.first_seen <= s.observed_at).length;
              setLifer({
                species: sp?.common ?? s.species_code,
                scientific: sp?.sci ?? '',
                number,
                photoLocalUri: s.local_photo_uri,
                photoPath: s.photo_path,
              });
              setPendingId(s.id);
            } else {
              router.push({ pathname: '/sighting/[id]', params: { id: s.id } });
            }
          }}
        />
        <LiferMoment
          lifer={lifer}
          onDone={() => {
            setLifer(null);
            if (pendingId) router.push({ pathname: '/sighting/[id]', params: { id: pendingId } });
            setPendingId(null);
          }}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
