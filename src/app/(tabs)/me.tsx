import { Link, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { ListCard } from '@/components/ListCard';
import { ProfileHeader } from '@/components/ProfileHeader';
import { BottomInset, Button, Chip, Empty, IconButton, Row, Screen, Section, Text } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useLocalQuery } from '@/hooks/useLocalSightings';
import { useAuth, useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { fetchFollowedLists, fetchLists, fetchProfileStats } from '@/lib/social';
import { spacing } from '@/lib/theme';

export default function MeScreen() {
  const userId = useUserId();
  const { profile, signOut } = useAuth();
  const router = useRouter();
  const counts = useLocalQuery(() => db.stats(userId), [userId]);
  const { data, reload } = useAsync(async () => {
    const [stats, lists, followed] = await Promise.all([fetchProfileStats(userId), fetchLists(userId), fetchFollowedLists(userId)]);
    return { stats, lists, followed };
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'Unsynced sightings stay on this device until you sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);

  if (!profile) return null;

  return (
    <Screen scroll style={{ gap: spacing.xl }}>
      <ProfileHeader
        profile={profile}
        stats={data?.stats ?? null}
        localCounts={counts}
        right={<IconButton name="settings-outline" onPress={() => router.push('/settings')} />}
      />
      <Row>
        <Chip label="Find people" icon="search" onPress={() => router.push('/search')} />
        <Chip label="Import CSV" icon="download-outline" onPress={() => router.push('/settings/import')} />
        <Chip label="Edit profile" icon="create-outline" onPress={() => router.push('/settings')} />
      </Row>

      <Section title="My lists" right={<Button title="New" kind="ghost" icon="add" onPress={() => router.push({ pathname: '/list/edit/[id]', params: { id: 'new' } })} style={{ paddingVertical: 4, paddingHorizontal: spacing.sm }} />}>
        {data?.lists.length === 0 ? (
          <Empty icon="list-outline" title="No lists yet" body="Lists are titled, ordered collections: “Birds of my commute”, “Best of 2025”." />
        ) : (
          <View style={{ gap: spacing.md }}>{data?.lists.map((l) => <ListCard key={l.id} list={l} />)}</View>
        )}
      </Section>

      {data?.followed.length ? (
        <Section title="Lists I follow">
          <View style={{ gap: spacing.md }}>{data.followed.map((l) => <ListCard key={l.id} list={l} />)}</View>
        </Section>
      ) : null}

      <Link href={{ pathname: '/user/[id]', params: { id: userId } }} asChild>
        <Pressable>
          <Text variant="caption" muted style={{ textAlign: 'center' }}>
            View my public profile
          </Text>
        </Pressable>
      </Link>
      <Button title="Sign out" kind="secondary" onPress={confirmSignOut} />
      <BottomInset />
      <View style={{ height: 80 }} />
    </Screen>
  );
}
