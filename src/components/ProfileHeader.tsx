import { Link } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Stat } from '@/components/Stat';
import { Avatar, Row, Text } from '@/components/ui';
import { spacing, useTheme } from '@/lib/theme';
import type { ProfileStats, PublicProfile } from '@/types/db';

export function ProfileHeader({ profile, stats, localCounts, right }: { profile: PublicProfile; stats: ProfileStats | null; localCounts?: { species: number; sightings: number }; right?: React.ReactNode }) {
  const { colors } = useTheme();
  const species = localCounts?.species ?? stats?.species_count ?? 0;
  const sightings = localCounts?.sightings ?? stats?.sighting_count ?? 0;
  return (
    <View style={{ gap: spacing.md }}>
      <Row style={{ alignItems: 'flex-start' }} gap={spacing.md}>
        <Avatar uri={profile.avatar_url} name={profile.display_name || profile.username} size={72} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="heading">{profile.display_name || profile.username}</Text>
          <Text muted>@{profile.username}</Text>
          {profile.bio ? <Text style={{ marginTop: spacing.xs }}>{profile.bio}</Text> : null}
        </View>
        {right}
      </Row>
      <Row style={{ justifyContent: 'space-around', backgroundColor: colors.surface, borderRadius: 14, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.border }}>
        <Stat value={species} label="species" />
        <Stat value={sightings} label="sightings" />
        <Link href={{ pathname: '/user/[id]/followers', params: { id: profile.id, tab: 'followers' } }} asChild>
          <Pressable>
            <Stat value={stats?.followers ?? 0} label="followers" />
          </Pressable>
        </Link>
        <Link href={{ pathname: '/user/[id]/followers', params: { id: profile.id, tab: 'following' } }} asChild>
          <Pressable>
            <Stat value={stats?.following ?? 0} label="following" />
          </Pressable>
        </Link>
      </Row>
    </View>
  );
}
