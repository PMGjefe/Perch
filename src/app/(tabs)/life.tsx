import { Image } from 'expo-image';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { Filters } from '@/components/Filters';
import { Empty, Text } from '@/components/ui';
import { useLocalQuery } from '@/hooks/useLocalSightings';
import { useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { formatDate } from '@/lib/format';
import { photoUrl } from '@/lib/supabase';
import { speciesByCode } from '@/lib/taxonomy';
import { radius, spacing, useTheme } from '@/lib/theme';

export default function LifeListScreen() {
  const userId = useUserId();
  const { colors } = useTheme();
  const [year, setYear] = useState<number | null>(null);
  const [place, setPlace] = useState<string | null>(null);
  const years = useLocalQuery(() => db.years(userId), [userId]);
  const places = useLocalQuery(() => db.places(userId), [userId]);
  const entries = useLocalQuery(() => db.lifeList(userId, { year, place }), [userId, year, place]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.species_code}
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        stickyHeaderIndices={[0]}
        ListHeaderComponent={
          <View style={{ backgroundColor: colors.bg }}>
            <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
              <Text variant="title">
                {entries.length} species
              </Text>
              <Text muted>
                {year ? `Seen in ${year}` : 'All time'}
                {place ? ` · ${place}` : ''}
              </Text>
            </View>
            <Filters years={years} places={places} year={year} place={place} onYear={setYear} onPlace={setPlace} />
          </View>
        }
        renderItem={({ item, index }) => {
          const sp = speciesByCode(item.species_code);
          const uri = item.photo ? (item.photo.startsWith('file:') ? item.photo : photoUrl(item.photo)) : null;
          return (
            <Link href={{ pathname: '/species/[code]', params: { code: item.species_code } }} asChild>
              <Pressable style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 10, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}>
                <Text variant="caption" faint style={{ width: 28, textAlign: 'right' }}>
                  {entries.length - index}
                </Text>
                {uri ? (
                  <Image source={{ uri }} style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceAlt }} contentFit="cover" />
                ) : (
                  <View style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: colors.accent, fontWeight: '700' }}>{sp?.common.charAt(0)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text variant="subheading" numberOfLines={1}>
                    {sp?.common ?? item.species_code}
                  </Text>
                  <Text variant="caption" muted numberOfLines={1}>
                    First {formatDate(item.first_seen)} · {item.sighting_count}×
                  </Text>
                </View>
              </Pressable>
            </Link>
          );
        }}
        ListEmptyComponent={<Empty icon="list-outline" title={year || place ? 'Nothing matches' : 'Your life list is empty'} body={year || place ? 'Try a different year or place.' : 'Every species you log shows up here with the date you first saw it.'} />}
      />
    </View>
  );
}
