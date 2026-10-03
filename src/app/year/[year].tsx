import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, Pressable, ScrollView, Share, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountUp } from '@/components/CountUp';
import { Photo } from '@/components/Photo';
import { Button, IconButton, Text } from '@/components/ui';
import { useLocalSightings } from '@/hooks/useLocalSightings';
import { useAuth, useUserId } from '@/lib/auth';
import { backOr } from '@/lib/nav';
import { formatDate } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { MONTHS_LONG, MONTHS_SHORT, monthHistogram, yearRecap } from '@/lib/insights';
import { speciesByCode } from '@/lib/taxonomy';
import { fonts, radius, spacing, useTheme } from '@/lib/theme';

/**
 * Year in Birds: a swipeable, full-screen recap of one year. Every page is built from the local
 * store, so it works offline and never leaves the device unless the user shares the summary.
 */
export default function YearScreen() {
  const { year: yearParam } = useLocalSearchParams<{ year: string }>();
  const year = Number(yearParam) || new Date().getFullYear();
  const userId = useUserId();
  const { profile } = useAuth();
  const { colors, dark } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const all = useLocalSightings(userId);
  const recap = useMemo(() => yearRecap(all, year), [all, year]);
  const months = useMemo(() => monthHistogram(all.filter((s) => new Date(s.observed_at).getFullYear() === year)), [all, year]);
  const [page, setPage] = useState(0);
  const lastPage = useRef(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== lastPage.current) {
      lastPage.current = p;
      haptic.select();
      setPage(p);
    }
  };

  const share = () => {
    const lifers = recap.lifers.length;
    const lines = [
      `My ${year} in birds, on Perch:`,
      `${recap.sightings} sightings · ${recap.species} species · ${lifers} lifer${lifers === 1 ? '' : 's'}`,
      recap.daysOut ? `${recap.daysOut} days out birding` : null,
      recap.busiestMonth ? `Busiest month: ${MONTHS_LONG[recap.busiestMonth.month]}` : null,
      recap.topPlace ? `Favourite spot: ${recap.topPlace.place}` : null,
      recap.mostSeen ? `Most seen: ${speciesByCode(recap.mostSeen.code)?.common ?? recap.mostSeen.code}` : null,
    ].filter(Boolean);
    Share.share({ message: lines.join('\n') }).catch(() => {});
  };

  const g = dark ? (['#2A1D12', '#15130F'] as const) : (['#F6E3D0', '#F7F1E8'] as const);
  const pages: React.ReactNode[] = [];

  // 1. Cover
  pages.push(
    <Page key="cover" width={width}>
      <Animated.View entering={FadeInDown.springify()} style={{ gap: spacing.sm }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 3, color: colors.accent }}>YEAR IN BIRDS</Text>
        <Text variant="display" style={{ fontSize: 96, lineHeight: 100, letterSpacing: -4 }}>
          {year}
        </Text>
        <Text style={{ fontFamily: fonts.displayItalic, fontSize: 22, color: colors.textMuted }}>{profile?.display_name || profile?.username || 'Your'} year, bird by bird.</Text>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(600)} style={{ position: 'absolute', bottom: spacing.xxl + insets.bottom, alignSelf: 'center', alignItems: 'center', gap: 4 }}>
        <Text variant="caption" muted>
          Swipe
        </Text>
        <Ionicons name="arrow-forward" size={18} color={colors.textMuted} />
      </Animated.View>
    </Page>,
  );

  if (recap.sightings === 0) {
    pages.push(
      <Page key="empty" width={width}>
        <Text variant="display" style={{ fontSize: 34, lineHeight: 40 }}>
          Nothing logged in {year} yet.
        </Text>
        <Text muted style={{ fontSize: 17, lineHeight: 24 }}>
          Every sighting you log this year lands here. Come back in December.
        </Text>
      </Page>,
    );
  } else {
    // 2. Numbers
    pages.push(
      <Page key="numbers" width={width}>
        <View style={{ gap: spacing.xl }}>
          <Big value={recap.sightings} label={recap.sightings === 1 ? 'sighting' : 'sightings'} delay={0} />
          <Big value={recap.species} label="species" delay={120} />
          <Big value={recap.daysOut} label={recap.daysOut === 1 ? 'day out birding' : 'days out birding'} delay={240} />
        </View>
      </Page>,
    );
    // 3. Lifers
    pages.push(
      <Page key="lifers" width={width}>
        <Animated.View entering={FadeInDown.springify()} style={{ gap: spacing.md }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 3, color: colors.accent }}>LIFERS</Text>
          <Text variant="display" style={{ fontSize: 72, lineHeight: 76, letterSpacing: -3 }}>
            {recap.lifers.length}
          </Text>
          <Text muted style={{ fontSize: 17, lineHeight: 24 }}>
            {recap.lifers.length === 0 ? 'No new species this year. The old friends still count.' : recap.lifers.length === 1 ? 'One bird you had never seen before.' : `${recap.lifers.length} birds you had never seen before.`}
          </Text>
          <View style={{ gap: 6, marginTop: spacing.sm }}>
            {recap.lifers.slice(0, 7).map((code, i) => (
              <Animated.View key={code} entering={FadeInUp.delay(200 + i * 70).springify()}>
                <Text style={{ fontFamily: fonts.display, fontSize: 22, lineHeight: 28 }}>{speciesByCode(code)?.common ?? code}</Text>
              </Animated.View>
            ))}
            {recap.lifers.length > 7 ? (
              <Text variant="caption" muted>
                and {recap.lifers.length - 7} more
              </Text>
            ) : null}
          </View>
        </Animated.View>
      </Page>,
    );
    // 4. Seasons
    pages.push(
      <Page key="months" width={width}>
        <Animated.View entering={FadeInDown.springify()} style={{ gap: spacing.md }}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 3, color: colors.accent }}>SEASONS</Text>
          <Text variant="display" style={{ fontSize: 40, lineHeight: 46 }}>
            {recap.busiestMonth ? `${MONTHS_LONG[recap.busiestMonth.month]} was your month.` : 'A quiet year.'}
          </Text>
          {recap.busiestMonth ? (
            <Text muted style={{ fontSize: 17, lineHeight: 24 }}>
              {recap.busiestMonth.count} sightings{recap.longestStreakWeeks > 1 ? `, and a streak of ${recap.longestStreakWeeks} weeks in a row with at least one bird.` : '.'}
            </Text>
          ) : null}
          <MonthBars counts={months} highlight={recap.busiestMonth?.month ?? -1} />
        </Animated.View>
      </Page>,
    );
    // 5. Place + most seen
    pages.push(
      <Page key="place" width={width}>
        <Animated.View entering={FadeInDown.springify()} style={{ gap: spacing.xl }}>
          {recap.topPlace ? (
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 3, color: colors.accent }}>YOUR PATCH</Text>
              <Text variant="display" style={{ fontSize: 40, lineHeight: 46 }}>
                {recap.topPlace.place}
              </Text>
              <Text muted style={{ fontSize: 17 }}>
                {recap.topPlace.count} sightings there.
              </Text>
            </View>
          ) : null}
          {recap.mostSeen ? (
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontFamily: fonts.semibold, fontSize: 13, letterSpacing: 3, color: colors.accent }}>OLD FRIEND</Text>
              <Text variant="display" style={{ fontSize: 34, lineHeight: 40 }}>
                {speciesByCode(recap.mostSeen.code)?.common ?? recap.mostSeen.code}
              </Text>
              <Text muted style={{ fontSize: 17 }}>
                Seen {recap.mostSeen.count} times. It kept showing up.
              </Text>
            </View>
          ) : null}
        </Animated.View>
      </Page>,
    );
    // 6. First and last
    pages.push(
      <Page key="firstlast" width={width}>
        <Animated.View entering={FadeInDown.springify()} style={{ gap: spacing.xl }}>
          {recap.firstBird ? <Bookend label="FIRST BIRD" code={recap.firstBird.species_code} when={recap.firstBird.observed_at} photo={recap.firstBird.photo_path} /> : null}
          {recap.lastBird && recap.lastBird.id !== recap.firstBird?.id ? <Bookend label="LAST BIRD" code={recap.lastBird.species_code} when={recap.lastBird.observed_at} photo={recap.lastBird.photo_path} /> : null}
        </Animated.View>
      </Page>,
    );
  }

  // Share
  pages.push(
    <Page key="share" width={width}>
      <Animated.View entering={FadeInDown.springify()} style={{ gap: spacing.lg }}>
        <Text variant="display" style={{ fontSize: 40, lineHeight: 46 }}>
          {recap.sightings ? 'That was your year.' : 'See you out there.'}
        </Text>
        <Text muted style={{ fontSize: 17, lineHeight: 24 }}>
          {recap.sightings ? 'Share the numbers, not your pins. Locations stay with you.' : 'Log a bird and this page starts filling in.'}
        </Text>
        {recap.sightings ? <Button title="Share my year" icon="share-outline" onPress={share} /> : null}
        <Button title="Done" kind="secondary" onPress={() => backOr('/(tabs)/me')} />
      </Animated.View>
    </Page>,
  );

  return (
    <LinearGradient colors={g} style={{ flex: 1 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32} style={{ flex: 1 }}>
        {pages}
      </ScrollView>
      <View style={{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <IconButton name="close" label="Close" onPress={() => backOr('/(tabs)/me')} />
        <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
          {pages.map((_, i) => (
            <View key={i} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: i <= page ? colors.accent : colors.border }} />
          ))}
        </View>
        <IconButton name="share-outline" label="Share" onPress={share} />
      </View>
    </LinearGradient>
  );
}

function Page({ width, children }: { width: number; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ width, flex: 1, paddingHorizontal: spacing.xl, paddingTop: insets.top + 72, paddingBottom: insets.bottom + spacing.xl, justifyContent: 'center' }}>
      {children}
    </View>
  );
}

function Big({ value, label, delay }: { value: number; label: string; delay: number }) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()}>
      <CountUp value={value} style={{ fontSize: 72, lineHeight: 76, letterSpacing: -3 }} />
      <Text muted style={{ fontSize: 17 }}>
        {label}
      </Text>
    </Animated.View>
  );
}

function MonthBars({ counts, highlight }: { counts: number[]; highlight: number }) {
  const { colors } = useTheme();
  const max = Math.max(1, ...counts);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 140, marginTop: spacing.md }}>
      {counts.map((c, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
          <Animated.View entering={FadeInUp.delay(100 + i * 40).springify()} style={{ width: '100%', height: Math.max(4, (c / max) * 110), borderRadius: 4, backgroundColor: i === highlight ? colors.accent : colors.surfaceAlt, borderWidth: 1, borderColor: i === highlight ? colors.accent : colors.border }} />
          <Text variant="caption" faint style={{ fontSize: 10 }}>
            {MONTHS_SHORT[i]}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Bookend({ label, code, when, photo }: { label: string; code: string; when: string; photo: string | null }) {
  const { colors } = useTheme();
  const sp = speciesByCode(code);
  return (
    <Pressable style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
      {photo ? <Photo path={photo} style={{ width: 84, height: 84, borderRadius: radius.lg, backgroundColor: colors.surfaceAlt }} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 3, color: colors.accent }}>{label}</Text>
        <Text variant="display" style={{ fontSize: 28, lineHeight: 32 }}>
          {sp?.common ?? code}
        </Text>
        <Text variant="caption" muted>
          {formatDate(when, false)}
        </Text>
      </View>
    </Pressable>
  );
}
