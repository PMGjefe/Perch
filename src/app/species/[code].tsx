import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { FlatList, View } from 'react-native';

import { Rise } from '@/components/motion';
import { SightingCard } from '@/components/SightingCard';
import { SightingsMap } from '@/components/SightingsMap';
import { Stat } from '@/components/Stat';
import { useBottomPadding } from '@/components/TabBarInset';
import { Empty, Row, Text } from '@/components/ui';
import { useLocalQuery, useLocalSightings } from '@/hooks/useLocalSightings';
import { useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { formatDate } from '@/lib/format';
import { speciesByCode } from '@/lib/taxonomy';
import { fonts, radius, spacing, useTheme } from '@/lib/theme';

export default function SpeciesScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const userId = useUserId();
  const router = useRouter();
  const { colors } = useTheme();
  const bottomPad = useBottomPadding(spacing.xxl);
  const sp = speciesByCode(code);
  const sightings = useLocalSightings(userId, { speciesCode: code });
  const life = useLocalQuery(() => db.lifeList(userId), [userId]);
  const first = sightings[sightings.length - 1];
  const rank = useMemo(() => (first ? life.filter((e) => e.first_seen <= first.observed_at).length : 0), [life, first]);
  const places = useMemo(() => new Set(sightings.map((s) => s.place_name).filter(Boolean)).size, [sightings]);
  const withPins = sightings.filter((s) => s.lat != null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: '' }} />
      <FlatList
        data={sightings}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: bottomPad }}
        ListHeaderComponent={
          <View style={{ gap: spacing.lg, marginBottom: spacing.sm }}>
            <Rise>
              <View style={{ gap: 2 }}>
                {first ? (
                  <Text style={{ fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 2.5, color: colors.accent }}>LIFER #{rank}</Text>
                ) : null}
                <Text variant="display" style={{ fontSize: 38, lineHeight: 42 }}>
                  {sp?.common ?? code}
                </Text>
                <Text style={{ fontFamily: fonts.displayItalic, fontSize: 18, color: colors.textMuted }}>{sp?.sci}</Text>
                <Text variant="caption" muted>
                  {sp?.family}
                </Text>
              </View>
            </Rise>
            {first ? (
              <Rise index={1}>
                <Row style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, justifyContent: 'space-around' }}>
                  <Stat value={sightings.length} label={sightings.length === 1 ? 'sighting' : 'sightings'} />
                  <Stat value={places} label={places === 1 ? 'place' : 'places'} />
                  <Stat value={formatDate(first.observed_at, false)} label={`first, ${new Date(first.observed_at).getFullYear()}`} />
                </Row>
              </Rise>
            ) : null}
            {withPins.length ? (
              <Rise index={2}>
                <View style={{ height: 200, borderRadius: radius.lg, overflow: 'hidden' }}>
                  <SightingsMap sightings={withPins} onPress={(id) => router.push({ pathname: '/sighting/[id]', params: { id } })} />
                </View>
              </Rise>
            ) : null}
            {sightings.length ? (
              <Text variant="label" muted>
                Every time
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item, index }) => <SightingCard index={index + 3} sighting={item} compact pending={!!item.dirty} />}
        ListEmptyComponent={<Empty icon="binoculars-outline" title="Not on your list yet" body="Log a sighting and it will appear here." />}
      />
    </View>
  );
}
