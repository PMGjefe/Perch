import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Photo, PhotoPlaceholder } from '@/components/Photo';
import { Avatar, Card, Row, Text } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { speciesByCode } from '@/lib/taxonomy';
import { spacing, useTheme } from '@/lib/theme';
import type { Engagement, PublicProfile, PublicSighting, Sighting } from '@/types/db';

interface Props {
  sighting: (Sighting | PublicSighting) & { local_photo_uri?: string | null };
  profile?: PublicProfile | null;
  engagement?: Engagement | null;
  onLike?: () => void;
  compact?: boolean;
  pending?: boolean;
}

/** Photo-forward feed/diary card: photo, species, place, date, user. */
export function SightingCard({ sighting, profile, engagement, onLike, compact, pending }: Props) {
  const { colors } = useTheme();
  const sp = speciesByCode(sighting.species_code);
  const hidden = 'location_hidden' in sighting && sighting.location_hidden;
  const fuzzed = 'location_fuzzed' in sighting && sighting.location_fuzzed;
  const place = hidden ? 'Location hidden' : fuzzed ? 'Near home' : sighting.place_name;

  return (
    <Link href={{ pathname: '/sighting/[id]', params: { id: sighting.id } }} asChild>
      <Pressable>
        <Card>
          <Photo
            path={sighting.photo_path}
            localUri={sighting.local_photo_uri}
            style={{ width: '100%', aspectRatio: compact ? 16 / 9 : 4 / 3 }}
            fallback={<PhotoPlaceholder label={initials(sp?.common ?? '?')} height={compact ? 72 : 110} fontSize={compact ? 28 : 40} />}
          />
          <View style={{ padding: spacing.md, gap: spacing.xs }}>
            {profile ? (
              <Row style={{ marginBottom: spacing.xs }}>
                <Avatar uri={profile.avatar_url} name={profile.display_name || profile.username} size={22} />
                <Text variant="caption" muted>
                  {profile.display_name || profile.username}
                </Text>
              </Row>
            ) : null}
            <Row style={{ justifyContent: 'space-between' }}>
              <Text variant="subheading" style={{ flex: 1 }} numberOfLines={1}>
                {sp?.common ?? sighting.species_code}
              </Text>
              {sighting.sensitive ? <Ionicons name="eye-off-outline" size={16} color={colors.textFaint} /> : null}
              {sighting.visibility === 'private' ? <Ionicons name="lock-closed-outline" size={16} color={colors.textFaint} /> : null}
              {pending ? <Ionicons name="cloud-upload-outline" size={16} color={colors.textFaint} /> : null}
            </Row>
            <Text variant="caption" muted numberOfLines={1}>
              {[place, formatDate(sighting.observed_at)].filter(Boolean).join(' · ')}
            </Text>
            {!compact && sighting.note ? (
              <Text numberOfLines={3} style={{ marginTop: 2 }}>
                {sighting.note}
              </Text>
            ) : null}
            {engagement ? (
              <Row style={{ marginTop: spacing.xs }} gap={spacing.lg}>
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
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

function initials(name: string) {
  return name
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
