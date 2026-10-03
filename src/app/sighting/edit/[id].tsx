import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

import { SightingForm } from '@/components/SightingForm';
import { Button, Empty, Screen } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { useLocalSighting } from '@/hooks/useLocalSightings';

export default function EditSighting() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const router = useRouter();
  const sighting = useLocalSighting(id, userId);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Edit sighting' }} />
      <Screen scroll>
        {sighting ? (
          <SightingForm userId={userId} existing={sighting} onSaved={() => router.back()} />
        ) : (
          <Empty icon="eye-off-outline" title="Sighting not found" body="It may have been deleted on another device." action={<Button title="Back" kind="secondary" onPress={() => router.back()} />} />
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}
