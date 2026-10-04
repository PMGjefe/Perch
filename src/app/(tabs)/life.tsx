import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, FlatList, Platform, Pressable, View } from 'react-native';

import { Photo } from '@/components/Photo';
import { Segmented } from '@/components/Segmented';
import { Button, Empty, IconButton, Row, Text } from '@/components/ui';
import { useLocalQuery } from '@/hooks/useLocalSightings';
import { usePrefetchPhotoUrls } from '@/lib/photos';
import { useBottomPadding } from '@/components/TabBarInset';
import { useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { formatDate, plural } from '@/lib/format';
import { speciesByCode } from '@/lib/taxonomy';
import { spacing, useTheme } from '@/lib/theme';

export default function LifeListScreen() {
  const userId = useUserId();
  const bottomPad = useBottomPadding(spacing.xxl);
  const { colors } = useTheme();
  const router = useRouter();
  const [year, setYear] = useState<number | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const [order, setOrder] = useState<'newest' | 'guide'>('newest');
  const years = useLocalQuery(() => db.years(userId), [userId]);
  const places = useLocalQuery(() => db.places(userId), [userId]);
  const entries = useLocalQuery(() => db.lifeList(userId, { year, place }), [userId, year, place]);
  const unfiltered = !year && !place;
  const thisYear = String(new Date().getFullYear());
  const lifersThisYear = unfiltered ? entries.filter((e) => db.localDay(e.first_seen).startsWith(thisYear)).length : 0;
  usePrefetchPhotoUrls(entries.map((e) => e.photo));
  // Life-list number = rank by first-seen date, in either order.
  const rank = useMemo(() => new Map(entries.map((e, i) => [e.species_code, entries.length - i])), [entries]);
  // Field-guide order: taxonomic sequence, with a heading whenever the family changes.
  const rows = useMemo(() => {
    if (order === 'newest') return entries.map((e) => ({ kind: 'entry' as const, e }));
    const sorted = [...entries].sort((a, b) => (speciesByCode(a.species_code)?.order ?? 0) - (speciesByCode(b.species_code)?.order ?? 0));
    const out: ({ kind: 'entry'; e: db.LifeListEntry } | { kind: 'family'; family: string; sci: string })[] = [];
    let last = '';
    for (const e of sorted) {
      const sp = speciesByCode(e.species_code);
      const fam = sp?.familySci ?? '';
      if (fam !== last) {
        out.push({ kind: 'family', family: sp?.family ?? 'Other', sci: fam });
        last = fam;
      }
      out.push({ kind: 'entry', e });
    }
    return out;
  }, [entries, order]);

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
    const items = ['By year', 'By place', ...(unfiltered ? [] : ['Clear filters'])];
    choose('Filter', items, (i) => {
      if (i === 0) choose('Year', years.map(String), (j) => setYear(years[j]));
      else if (i === 1) choose('Place', places.slice(0, 20), (j) => setPlace(places[j]));
      else {
        setYear(null);
        setPlace(null);
      }
    });
  };
  const open = (code: string) => router.push({ pathname: '/species/[code]', params: { code } });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => (r.kind === 'family' ? `family:${r.sci}` : r.e.species_code)}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        stickyHeaderIndices={[0]}
        initialNumToRender={10}
        windowSize={7}
        ListHeaderComponent={
          <View style={{ backgroundColor: colors.bg, paddingBottom: spacing.sm }}>
            <Row style={{ justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.xs, height: 44 }}>
              <Segmented options={[{ value: 'newest', label: 'Newest' }, { value: 'guide', label: 'By family' }]} value={order} onChange={setOrder} />
              <IconButton name={unfiltered ? 'funnel-outline' : 'funnel'} label="Filter" color={unfiltered ? colors.text : colors.accent} onPress={openFilter} />
            </Row>
            <Text variant="caption" muted style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.xs }}>
              {plural(entries.length, 'species', 'species')}
              {year ? ` · ${year}` : ''}
              {place ? ` · ${place}` : ''}
              {unfiltered && lifersThisYear ? ` · ${lifersThisYear} new this year` : ''}
            </Text>
          </View>
        }
        renderItem={({ item: row }) => {
          if (row.kind === 'family') {
            return (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 6 }}>
                <Text variant="caption" muted style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  {row.family}
                </Text>
              </View>
            );
          }
          const item = row.e;
          const sp = speciesByCode(item.species_code);
          return (
            <Pressable onPress={() => open(item.species_code)} accessibilityRole="button" style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 8 }}>
                <Text variant="caption" muted style={{ width: 30, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
                  {rank.get(item.species_code)}
                </Text>
                <Photo
                  path={item.photo}
                  style={{ width: 84, height: 63, borderRadius: 8 }}
                  fallback={
                    <View style={{ width: 84, height: 63, borderRadius: 8, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="leaf-outline" size={20} color={colors.textFaint} />
                    </View>
                  }
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="species" numberOfLines={1}>
                    {sp?.common ?? item.species_code}
                  </Text>
                  <Text variant="caption" muted numberOfLines={1}>
                    {formatDate(item.first_seen)}
                    {item.sighting_count > 1 ? ` · seen ${item.sighting_count} times` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </View>
              <View style={{ height: 0.5, backgroundColor: colors.border, marginLeft: spacing.lg + 30 + spacing.md + 84 + spacing.md }} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Empty
            icon="list-outline"
            title={year || place ? 'Nothing matches' : 'Your life list is empty'}
            body={year || place ? 'Try a different year or place.' : 'Every species you log shows up here with the date you first saw it.'}
            action={year || place ? undefined : <Button title="Log a bird" icon="add" onPress={() => router.push('/(tabs)/log')} />}
          />
        }
      />
    </View>
  );
}
