import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';

import { ListCard } from '@/components/ListCard';
import { SightingCard } from '@/components/SightingCard';
import { Button, Empty, Loading, Text } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { fetchEngagement, fetchFeed, fetchProfiles, setLike } from '@/lib/social';
import { spacing, useTheme } from '@/lib/theme';
import type { Engagement, FeedItem, PublicProfile } from '@/types/db';

const PAGE = 30;

interface Page {
  items: FeedItem[];
  profiles: Map<string, PublicProfile>;
  engagement: Map<string, Engagement>;
}

async function loadPage(before: string): Promise<Page> {
  const items = await fetchFeed(before, PAGE);
  const [profiles, sightingEng, listEng] = await Promise.all([
    fetchProfiles(items.map((i) => i.payload.user_id)),
    fetchEngagement('sighting', items.filter((i) => i.kind === 'sighting').map((i) => i.payload.id)),
    fetchEngagement('list', items.filter((i) => i.kind === 'list').map((i) => i.payload.id)),
  ]);
  return { items, profiles, engagement: new Map([...sightingEng, ...listEng]) };
}

export default function FeedScreen() {
  const userId = useUserId();
  const router = useRouter();
  const { colors } = useTheme();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [profiles, setProfiles] = useState<Map<string, PublicProfile>>(new Map());
  const [engagement, setEngagement] = useState<Map<string, Engagement>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const p = await loadPage(new Date().toISOString());
      setItems(p.items);
      setProfiles(p.profiles);
      setEngagement(p.engagement);
      setDone(p.items.length < PAGE);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const more = useCallback(async () => {
    if (!items?.length || done || loadingMore) return;
    setLoadingMore(true);
    try {
      const p = await loadPage(items[items.length - 1].created_at);
      setItems((cur) => [...(cur ?? []), ...p.items]);
      setProfiles((cur) => new Map([...cur, ...p.profiles]));
      setEngagement((cur) => new Map([...cur, ...p.engagement]));
      setDone(p.items.length < PAGE);
    } finally {
      setLoadingMore(false);
    }
  }, [items, done, loadingMore]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const toggleLike = async (type: 'sighting' | 'list', id: string) => {
    const e = engagement.get(id) ?? { target_id: id, like_count: 0, comment_count: 0, liked_by_me: false };
    const next = { ...e, liked_by_me: !e.liked_by_me, like_count: e.like_count + (e.liked_by_me ? -1 : 1) };
    setEngagement((cur) => new Map(cur).set(id, next));
    try {
      await setLike(userId, type, id, next.liked_by_me);
    } catch {
      setEngagement((cur) => new Map(cur).set(id, e));
    }
  };

  if (items === null && !error) return <Loading />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items ?? []}
        keyExtractor={(i) => `${i.kind}:${i.payload.id}`}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
        onEndReached={more}
        onEndReachedThreshold={0.6}
        renderItem={({ item }) =>
          item.kind === 'sighting' ? (
            <SightingCard sighting={item.payload} profile={profiles.get(item.payload.user_id)} engagement={engagement.get(item.payload.id)} onLike={() => toggleLike('sighting', item.payload.id)} />
          ) : (
            <ListCard list={item.payload} profile={profiles.get(item.payload.user_id)} engagement={engagement.get(item.payload.id)} onLike={() => toggleLike('list', item.payload.id)} />
          )
        }
        ListEmptyComponent={
          error ? (
            <Empty icon="cloud-offline-outline" title="Could not load the feed" body={error} action={<Button title="Retry" kind="secondary" onPress={refresh} />} />
          ) : (
            <Empty icon="people-outline" title="Your feed is quiet" body="Follow some birders and their public sightings and lists show up here, newest first. No ranking, ever." action={<Button title="Find people" icon="search" onPress={() => router.push('/search')} />} />
          )
        }
        ListFooterComponent={
          items?.length && done ? (
            <Text variant="caption" faint style={{ textAlign: 'center', padding: spacing.lg }}>
              You are all caught up.
            </Text>
          ) : null
        }
      />
    </View>
  );
}
