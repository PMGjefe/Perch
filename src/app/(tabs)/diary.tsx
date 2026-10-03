import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { Filters } from '@/components/Filters';
import { SightingCard } from '@/components/SightingCard';
import { SightingsMap } from '@/components/SightingsMap';
import { useSyncState } from '@/components/SyncProvider';
import { useBottomPadding } from '@/components/TabBarInset';
import { Button, Chip, Empty, Row, Text } from '@/components/ui';
import { useLocalQuery, useLocalSightings } from '@/hooks/useLocalSightings';
import { useAuth, useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { haversineM } from '@/lib/geo';
import { groupOutings } from '@/lib/insights';
import { usePrefetchPhotoUrls } from '@/lib/photos';
import { formatDay } from '@/lib/format';
import { spacing, useTheme } from '@/lib/theme';

export default function DiaryScreen() {
  const userId = useUserId();
  const bottomPad = useBottomPadding(spacing.xxl);
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
  const life = useLocalQuery(() => db.lifeList(userId), [userId]);
  const firstSeen = useMemo(() => new Map(life.map((e) => [e.species_code, e.first_sighting_id])), [life]);
  // Outings: same day, same patch. Rows are flattened so one FlatList still virtualises everything.
  const rows = useMemo(() => groupOutings(sightings, firstSeen).flatMap((o) => [{ kind: 'outing' as const, outing: o }, ...o.sightings.map((s) => ({ kind: 'sighting' as const, s, key: s.id }))]), [sightings, firstSeen]);
  usePrefetchPhotoUrls(sightings.filter((s) => !s.local_photo_uri).map((s) => s.photo_path));

  // Preview how others see pins near home.
  const home = profile?.hide_home && profile.home_lat != null && profile.home_lng != null ? { lat: profile.home_lat, lng: profile.home_lng } : null;
  const fuzzPreview = (s: { lat: number | null; lng: number | null }) => !!home && s.lat != null && s.lng != null && haversineM({ lat: s.lat, lng: s.lng }, home) <= 500;

  const header = (
    <View style={{ backgroundColor: colors.bg }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        <View>
          <Text variant="title">{sightings.length} sightings</Text>
          {syncing || lastError || pending ? (
            <Pressable onPress={() => sync()}>
              <Text variant="caption" muted>
                {syncing ? 'Backing up…' : lastError ? 'Not backed up yet · tap to retry' : `${pending} not backed up yet`}
              </Text>
            </Pressable>
          ) : null}
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
        data={rows}
        keyExtractor={(r) => (r.kind === 'outing' ? r.outing.key : r.s.id)}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        renderItem={({ item, index }) =>
          item.kind === 'outing' ? (
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs, gap: 2 }}>
              <Text variant="label" muted>
                {formatDay(item.outing.sightings[0].observed_at)}
                {item.outing.place ? ` · ${item.outing.place}` : ''}
              </Text>
              {item.outing.sightings.length > 1 ? (
                <Text variant="caption" faint>
                  {item.outing.speciesCount} species
                  {item.outing.lifers ? ` · ${item.outing.lifers} lifer${item.outing.lifers === 1 ? '' : 's'}` : ''}
                </Text>
              ) : null}
            </View>
          ) : (
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
              <SightingCard index={index} sighting={item.s} compact pending={!!item.s.dirty} />
            </View>
          )
        }
        ListEmptyComponent={
          <Empty
            icon="book-outline"
            title={year || place ? 'Nothing matches' : 'Your diary starts here'}
            body={year || place ? 'Try a different filter.' : 'Every bird you log lands on this page, grouped by outing.'}
            action={year || place ? undefined : <Button title="Log your first bird" icon="add" onPress={() => router.push('/(tabs)/log')} />}
          />
        }
      />
    </View>
  );
}
