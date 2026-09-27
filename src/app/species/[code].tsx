import { Stack, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { FlatList, View } from 'react-native';

import { SightingCard } from '@/components/SightingCard';
import { Empty, Text } from '@/components/ui';
import { useLocalSightings } from '@/hooks/useLocalSightings';
import { useUserId } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { speciesByCode } from '@/lib/taxonomy';
import { spacing, useTheme } from '@/lib/theme';

export default function SpeciesScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const userId = useUserId();
  const { colors } = useTheme();
  const sp = speciesByCode(code);
  const sightings = useLocalSightings(userId, { speciesCode: code });
  const first = sightings[sightings.length - 1];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: sp?.common ?? code }} />
      <FlatList
        data={sightings}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        ListHeaderComponent={
          <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
            <Text variant="title">{sp?.common ?? code}</Text>
            <Text muted style={{ fontStyle: 'italic' }}>
              {sp?.sci}
            </Text>
            <Text variant="caption" muted>
              {sp?.family}
              {first ? ` · first seen ${formatDate(first.observed_at)} · ${sightings.length} sighting${sightings.length === 1 ? '' : 's'}` : ''}
            </Text>
          </View>
        }
        renderItem={({ item }) => <SightingCard sighting={item} compact pending={!!item.dirty} />}
        ListEmptyComponent={<Empty icon="binoculars-outline" title="Not on your list yet" body="Log a sighting and it will appear here." />}
      />
    </View>
  );
}
