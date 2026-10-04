import { Link, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { CountUp } from '@/components/CountUp';
import { Filters } from '@/components/Filters';
import { Rise } from '@/components/motion';
import { Photo } from '@/components/Photo';
import { Button, Chip, Empty, Row, Text } from '@/components/ui';
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
  const latest = unfiltered ? entries[0] : undefined;
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={rows}
        keyExtractor={(r) => (r.kind === 'family' ? `family:${r.sci}` : r.e.species_code)}
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
            <Row style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
              <Chip label="Newest first" active={order === 'newest'} onPress={() => setOrder('newest')} />
              <Chip label="Field guide order" active={order === 'guide'} onPress={() => setOrder('guide')} />
            </Row>
          </View>
        }
        renderItem={({ item: row, index }) => {
          if (row.kind === 'family') {
            return (
              <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xs }}>
                <Text variant="label" muted>
                  {row.family}
                </Text>
                <Text variant="caption" faint style={{ fontFamily: fonts.displayItalic }}>
                  {row.sci}
                </Text>
              </View>
            );
          }
          const item = row.e;
          const sp = speciesByCode(item.species_code);
          return (
            <Rise index={index}>
            <Link href={{ pathname: '/species/[code]', params: { code: item.species_code } }} asChild>
              <Pressable style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 10, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}>
                <Text variant="caption" faint style={{ width: 28, textAlign: 'right' }}>
                  {rank.get(item.species_code)}
                </Text>
                <Photo
                  path={item.photo}
                  style={{ width: 52, height: 52, borderRadius: radius.md }}
                  fallback={
                    <View style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: colors.accent, fontFamily: fonts.displaySemi }}>{sp?.common.charAt(0)}</Text>
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
