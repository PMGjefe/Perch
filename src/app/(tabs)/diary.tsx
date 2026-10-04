import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { AppState, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Filters } from '@/components/Filters';
import { SightingCard } from '@/components/SightingCard';
import { SightingsMap } from '@/components/SightingsMap';
import { SyncDot } from '@/components/SyncDot';
import { useBottomPadding } from '@/components/TabBarInset';
import { Button, Chip, Empty, Row, Text } from '@/components/ui';
import { useLocalQuery, useLocalSightings } from '@/hooks/useLocalSightings';
import { useAuth, useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { haversineM } from '@/lib/geo';
import { groupOutings, outingLine } from '@/lib/insights';
import { speciesByCode } from '@/lib/taxonomy';
import { usePrefetchPhotoUrls } from '@/lib/photos';
import { formatDay, formatLongDay, plural } from '@/lib/format';
import { radius, spacing, useTheme } from '@/lib/theme';

export default function DiaryScreen() {
  const userId = useUserId();
  const bottomPad = useBottomPadding(spacing.xxl);
  const { profile } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [mode, setMode] = useState<'list' | 'map'>('list');
  const [year, setYear] = useState<number | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [withPhoto, setWithPhoto] = useState(false);
  const filter = useMemo(() => ({ year, place, withPhoto }), [year, place, withPhoto]);
  const sightings = useLocalSightings(userId, filter);
  const years = useLocalQuery(() => db.years(userId), [userId]);
  const places = useLocalQuery(() => db.places(userId), [userId]);
  const life = useLocalQuery(() => db.lifeList(userId), [userId]);
  const firstSeen = useMemo(() => new Map(life.map((e) => [e.species_code, e.first_sighting_id])), [life]);
  // Outings: same day, same patch. Rows are flattened so one FlatList still virtualises everything.
  const outings = useMemo(() => groupOutings(sightings, firstSeen), [sightings, firstSeen]);
  const rows = useMemo(() => outings.flatMap((o) => [{ kind: 'outing' as const, outing: o }, ...o.sightings.map((s) => ({ kind: 'sighting' as const, s, key: s.id }))]), [outings]);
  usePrefetchPhotoUrls(sightings.filter((s) => !s.local_photo_uri).map((s) => s.photo_path));

  // Preview how others see pins near home.
  const home = profile?.hide_home && profile.home_lat != null && profile.home_lng != null ? { lat: profile.home_lat, lng: profile.home_lng } : null;
  const fuzzPreview = (s: { lat: number | null; lng: number | null }) => !!home && s.lat != null && s.lng != null && haversineM({ lat: s.lat, lng: s.lng }, home) <= 500;

  // Masthead: today's date, the count, and where you last were.
  const now = useMastheadClock();
  const filtered = year != null || place != null || withPhoto;
  const today = db.localDay(now.toISOString());
  const memories = useLocalQuery(() => db.onThisDay(userId, today.slice(5), today.slice(0, 4)), [userId, today]);
  const line = filtered ? null : outingLine(outings[0], now);

  const header = (
    <View style={{ backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 2 }}>
        {/* The date owns the full width: "Wednesday 30 September" is 383pt in Fraunces at 32pt, wider than any
            iPhone's content area, so the longest few days of the year shrink a touch instead of wrapping. The type
            multiplier is capped so a shrink is always enough and the date never truncates under large text. */}
        <Text variant="title" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={1.2}>
          {formatLongDay(now)}
        </Text>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text muted>{`${plural(sightings.length, 'sighting')}${year ? ` in ${year}` : ''}${place ? ` at ${place}` : ''}`}</Text>
            {line ? (
              <Text variant="caption" faint>
                {line}
              </Text>
            ) : null}
          </View>
          {/* Fixed at the SyncDot's height so the chips hold still when a backup starts. */}
          <Row style={{ height: 44 }}>
            <SyncDot />
            <Chip label="List" icon="list" active={mode === 'list'} onPress={() => setMode('list')} />
            <Chip label="Map" icon="map" active={mode === 'map'} onPress={() => setMode('map')} />
          </Row>
        </Row>
      </View>
      <Filters years={years} places={places} year={year} place={place} onYear={setYear} onPlace={setPlace} withPhoto={withPhoto} onWithPhoto={setWithPhoto} />
      {!filtered && memories.length ? (
        <View style={{ marginHorizontal: spacing.lg, marginTop: spacing.xs, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: spacing.xs }}>
          <Text variant="label" muted>
            On this day
          </Text>
          {memories.slice(0, 3).map((m) => (
            <Pressable key={m.id} onPress={() => router.push({ pathname: '/sighting/[id]', params: { id: m.id } })} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexDirection: 'row', gap: spacing.sm, alignItems: 'baseline' })}>
              <Text variant="caption" muted style={{ width: 36 }}>
                {db.localDay(m.observed_at).slice(0, 4)}
              </Text>
              <Text variant="species" numberOfLines={1} style={{ flex: 1 }}>
                {speciesByCode(m.species_code)?.common ?? m.species_code}
                {m.place_name ? <Text variant="caption" muted>{`  ${m.place_name}`}</Text> : null}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
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
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews
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

/**
 * "Now" for the masthead. A Diary left open across midnight, or from night into the dawn chorus, would
 * otherwise keep the old date and greeting until something else re-rendered. Refreshes when the app comes
 * back to the foreground and at the top of each hour, which is as often as the date or the greeting can change.
 */
function useMastheadClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const app = AppState.addEventListener('change', (s) => {
      if (s === 'active') setNow(new Date());
    });
    const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 1);
    const tick = setTimeout(() => setNow(new Date()), Math.max(1000, nextHour.getTime() - Date.now()));
    return () => {
      app.remove();
      clearTimeout(tick);
    };
  }, [now]);
  return now;
}
