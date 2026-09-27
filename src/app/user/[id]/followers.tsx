import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, View } from 'react-native';

import { ProfileRow } from '@/components/ProfileRow';
import { Chip, Divider, Empty, Loading, Row } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { fetchFollowers, fetchFollowing } from '@/lib/social';
import { spacing, useTheme } from '@/lib/theme';

export default function Followers() {
  const { id, tab: initial } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { colors } = useTheme();
  const [tab, setTab] = useState<'followers' | 'following'>(initial === 'following' ? 'following' : 'followers');
  const { data, loading } = useAsync(() => (tab === 'followers' ? fetchFollowers(id) : fetchFollowing(id)), [id, tab]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: tab === 'followers' ? 'Followers' : 'Following' }} />
      <Row style={{ padding: spacing.lg }}>
        <Chip label="Followers" active={tab === 'followers'} onPress={() => setTab('followers')} />
        <Chip label="Following" active={tab === 'following'} onPress={() => setTab('following')} />
      </Row>
      {loading && !data ? (
        <Loading />
      ) : (
        <FlatList data={data ?? []} keyExtractor={(p) => p.id} ItemSeparatorComponent={Divider} renderItem={({ item }) => <ProfileRow profile={item} />} ListEmptyComponent={<Empty icon="people-outline" title="Nobody here yet" />} />
      )}
    </View>
  );
}
