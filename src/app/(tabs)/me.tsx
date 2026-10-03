import { Link, useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import { ListCard } from '@/components/ListCard';
import { Skeleton } from '@/components/Skeleton';
import { useSyncState } from '@/components/SyncProvider';
import { ProfileHeader } from '@/components/ProfileHeader';
import { BottomInset, Button, Chip, Empty, IconButton, Loading, Row, Screen, Section, Text } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useLocalQuery } from '@/hooks/useLocalSightings';
import { useAuth, useUserId } from '@/lib/auth';
import * as db from '@/lib/db';
import { fetchFollowedLists, fetchLists, fetchProfileStats } from '@/lib/social';
import { spacing, useTheme } from '@/lib/theme';
import { DEFAULT_USERNAME } from '@/lib/validation';

export default function MeScreen() {
  const userId = useUserId();
  const { profile, loading: authLoading, refreshProfile, signOut } = useAuth();
  const { pending } = useSyncState();
  const router = useRouter();
  const { colors } = useTheme();
  const counts = useLocalQuery(() => db.stats(userId), [userId]);
  const { data, error, loading, reload } = useAsync(async () => {
    const [stats, lists, followed] = await Promise.all([fetchProfileStats(userId), fetchLists(userId), fetchFollowedLists(userId)]);
    return { stats, lists, followed };
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const confirmSignOut = () =>
    pending > 0
      ? Alert.alert('Sign out?', `${pending} sighting${pending === 1 ? '' : 's'} have not synced yet. Signing out and clearing this device would lose them.`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Keep them, sign out', onPress: () => signOut({ keepLocal: true }) },
          { text: 'Clear and sign out', style: 'destructive', onPress: () => signOut() },
        ])
      : Alert.alert('Sign out?', 'Your sightings are safe in your account and will be removed from this device.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
        ]);

  if (!profile) {
    if (authLoading) return <Loading />;
    return (
      <Screen>
        <ErrorState error="Could not load your profile" onRetry={refreshProfile} />
        <Button title="Sign out" kind="ghost" onPress={() => signOut({ keepLocal: true })} />
      </Screen>
    );
  }

  return (
    <Screen scroll style={{ gap: spacing.xl }}>
      <ProfileHeader
        profile={profile}
        stats={data?.stats ?? null}
        localCounts={counts}
        right={<IconButton name="settings-outline" label="Settings" onPress={() => router.push('/settings')} />}
      />
      {DEFAULT_USERNAME.test(profile.username) ? (
        <Pressable onPress={() => router.push('/settings')} style={{ backgroundColor: colors.accentSoft, borderRadius: 14, padding: spacing.md }}>
          <Text variant="label" style={{ color: colors.accent }}>
            Pick a username
          </Text>
          <Text variant="caption" muted>
            You are @{profile.username} for now. Choose a handle so friends can find you.
          </Text>
        </Pressable>
      ) : null}
      <Row>
        <Chip label="Find people" icon="search" onPress={() => router.push('/search')} />
        <Chip label="Import CSV" icon="download-outline" onPress={() => router.push('/settings/import')} />
        <Chip label={`${new Date().getFullYear()} in birds`} icon="sparkles-outline" onPress={() => router.push({ pathname: '/year/[year]', params: { year: String(new Date().getFullYear()) } })} />
      </Row>

      {error ? <ErrorState error={error} onRetry={reload} /> : null}

      <Section title="My lists" right={<Button title="New" kind="ghost" icon="add" onPress={() => router.push({ pathname: '/list/edit/[id]', params: { id: 'new' } })} style={{ paddingVertical: 4, paddingHorizontal: spacing.sm }} />}>
        {loading && !data ? (
          <View style={{ gap: spacing.md }}>
            <Skeleton height={96} round={18} />
            <Skeleton height={96} round={18} />
          </View>
        ) : data?.lists.length === 0 ? (
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
    </Screen>
  );
}
