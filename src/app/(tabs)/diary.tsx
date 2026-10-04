import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, AppState, FlatList, Platform, StyleSheet, View } from 'react-native';

import { Segmented } from '@/components/Segmented';
import { SightingRow } from '@/components/SightingRow';
import { SightingsMap } from '@/components/SightingsMap';
import { SyncDot } from '@/components/SyncDot';
import { useBottomPadding } from '@/components/TabBarInset';
import { Button, Empty, IconButton, Row, Text } from '@/components/ui';
import { useLocalQuery, useLocalSightings } from '@/hooks/useLocalSightings';
import { useAuth, useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { haversineM } from '@/lib/geo';
import { groupOutings, outingLine } from '@/lib/insights';
import { usePrefetchPhotoUrls } from '@/lib/photos';
import { formatDay, plural } from '@/lib/format';
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

  // Native-style filter menu: one button, an action sheet, no row of pills.
  const choose = (title: string, options: string[], onPick: (i: number) => void) => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions({ title, options: [...options, 'Cancel'], cancelButtonIndex: options.length }, (i) => {
        if (i < options.length) onPick(i);
      });
    } else {
      Alert.alert(title, undefined, [...options.map((o, i) => ({ text: o, onPress: () => onPick(i) })), { text: 'Cancel', style: 'cancel' as const }]);
    }
  };
  const openFilter = () => {
    const items = [withPhoto ? 'Show all sightings' : 'Only with photos', 'By year', 'By place', ...(filtered ? ['Clear filters'] : [])];
    choose('Filter', items, (i) => {
      if (i === 0) setWithPhoto(!withPhoto);
      else if (i === 1) choose('Year', years.map(String), (j) => setYear(years[j]));
      else if (i === 2) choose('Place', places.slice(0, 20), (j) => setPlace(places[j]));
      else {
        setYear(null);
        setPlace(null);
        setWithPhoto(false);
      }
    });
  };
  const summary = filtered
    ? [withPhoto ? 'with photos' : null, year ? String(year) : null, place].filter(Boolean).join(' · ')
    : null;

  const header = (
    <View style={{ backgroundColor: colors.bg, paddingBottom: spacing.sm }}>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xs, height: 44 }}>
        <Segmented options={[{ value: 'list', label: 'List' }, { value: 'map', label: 'Map' }]} value={mode} onChange={setMode} />
        <Row gap={spacing.xs}>
          <SyncDot />
          <IconButton name={filtered ? 'funnel' : 'funnel-outline'} label="Filter" color={filtered ? colors.accent : colors.text} onPress={openFilter} />
        </Row>
      </Row>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs }}>
        <Text variant="caption" muted>
          {plural(sightings.length, 'sighting')}
          {summary ? ` · ${summary}` : ''}
        </Text>
        {line ? (
          <Text variant="caption" faint>
            {line}
          </Text>
        ) : null}
      </View>
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

  const open = (id: string) => router.push({ pathname: '/sighting/[id]', params: { id } });
  const group = (children: React.ReactNode) => (
    <View style={{ marginHorizontal: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }}>{children}</View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={outings}
        keyExtractor={(o) => o.key}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={7}
        removeClippedSubviews
        ListHeaderComponent={
          <View>
            {header}
            {!filtered && memories.length ? (
              <View style={{ paddingTop: spacing.md }}>
                <Text variant="caption" muted style={{ paddingHorizontal: spacing.lg + 4, paddingBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  On this day
                </Text>
                {group(
                  memories.slice(0, 3).map((m, i, arr) => (
                    <SightingRow key={m.id} sighting={m} last={i === arr.length - 1} onPress={() => open(m.id)} />
                  )),
                )}
              </View>
            ) : null}
          </View>
        }
        contentContainerStyle={{ paddingBottom: bottomPad }}
        renderItem={({ item: o }) => (
          <View style={{ paddingTop: spacing.lg }}>
            <Row style={{ justifyContent: 'space-between', paddingHorizontal: spacing.lg + 4, paddingBottom: 6 }}>
              <Text variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 }} numberOfLines={1}>
                {formatDay(o.sightings[0].observed_at)}
                {o.place ? ` · ${o.place}` : ''}
              </Text>
              {o.sightings.length > 1 ? (
                <Text variant="caption" faint>
                  {o.speciesCount} species
                  {o.lifers ? ` · ${o.lifers} lifer${o.lifers === 1 ? '' : 's'}` : ''}
                </Text>
              ) : null}
            </Row>
            {group(
              o.sightings.map((s, i) => (
                <SightingRow key={s.id} sighting={s} lifer={firstSeen.get(s.species_code) === s.id} last={i === o.sightings.length - 1} onPress={() => open(s.id)} />
              )),
            )}
          </View>
        )}
        ListEmptyComponent={
          <Empty
            icon="book-outline"
            title={filtered ? 'Nothing matches' : 'Your diary starts here'}
            body={filtered ? 'Try a different filter.' : 'Every bird you log lands on this page, grouped by outing.'}
            action={filtered ? undefined : <Button title="Log your first bird" icon="add" onPress={() => router.push('/(tabs)/log')} />}
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
