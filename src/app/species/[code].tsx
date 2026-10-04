import { Image } from 'expo-image';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import React, { useMemo } from 'react';
import { FlatList, Pressable, View } from 'react-native';

import { Rise } from '@/components/motion';
import { SightingCard } from '@/components/SightingCard';
import { SightingsMap } from '@/components/SightingsMap';
import { Stat } from '@/components/Stat';
import { useBottomPadding } from '@/components/TabBarInset';
import { Empty, Row, Text } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useLocalQuery, useLocalSightings } from '@/hooks/useLocalSightings';
import { useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { compactNumber, formatDate } from '@/lib/format';
import { fetchGlobalCount } from '@/lib/inat';
import { MONTHS_SHORT, monthHistogram } from '@/lib/insights';
import { speciesByCode } from '@/lib/taxonomy';
import { fonts, radius, spacing, useTheme } from '@/lib/theme';
import { fetchSpeciesSummary } from '@/lib/wiki';

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
  const months = useMemo(() => monthHistogram(sightings), [sightings]);
  const { data: about } = useAsync(() => fetchSpeciesSummary(sp?.sci ?? '', { get: db.getMeta, set: db.setMeta }), [sp?.sci]);
  const { data: worldCount } = useAsync(() => fetchGlobalCount(sp?.sci ?? '', { get: db.getMeta, set: db.setMeta }), [sp?.sci]);
  // Other species of the same family on the life list, in taxonomic order.
  const related = useMemo(() => {
    if (!sp) return [];
    return life
      .map((e) => speciesByCode(e.species_code))
      .filter((s): s is NonNullable<typeof s> => !!s && s.code !== sp.code && s.familySci === sp.familySci)
      .sort((a, b) => a.order - b.order);
  }, [life, sp]);
  const maxMonth = Math.max(1, ...months);

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
                <Text variant="display" style={{ fontSize: 38, lineHeight: 42 }}>
                  {sp?.common ?? code}
                </Text>
                <Text style={{ fontFamily: fonts.displayItalic, fontSize: 18, color: colors.textMuted }}>{sp?.sci}</Text>
                <Text variant="caption" muted>
                  {sp ? `${sp.family} · ${sp.familySci}` : ''}
                </Text>
                {first ? (
                  <Text variant="caption" muted>
                    No. {rank} on your life list
                  </Text>
                ) : null}
              </View>
            </Rise>
            {about ? (
              <Rise index={1}>
                <View style={{ gap: spacing.sm }}>
                  {about.thumbnail ? <Image source={{ uri: about.thumbnail }} style={{ width: '100%', height: 220, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt }} contentFit="cover" transition={150} /> : null}
                  <Text style={{ fontSize: 16, lineHeight: 24 }} numberOfLines={8}>
                    {about.extract}
                  </Text>
                  <Pressable onPress={() => WebBrowser.openBrowserAsync(about.url)} hitSlop={8} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                    <Text variant="caption" muted>
                      From Wikipedia · read more
                    </Text>
                  </Pressable>
                  {worldCount != null ? (
                    <Text variant="caption" muted>
                      {compactNumber(worldCount)} observations worldwide on iNaturalist
                    </Text>
                  ) : null}
                </View>
              </Rise>
            ) : null}
            {first ? (
              <Rise index={1}>
                <Row style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, justifyContent: 'space-around' }}>
                  <Stat value={sightings.length} label={sightings.length === 1 ? 'sighting' : 'sightings'} />
                  <Stat value={places} label={places === 1 ? 'place' : 'places'} />
                  <Stat value={formatDate(first.observed_at, false)} label={`first, ${new Date(first.observed_at).getFullYear()}`} />
                </Row>
              </Rise>
            ) : null}
            {sightings.length > 1 ? (
              <Rise index={2}>
                <View style={{ gap: spacing.sm }}>
                  <Text variant="label" muted>
                    When you see it
                  </Text>
                  <Row gap={4} style={{ alignItems: 'flex-end', height: 52 }}>
                    {months.map((c, i) => (
                      <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                        <View style={{ width: '100%', height: Math.max(3, (c / maxMonth) * 36), borderRadius: 3, backgroundColor: c ? colors.accent : colors.border, opacity: c ? 0.35 + 0.65 * (c / maxMonth) : 1 }} />
                        <Text variant="caption" faint style={{ fontSize: 10 }}>
                          {MONTHS_SHORT[i]}
                        </Text>
                      </View>
                    ))}
                  </Row>
                </View>
              </Rise>
            ) : null}
            {withPins.length ? (
              <Rise index={3}>
                <View style={{ height: 200, borderRadius: radius.lg, overflow: 'hidden' }}>
                  <SightingsMap sightings={withPins} onPress={(id) => router.push({ pathname: '/sighting/[id]', params: { id } })} />
                </View>
              </Rise>
            ) : null}
            {related.length ? (
              <View style={{ gap: spacing.xs }}>
                <Text variant="label" muted>
                  Also on your list in this family
                </Text>
                {related.map((r) => (
                  <Link key={r.code} href={{ pathname: '/species/[code]', params: { code: r.code } }} asChild>
                    <Pressable style={({ pressed }) => ({ paddingVertical: 6, opacity: pressed ? 0.7 : 1 })}>
                      <Text variant="species">{r.common}</Text>
                      <Text variant="caption" muted style={{ fontFamily: fonts.displayItalic }}>
                        {r.sci}
                      </Text>
                    </Pressable>
                  </Link>
                ))}
              </View>
            ) : null}
            {sightings.length ? (
              <Text variant="label" muted>
                Every sighting
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
