import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import Animated, { interpolate, useAnimatedRef, useAnimatedStyle, useScrollOffset } from 'react-native-reanimated';
import { Alert, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { Comments } from '@/components/Comments';
import { ErrorState } from '@/components/ErrorState';
import { reportContent } from '@/components/ReportSheet';
import { Photo } from '@/components/Photo';
import { Avatar, BottomInset, Button, Empty, IconButton, Loading, Row, Screen, Text } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useLocalSighting } from '@/hooks/useLocalSightings';
import { useUserId } from '@/lib/auth';
import { DARK_MAP } from '@/lib/mapStyle';
import { backOr } from '@/lib/nav';
import { shareSighting } from '@/lib/share';
import { haptic } from '@/lib/haptics';
import * as db from '@/lib/db';
import { formatDateTime } from '@/lib/format';
import { fetchEngagement, fetchProfile, fetchPublicSighting, setLike } from '@/lib/social';
import { speciesByCode } from '@/lib/taxonomy';
import { fonts, radius, spacing, useTheme } from '@/lib/theme';
import type { Engagement, PublicSighting } from '@/types/db';

// What to call this thing in copy: "saved on this iPhone" reads better than "on this device".
const device = Platform.OS === 'ios' ? (Platform.isPad ? 'iPad' : 'iPhone') : 'phone';

export default function SightingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const router = useRouter();
  const { colors, dark } = useTheme();
  const local = useLocalSighting(id, userId);
  const isOwner = !!local;
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const offset = useScrollOffset(scrollRef);
  const HERO = 320;
  const hero = useAnimatedStyle(() => {
    const y = offset.get();
    return { transform: [{ translateY: interpolate(y, [-HERO, 0, HERO], [-HERO / 2, 0, HERO * 0.35], 'clamp') }, { scale: interpolate(y, [-HERO, 0], [1.8, 1], 'clamp') }] };
  });

  // Own sightings come from SQLite (offline); others come from the privacy-aware view.
  const remote = useAsync(async () => (local ? null : fetchPublicSighting(id)), [id, !!local]);
  const sighting: (PublicSighting & { local_photo_uri?: string | null }) | null = local
    ? { ...local, location_fuzzed: false, location_hidden: false }
    : remote.data ?? null;

  const profile = useAsync(async () => (sighting ? fetchProfile(sighting.user_id) : null), [sighting?.user_id]);
  const [eng, setEng] = useState<Engagement | null>(null);
  useEffect(() => {
    fetchEngagement('sighting', [id])
      .then((m) => setEng(m.get(id) ?? { target_id: id, like_count: 0, comment_count: 0, liked_by_me: false }))
      .catch(() => {});
  }, [id]);

  const toggleLike = async () => {
    if (!eng) return;
    haptic.select();
    const next = { ...eng, liked_by_me: !eng.liked_by_me, like_count: eng.like_count + (eng.liked_by_me ? -1 : 1) };
    setEng(next);
    try {
      await setLike(userId, 'sighting', id, next.liked_by_me);
    } catch {
      setEng(eng);
    }
  };

  const remove = () =>
    Alert.alert('Delete this sighting?', 'It will be removed from your diary, life list and any lists.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          backOr('/(tabs)/diary');
          setTimeout(() => db.deleteSighting(id), 350);
        },
      },
    ]);

  if (!sighting) {
    if (remote.loading) return <Loading />;
    if (remote.error) {
      return (
        <Screen>
          <Stack.Screen options={{ title: '' }} />
          <ErrorState error={remote.error} onRetry={remote.reload} />
        </Screen>
      );
    }
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        <Empty icon="eye-off-outline" title="Not available" body="This sighting is private or was deleted." />
      </Screen>
    );
  }

  const sp = speciesByCode(sighting.species_code);
  const hasPin = sighting.lat != null && sighting.lng != null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: sp?.common ?? '',
          headerRight: () => (
            <Row gap={0}>
              <IconButton name="share-outline" label="Share" onPress={() => shareSighting(sighting)} />
              {isOwner ? (
                <>
                  <IconButton name="create-outline" label="Edit sighting" onPress={() => router.push({ pathname: '/sighting/edit/[id]', params: { id } })} />
                  <IconButton name="trash-outline" label="Delete sighting" color={colors.danger} onPress={remove} />
                </>
              ) : (
                <IconButton name="flag-outline" label="Report" onPress={() => reportContent(userId, 'sighting', id)} />
              )}
            </Row>
          ),
        }}
      />
      <Animated.ScrollView ref={scrollRef} style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xl }} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
        {sighting.photo_path || sighting.local_photo_uri ? (
          <View style={{ height: HERO, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
            <Animated.View style={[{ height: HERO }, hero]}>
              <Photo path={sighting.photo_path} localUri={sighting.local_photo_uri} style={{ width: '100%', height: HERO }} />
            </Animated.View>
          </View>
        ) : null}
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
          <View style={{ gap: spacing.xs }}>
            <Link href={{ pathname: '/species/[code]', params: { code: sighting.species_code } }} asChild>
              <Pressable>
                <Text variant="title">{sp?.common ?? sighting.species_code}</Text>
                <Text style={{ fontFamily: fonts.displayItalic, fontSize: 17, color: colors.textMuted }}>{sp?.sci}</Text>
              </Pressable>
            </Link>
          </View>

          {profile.data ? (
            <Link href={{ pathname: '/user/[id]', params: { id: profile.data.id } }} asChild>
              <Pressable>
                <Row>
                  <Avatar uri={profile.data.avatar_url} name={profile.data.display_name || profile.data.username} size={34} />
                  <View>
                    <Text variant="label">{profile.data.display_name || profile.data.username}</Text>
                    <Text variant="caption" muted>
                      @{profile.data.username}
                    </Text>
                  </View>
                </Row>
              </Pressable>
            </Link>
          ) : null}

          <View style={{ gap: spacing.sm }}>
            <Row>
              <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
              <Text>{formatDateTime(sighting.observed_at)}</Text>
            </Row>
            <Row>
              <Ionicons name={sighting.location_hidden ? 'eye-off-outline' : 'location-outline'} size={18} color={colors.textMuted} />
              <Text muted={!sighting.place_name}>
                {sighting.location_hidden ? 'Location hidden by the observer' : sighting.location_fuzzed ? 'Near their home (approximate)' : sighting.place_name ?? 'No place recorded'}
              </Text>
            </Row>
            {isOwner ? (
              <Row>
                <Ionicons name={sighting.visibility === 'public' ? 'earth-outline' : sighting.visibility === 'followers' ? 'people-outline' : 'lock-closed-outline'} size={18} color={colors.textMuted} />
                <Text muted>
                  {sighting.visibility === 'public' ? 'Public' : sighting.visibility === 'followers' ? 'Followers only' : 'Only you'}
                  {sighting.sensitive ? ' · sensitive location' : ''}
                  {local?.dirty ? ` · saved on this ${device}, backing up soon` : ''}
                </Text>
              </Row>
            ) : null}
          </View>

          {sighting.note ? <Text style={{ fontSize: 17, lineHeight: 24 }}>{sighting.note}</Text> : null}

          {hasPin ? (
            <MapView
              style={{ height: 180, borderRadius: radius.lg }}
              initialRegion={{ latitude: sighting.lat!, longitude: sighting.lng!, latitudeDelta: sighting.location_fuzzed ? 0.06 : 0.02, longitudeDelta: sighting.location_fuzzed ? 0.06 : 0.02 }}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              pointerEvents="none"
              userInterfaceStyle={dark ? 'dark' : 'light'}
              customMapStyle={dark ? DARK_MAP : undefined}
            >
              {sighting.location_fuzzed ? (
                <Circle center={{ latitude: sighting.lat!, longitude: sighting.lng! }} radius={1000} fillColor={colors.accent + '33'} strokeColor={colors.accent} />
              ) : (
                <Marker coordinate={{ latitude: sighting.lat!, longitude: sighting.lng! }} pinColor={colors.accent} />
              )}
            </MapView>
          ) : null}

          <Row gap={spacing.lg}>
            <Button title={`${eng?.like_count ?? 0}`} kind={eng?.liked_by_me ? 'primary' : 'secondary'} icon={eng?.liked_by_me ? 'heart' : 'heart-outline'} onPress={toggleLike} disabled={!eng} style={{ paddingVertical: 9 }} />
            <Row gap={4}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
              <Text muted>{eng?.comment_count ?? 0}</Text>
            </Row>
          </Row>

          <Comments type="sighting" id={id} onCountChange={(d) => setEng((e) => (e ? { ...e, comment_count: e.comment_count + d } : e))} />
          <BottomInset />
        </View>
      </Animated.ScrollView>
    </KeyboardAvoidingView>
  );
}
