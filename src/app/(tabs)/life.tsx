import { Link } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { CountUp } from '@/components/CountUp';
import { Filters } from '@/components/Filters';
import { Rise } from '@/components/motion';
import { Photo } from '@/components/Photo';
import { Empty, Text } from '@/components/ui';
import { useLocalQuery } from '@/hooks/useLocalSightings';
import { usePrefetchPhotoUrls } from '@/lib/photos';
import { useBottomPadding } from '@/components/TabBarInset';
import { useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { formatDate, relativeTime } from '@/lib/format';
import { speciesByCode } from '@/lib/taxonomy';
import { fonts, radius, spacing, useTheme } from '@/lib/theme';

export default function LifeListScreen() {
  const userId = useUserId();
  const bottomPad = useBottomPadding(spacing.xxl);
  const { colors } = useTheme();
  const [year, setYear] = useState<number | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const years = useLocalQuery(() => db.years(userId), [userId]);
  const places = useLocalQuery(() => db.places(userId), [userId]);
  const entries = useLocalQuery(() => db.lifeList(userId, { year, place }), [userId, year, place]);
  const unfiltered = !year && !place;
  const thisYear = String(new Date().getFullYear());
  const lifersThisYear = unfiltered ? entries.filter((e) => db.localDay(e.first_seen).startsWith(thisYear)).length : 0;
  const latest = unfiltered ? entries[0] : undefined;
  usePrefetchPhotoUrls(entries.map((e) => e.photo));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.species_code}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <View style={{ backgroundColor: colors.bg }}>
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
                <CountUp value={entries.length} style={{ fontSize: 64, lineHeight: 68, letterSpacing: -2 }} />
                <Text style={{ fontFamily: fonts.displayItalic, fontSize: 22, color: colors.textMuted, paddingBottom: 10 }}>species</Text>
              </View>
              <Text muted>
                {year ? `Seen in ${year}` : 'All time'}
                {place ? ` · ${place}` : ''}
                {unfiltered && entries.length ? ` · ${lifersThisYear} new in ${thisYear}` : ''}
              </Text>
              {latest ? (
                <Text variant="caption" faint>
                  Latest lifer: {speciesByCode(latest.species_code)?.common} · {relativeTime(latest.first_seen)}
                </Text>
              ) : null}
            </View>
            <Filters years={years} places={places} year={year} place={place} onYear={setYear} onPlace={setPlace} />
          </View>
        }
        renderItem={({ item, index }) => {
          const sp = speciesByCode(item.species_code);
          return (
            <Rise index={index}>
            <Link href={{ pathname: '/species/[code]', params: { code: item.species_code } }} asChild>
              <Pressable style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 10, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}>
                <Text variant="caption" faint style={{ width: 28, textAlign: 'right' }}>
                  {entries.length - index}
                </Text>
                <Photo
                  path={item.photo}
                  style={{ width: 52, height: 52, borderRadius: radius.md }}
                  fallback={
                    <View style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: colors.accent, fontWeight: '700' }}>{sp?.common.charAt(0)}</Text>
                    </View>
                  }
                />
                <View style={{ flex: 1 }}>
                  <Text variant="species" numberOfLines={1}>
                    {sp?.common ?? item.species_code}
                  </Text>
                  <Text variant="caption" muted numberOfLines={1}>
                    First {formatDate(item.first_seen)} · {item.sighting_count}×
                  </Text>
                </View>
              </Pressable>
            </Link>
            </Rise>
          );
        }}
        ListEmptyComponent={<Empty icon="list-outline" title={year || place ? 'Nothing matches' : 'Your life list is empty'} body={year || place ? 'Try a different year or place.' : 'Every species you log shows up here with the date you first saw it.'} />}
      />
    </View>
  );
}
