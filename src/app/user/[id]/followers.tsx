import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { FlatList, View } from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import { ProfileRow } from '@/components/ProfileRow';
import { Button, Chip, Divider, Empty, Loading, Row, Text } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useUserId } from '@/lib/auth';
import { answerFollowRequest, fetchFollowers, fetchFollowing, fetchFollowRequests, removeFollower } from '@/lib/social';
import { spacing, useTheme } from '@/lib/theme';

export default function Followers() {
  const { id, tab: initial } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { colors } = useTheme();
  const me = useUserId();
  const [tab, setTab] = useState<'followers' | 'following'>(initial === 'following' ? 'following' : 'followers');
  const { data, loading, error, reload } = useAsync(() => (tab === 'followers' ? fetchFollowers(id) : fetchFollowing(id)), [id, tab]);
  const requests = useAsync(() => (id === me && tab === 'followers' ? fetchFollowRequests(me) : Promise.resolve([])), [id, me, tab]);
  const answer = async (followerId: string, accept: boolean) => {
    await answerFollowRequest(me, followerId, accept).catch(() => {});
    requests.reload();
    reload();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: tab === 'followers' ? 'Followers' : 'Following' }} />
      <Row style={{ padding: spacing.lg }}>
        <Chip label="Followers" active={tab === 'followers'} onPress={() => setTab('followers')} />
        <Chip label="Following" active={tab === 'following'} onPress={() => setTab('following')} />
      </Row>
      {loading && !data ? (
        <Loading />
      ) : error && !data ? (
        <ErrorState error={error} onRetry={reload} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(p) => p.id}
          ItemSeparatorComponent={Divider}
          ListHeaderComponent={
            requests.data?.length ? (
              <View style={{ paddingBottom: spacing.md }}>
                <Text variant="label" muted style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
                  Requests
                </Text>
                {requests.data.map((p) => (
                  <View key={p.id}>
                    <ProfileRow profile={p} />
                    <Row style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
                      <Button title="Accept" onPress={() => answer(p.id, true)} style={{ paddingVertical: 8 }} />
                      <Button title="Decline" kind="secondary" onPress={() => answer(p.id, false)} style={{ paddingVertical: 8 }} />
                    </Row>
                  </View>
                ))}
                <Divider />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <View>
              <ProfileRow profile={item} />
              {id === me && tab === 'followers' ? (
                <Button title="Remove" kind="ghost" onPress={() => removeFollower(me, item.id).then(reload).catch(() => {})} style={{ alignSelf: 'flex-end', paddingVertical: 4, marginRight: spacing.sm }} />
              ) : null}
            </View>
          )}
          ListEmptyComponent={<Empty icon="people-outline" title="Nobody here yet" />}
        />
      )}
    </View>
  );
}
