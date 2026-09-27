import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { type Lifer, LiferMoment } from '@/components/LiferMoment';
import { SightingForm } from '@/components/SightingForm';
import { Screen, Text } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { speciesByCode } from '@/lib/taxonomy';
import { spacing } from '@/lib/theme';

export default function LogScreen() {
  const userId = useUserId();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [resetKey, setResetKey] = useState(0);
  const [lifer, setLifer] = useState<Lifer | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll style={{ paddingTop: insets.top + spacing.md, gap: spacing.lg }}>
        <View>
          <Text variant="title">Log a bird</Text>
          <Text muted>Works offline. Syncs when you are back online.</Text>
        </View>
        <SightingForm
          key={resetKey}
          userId={userId}
          resetKey={resetKey}
          onSaved={(s) => {
            setResetKey((k) => k + 1);
            // A lifer is a species with exactly one sighting: the one just saved.
            const count = db.listSightings(userId, { speciesCode: s.species_code }).length;
            if (count === 1) {
              const sp = speciesByCode(s.species_code);
              setLifer({ species: sp?.common ?? s.species_code, scientific: sp?.sci ?? '', number: db.stats(userId).species });
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
