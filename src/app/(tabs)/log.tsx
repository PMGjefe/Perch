import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Lifer, LiferMoment } from '@/components/LiferMoment';
import { SightingForm } from '@/components/SightingForm';
import { Screen, Text } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { daylight } from '@/lib/insights';
import { speciesByCode } from '@/lib/taxonomy';
import { spacing } from '@/lib/theme';

/** Light-aware one-liner. Dawn and dusk are when birders are out; say so. */
function greeting(): string {
  const now = new Date();
  const d = daylight(now);
  const h = now.getHours();
  if (d === 0) return h < 5 ? 'Owls, nightjars, and the first chorus soon.' : 'Nocturnal flight calls count too.';
  if (d < 1 && h < 12) return 'Dawn chorus hours.';
  if (d < 1) return 'Golden hour. Roost flights and late songs.';
  return 'What did you see?';
}

export default function LogScreen() {
  const userId = useUserId();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll style={{ paddingTop: insets.top + spacing.md, gap: spacing.lg }}>
        <View>
          <Text variant="title">Log a bird</Text>
          <Text muted>{greeting()}</Text>
        </View>
        <SightingForm
          key={resetKey}
          userId={userId}
          resetKey={resetKey}
          onSaved={(s) => {
            setResetKey((k) => k + 1);
            // A lifer is a species with exactly one sighting: the one just saved.
            // Only trust the local store once the first pull from the server has happened.
            const synced = !!db.getMeta(`last_sync_at:${userId}`);
            const count = db.listSightings(userId, { speciesCode: s.species_code }).length;
            if (synced && count === 1) {
              const sp = speciesByCode(s.species_code);
              // Life-list number = rank by first-seen date, matching the numbering on the Life tab.
              const number = db.lifeList(userId).filter((e) => e.first_seen <= s.observed_at).length;
              setLifer({ species: sp?.common ?? s.species_code, scientific: sp?.sci ?? '', number });
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
