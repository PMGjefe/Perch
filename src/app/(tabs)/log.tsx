import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SightingForm } from '@/components/SightingForm';
import { Screen, Text } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { spacing } from '@/lib/theme';

export default function LogScreen() {
  const userId = useUserId();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [resetKey, setResetKey] = useState(0);

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
            router.push({ pathname: '/sighting/[id]', params: { id: s.id } });
          }}
        />
      </Screen>
    </KeyboardAvoidingView>
  );
}
