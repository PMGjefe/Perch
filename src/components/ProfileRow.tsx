import { Link } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Row, Text } from '@/components/ui';
import { spacing, useTheme } from '@/lib/theme';
import type { PublicProfile } from '@/types/db';

export function ProfileRow({ profile }: { profile: PublicProfile }) {
  const { colors } = useTheme();
  return (
    <Link href={{ pathname: '/user/[id]', params: { id: profile.id } }} asChild>
      <Pressable style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : 'transparent', paddingHorizontal: spacing.lg, paddingVertical: 10 })}>
        <Row gap={spacing.md}>
          <Avatar uri={profile.avatar_url} name={profile.display_name || profile.username} size={44} />
          <View style={{ flex: 1 }}>
            <Text variant="subheading">{profile.display_name || profile.username}</Text>
            <Text variant="caption" muted numberOfLines={1}>
              @{profile.username}
              {profile.bio ? ` · ${profile.bio}` : ''}
            </Text>
          </View>
        </Row>
      </Pressable>
    </Link>
  );
}
