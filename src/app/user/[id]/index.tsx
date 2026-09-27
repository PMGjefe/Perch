import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';

import { ListCard } from '@/components/ListCard';
import { ProfileHeader } from '@/components/ProfileHeader';
import { SightingCard } from '@/components/SightingCard';
import { SightingsMap } from '@/components/SightingsMap';
import { Button, Chip, Empty, Loading, Row, Text } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useUserId } from '@/lib/auth';
import { signPhotoUrls } from '@/lib/photos';
import { formatDate } from '@/lib/format';
import { fetchLists, fetchProfile, fetchProfileStats, fetchUserLifeList, fetchUserSightings, setFollow } from '@/lib/social';
import { speciesByCode } from '@/lib/taxonomy';
import { spacing, useTheme } from '@/lib/theme';

type Tab = 'sightings' | 'life' | 'lists' | 'map';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useUserId();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('sightings');
  const [following, setFollowing] = useState<boolean | null>(null);

  const { data, loading, reload } = useAsync(async () => {
    const [profile, stats, sightings, life, lists] = await Promise.all([fetchProfile(id), fetchProfileStats(id), fetchUserSightings(id), fetchUserLifeList(id), fetchLists(id)]);
    setFollowing(stats.is_followed_by_me);
    await signPhotoUrls(sightings.map((s) => s.photo_path));
    return { profile, stats, sightings, life, lists };
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const toggleFollow = async () => {
    if (following == null || !data) return;
    setFollowing(!following);
    try {
      await setFollow(me, id, !following);
      reload();
    } catch {
      setFollowing(following);
    }
  };

  if (loading && !data) return <Loading />;
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
        right={id !== me && following != null ? <Button title={following ? 'Following' : 'Follow'} kind={following ? 'secondary' : 'primary'} onPress={toggleFollow} style={{ paddingVertical: 8, paddingHorizontal: spacing.lg }} /> : undefined}
      />
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
        <SightingsMap sightings={data.sightings} />
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
