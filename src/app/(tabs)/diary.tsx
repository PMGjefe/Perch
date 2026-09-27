import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { Filters } from '@/components/Filters';
import { SightingCard } from '@/components/SightingCard';
import { SightingsMap } from '@/components/SightingsMap';
import { useSyncState } from '@/components/SyncProvider';
import { Chip, Empty, Row, Text } from '@/components/ui';
import { useLocalQuery, useLocalSightings } from '@/hooks/useLocalSightings';
import { useAuth, useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { haversineM } from '@/lib/geo';
import { formatDate } from '@/lib/format';
import { spacing, useTheme } from '@/lib/theme';

export default function DiaryScreen() {
  const userId = useUserId();
  const { profile } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { pending, syncing, lastError, sync } = useSyncState();
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [year, setYear] = useState<number | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const filter = useMemo(() => ({ year, place }), [year, place]);
  const sightings = useLocalSightings(userId, filter);
  const years = useLocalQuery(() => db.years(userId), [userId]);
  const places = useLocalQuery(() => db.places(userId), [userId]);

  // Preview how others see pins near home.
  const home = profile?.hide_home && profile.home_lat != null && profile.home_lng != null ? { lat: profile.home_lat, lng: profile.home_lng } : null;
  const fuzzPreview = (s: { lat: number | null; lng: number | null }) => !!home && s.lat != null && s.lng != null && haversineM({ lat: s.lat, lng: s.lng }, home) <= 500;

  const header = (
    <View style={{ backgroundColor: colors.bg }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <View>
          <Text variant="title">{sightings.length} sightings</Text>
          <Pressable onPress={() => sync()}>
            <Text variant="caption" muted>
              {syncing ? 'Syncing…' : lastError ? `Sync failed · tap to retry` : pending ? `${pending} waiting to sync` : 'Synced'}
            </Text>
          </Pressable>
        </View>
        <Row>
          <Chip label="List" icon="list" active={mode === 'list'} onPress={() => setMode('list')} />
          <Chip label="Map" icon="map" active={mode === 'map'} onPress={() => setMode('map')} />
        </Row>
      </Row>
      <Filters years={years} places={places} year={year} place={place} onYear={setYear} onPlace={setPlace} />
    </View>
  );

  if (mode === 'map') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {header}
        <SightingsMap sightings={sightings} fuzzPreview={fuzzPreview} onPress={(id) => router.push({ pathname: '/sighting/[id]', params: { id } })} />
        {home ? (
          <Row style={{ padding: spacing.sm, paddingHorizontal: spacing.lg }}>
            <Ionicons name="home-outline" size={14} color={colors.textMuted} />
            <Text variant="caption" muted>
              Circles show pins near home as others see them.
            </Text>
          </Row>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={sightings}
        keyExtractor={(s) => s.id}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        renderItem={({ item, index }) => {
          const day = formatDate(item.observed_at);
          const prevDay = index > 0 ? formatDate(sightings[index - 1].observed_at) : null;
          return (
            <View style={{ paddingHorizontal: spacing.lg }}>
              {day !== prevDay ? (
                <Text variant="label" muted style={{ paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
                  {day}
                </Text>
              ) : (
                <View style={{ height: spacing.md }} />
              )}
              <SightingCard sighting={item} compact pending={!!item.dirty} />
            </View>
          );
        }}
        ListEmptyComponent={<Empty icon="book-outline" title={year || place ? 'Nothing matches' : 'No sightings yet'} body={year || place ? 'Try a different filter.' : 'Tap + to log your first bird.'} />}
      />
    </View>
  );
}
