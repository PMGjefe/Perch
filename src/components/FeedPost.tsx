import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Photo } from '@/components/Photo';
import { Avatar, Row, Text } from '@/components/ui';
import { formatDate, relativeTime } from '@/lib/format';
import { speciesByCode } from '@/lib/taxonomy';
import { fonts, spacing, useTheme } from '@/lib/theme';
import type { Engagement, PublicProfile, PublicSighting, Sighting } from '@/types/db';

interface Props {
  sighting: (Sighting | PublicSighting) & { local_photo_uri?: string | null };
  profile?: PublicProfile | null;
  engagement?: Engagement | null;
  onLike?: () => void;
}

/**
 * A feed post the way Birda and Instagram lay one out: who, above; the photo, edge to edge;
 * the actions and the words, below. Nothing is written on top of the picture.
 */
export function FeedPost({ sighting, profile, engagement, onLike }: Props) {
  const { colors } = useTheme();
  const sp = speciesByCode(sighting.species_code);
  const hidden = 'location_hidden' in sighting && sighting.location_hidden;
  const fuzzed = 'location_fuzzed' in sighting && sighting.location_fuzzed;
  const place = hidden ? null : fuzzed ? 'Near home' : sighting.place_name;
  const hasPhoto = !!(sighting.local_photo_uri || sighting.photo_path);
  const name = profile?.display_name || profile?.username || '';
  const href = { pathname: '/sighting/[id]' as const, params: { id: sighting.id } };

  return (
    <View style={{ paddingBottom: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
      {profile ? (
        <Link href={{ pathname: '/user/[id]', params: { id: profile.id } }} asChild>
          <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 10 }}>
            <Avatar uri={profile.avatar_url} name={name} size={32} />
            <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
              {name}
            </Text>
            <Text variant="caption" muted>
              {relativeTime(sighting.created_at)}
            </Text>
          </Pressable>
        </Link>
      ) : null}
      <Link href={href} asChild>
        <Pressable>
          {hasPhoto ? <Photo path={sighting.photo_path} localUri={sighting.local_photo_uri} style={{ width: '100%', aspectRatio: 4 / 3 }} /> : null}
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 2 }}>
            {engagement ? (
              <Row gap={spacing.lg} style={{ paddingBottom: 6 }}>
                <Pressable onPress={onLike} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name={engagement.liked_by_me ? 'heart' : 'heart-outline'} size={24} color={engagement.liked_by_me ? colors.accent : colors.text} />
                  {engagement.like_count ? <Text variant="label">{engagement.like_count}</Text> : null}
                </Pressable>
                <Row gap={6}>
                  <Ionicons name="chatbubble-outline" size={22} color={colors.text} />
                  {engagement.comment_count ? <Text variant="label">{engagement.comment_count}</Text> : null}
                </Row>
              </Row>
            ) : null}
            <Text variant="species">{sp?.common ?? sighting.species_code}</Text>
            <Text variant="caption" muted>
              {[place, formatDate(sighting.observed_at)].filter(Boolean).join(' · ')}
              {sighting.sensitive ? ' · location hidden' : ''}
            </Text>
            {sighting.note ? (
              <Text numberOfLines={3} style={{ marginTop: 4, fontFamily: fonts.body }}>
                {sighting.note}
              </Text>
            ) : null}
          </View>
        </Pressable>
      </Link>
    </View>
  );
}
