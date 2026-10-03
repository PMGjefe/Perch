import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, View } from 'react-native';

import { ListCard } from '@/components/ListCard';
import { ProfileHeader } from '@/components/ProfileHeader';
import { SightingCard } from '@/components/SightingCard';
import { SightingsMap } from '@/components/SightingsMap';
import { ErrorState } from '@/components/ErrorState';
import { reportContent } from '@/components/ReportSheet';
import { Button, Chip, Empty, IconButton, Loading, Row, Text } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useLocalQuery } from '@/hooks/useLocalSightings';
import { useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { friendlyError } from '@/lib/errors';
import { signPhotoUrls } from '@/lib/photos';
import { formatDate } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { blockUser, fetchLists, fetchProfile, fetchProfileStats, fetchUserLifeList, fetchUserSightings, isBlocked, setFollow, unblockUser } from '@/lib/social';
import { speciesByCode } from '@/lib/taxonomy';
import { spacing, useTheme } from '@/lib/theme';

type Tab = 'sightings' | 'life' | 'lists' | 'map';

function Overlap({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Text variant="heading" style={accent ? { color: colors.accent } : undefined}>
        {value}
      </Text>
      <Text variant="caption" muted>
        {label}
      </Text>
    </View>
  );
}

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useUserId();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('sightings');
  const [followOverride, setFollowOverride] = useState<boolean | null>(null);

  const { data, error, loading, reload, setData } = useAsync(async () => {
    const [profile, stats, sightings, life, lists, blocked] = await Promise.all([fetchProfile(id), fetchProfileStats(id), fetchUserSightings(id), fetchUserLifeList(id), fetchLists(id), id === me ? false : isBlocked(me, id)]);
    await signPhotoUrls(sightings.map((s) => s.photo_path));
    return { profile, stats, sightings, life, lists, blocked };
  }, [id]);
  const following = followOverride ?? data?.stats.is_followed_by_me ?? null;
  const myLife = useLocalQuery(() => (id === me ? [] : db.lifeList(me)), [me, id]);
  const myCodes = useMemo(() => new Set(myLife.map((e) => e.species_code)), [myLife]);
  // Overlap between their visible life list and mine; "only them" is what I could still find.
  const overlap = useMemo(() => {
    if (!data || id === me) return null;
    const mine = new Set(myLife.map((e) => e.species_code));
    const shared = data.life.filter((e) => mine.has(e.species_code)).length;
    return { shared, onlyThem: data.life.length - shared, onlyMe: mine.size - shared };
  }, [data, id, me, myLife]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const toggleFollow = async () => {
    if (following == null || !data) return;
    // Tapping "Requested" cancels the pending request; otherwise toggle the follow.
    const wantFollow = !following && !data.stats.follow_requested;
    setFollowOverride(wantFollow);
    try {
      await setFollow(me, id, wantFollow);
      // Fresh stats tell us whether the follow landed as accepted or pending; then drop the override.
      const stats = await fetchProfileStats(id);
      setData({ ...data, stats });
      setFollowOverride(null);
    } catch {
      setFollowOverride(following);
    }
  };

  const moreActions = () =>
    Alert.alert(data?.profile?.display_name || data?.profile?.username || 'Options', undefined, [
      { text: 'Report profile', onPress: () => reportContent(me, 'profile', id) },
      {
        text: data?.blocked ? 'Unblock' : 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            if (data?.blocked) await unblockUser(me, id);
            else await blockUser(me, id);
            reload();
          } catch (e) {
            haptic.warning();
            Alert.alert('Could not update', friendlyError(e, 'Could not update that right now.'));
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);

  if (loading && !data) return <Loading />;
  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: '' }} />
        <ErrorState error={error} onRetry={reload} />
      </View>
    );
  }
  if (!data?.profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: '' }} />
        <Empty title="No such birder" />
      </View>
    );
  }

  const header = (
    <View style={{ gap: spacing.lg, paddingBottom: spacing.md }}>
      <ProfileHeader
        profile={data.profile}
        stats={data.stats}
        right={
          id !== me ? (
            <Row gap={0}>
              {data.blocked ? (
                <Button title="Blocked" kind="secondary" onPress={moreActions} style={{ paddingVertical: 8, paddingHorizontal: spacing.lg }} />
              ) : data.stats.follow_requested && !following ? (
                <Button title="Requested" kind="secondary" onPress={toggleFollow} style={{ paddingVertical: 8, paddingHorizontal: spacing.lg }} />
              ) : following != null ? (
                <Button title={following ? 'Following' : 'Follow'} kind={following ? 'secondary' : 'primary'} onPress={toggleFollow} style={{ paddingVertical: 8, paddingHorizontal: spacing.lg }} />
              ) : null}
              <IconButton name="ellipsis-horizontal" label="More options" onPress={moreActions} />
            </Row>
          ) : undefined
        }
      />
      {overlap && data.life.length ? (
        <Row style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: spacing.md, justifyContent: 'space-around' }}>
          <Overlap value={overlap.shared} label="in common" />
          <Overlap value={overlap.onlyThem} label="only them" accent />
          <Overlap value={overlap.onlyMe} label="only you" />
        </Row>
      ) : null}
      <Row>
        <Chip label="Sightings" active={tab === 'sightings'} onPress={() => setTab('sightings')} />
        <Chip label="Life list" active={tab === 'life'} onPress={() => setTab('life')} />
        <Chip label="Lists" active={tab === 'lists'} onPress={() => setTab('lists')} />
        <Chip label="Map" active={tab === 'map'} onPress={() => setTab('map')} />
      </Row>
    </View>
  );

  if (tab === 'map') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Stack.Screen options={{ title: `@${data.profile.username}` }} />
        <View style={{ padding: spacing.lg }}>{header}</View>
        <SightingsMap sightings={data.sightings} showUser={false} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: `@${data.profile.username}` }} />
      {tab === 'sightings' ? (
        <FlatList
          data={data.sightings}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
          ListHeaderComponent={header}
          renderItem={({ item }) => <SightingCard sighting={item} compact />}
          ListEmptyComponent={<Empty icon="eye-outline" title="No visible sightings" />}
        />
      ) : tab === 'life' ? (
        <FlatList
          data={data.life}
          keyExtractor={(r) => r.species_code}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
          ListHeaderComponent={header}
          renderItem={({ item, index }) => (
            <Row style={{ paddingVertical: 8 }}>
              <Text variant="caption" faint style={{ width: 28, textAlign: 'right' }}>
                {data.life.length - index}
              </Text>
              <View style={{ flex: 1 }}>
                <Text variant="subheading">{speciesByCode(item.species_code)?.common ?? item.species_code}</Text>
                <Text variant="caption" muted>
                  First {formatDate(item.first_seen)} · {item.sighting_count}×
                </Text>
              </View>
              {overlap && !myCodes.has(item.species_code) ? (
                <Text variant="caption" style={{ color: colors.accent }}>
                  not yet
                </Text>
              ) : null}
            </Row>
          )}
          ListEmptyComponent={<Empty icon="list-outline" title="Nothing on the life list yet" />}
        />
      ) : (
        <FlatList
          data={data.lists}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
          ListHeaderComponent={header}
          renderItem={({ item }) => <ListCard list={item} />}
          ListEmptyComponent={<Empty icon="list-outline" title="No public lists" />}
        />
      )}
    </View>
  );
}
