import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Avatar, Card, Row, Text } from '@/components/ui';
import { relativeTime } from '@/lib/format';
import { spacing, useTheme } from '@/lib/theme';
import type { Engagement, List, PublicProfile } from '@/types/db';

export function ListCard({ list, profile, engagement, onLike, itemCount }: { list: List; profile?: PublicProfile | null; engagement?: Engagement | null; onLike?: () => void; itemCount?: number }) {
  const { colors } = useTheme();
  return (
    <Link href={{ pathname: '/list/[id]', params: { id: list.id } }} asChild>
      <Pressable>
        <Card style={{ padding: spacing.md, gap: spacing.xs, borderLeftWidth: 4, borderLeftColor: colors.accent }}>
          {profile ? (
            <Row>
              <Avatar uri={profile.avatar_url} name={profile.display_name || profile.username} size={22} />
              <Text variant="caption" muted>
                {profile.display_name || profile.username} made a list · {relativeTime(list.created_at)}
              </Text>
            </Row>
          ) : null}
          <Row style={{ justifyContent: 'space-between' }}>
            <Text variant="subheading" style={{ flex: 1 }} numberOfLines={1}>
              {list.title}
            </Text>
            {!list.is_public ? <Ionicons name="lock-closed-outline" size={16} color={colors.textFaint} /> : null}
            <Ionicons name="list" size={16} color={colors.textFaint} />
          </Row>
          {list.description ? (
            <Text muted numberOfLines={2}>
              {list.description}
            </Text>
          ) : null}
          {itemCount != null ? (
            <Text variant="caption" faint>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>
          ) : null}
          {engagement ? (
            <Row gap={spacing.lg} style={{ marginTop: spacing.xs }}>
              <Pressable onPress={onLike} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name={engagement.liked_by_me ? 'heart' : 'heart-outline'} size={20} color={engagement.liked_by_me ? colors.accent : colors.textMuted} />
                <Text variant="caption" muted>
                  {engagement.like_count}
                </Text>
              </Pressable>
              <Row gap={4}>
                <Ionicons name="chatbubble-outline" size={18} color={colors.textMuted} />
                <Text variant="caption" muted>
                  {engagement.comment_count}
                </Text>
              </Row>
            </Row>
          ) : null}
          <View />
        </Card>
      </Pressable>
    </Link>
  );
}
