import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import React from 'react';
import { Pressable, View } from 'react-native';

import { Rise, Tap } from '@/components/motion';
import { Photo } from '@/components/Photo';
import { Avatar, Row, Text } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { speciesByCode } from '@/lib/taxonomy';
import { fonts, radius, spacing, useTheme } from '@/lib/theme';
import type { Engagement, PublicProfile, PublicSighting, Sighting } from '@/types/db';

interface Props {
  sighting: (Sighting | PublicSighting) & { local_photo_uri?: string | null };
  profile?: PublicProfile | null;
  engagement?: Engagement | null;
  onLike?: () => void;
  compact?: boolean;
  pending?: boolean;
  /** Position in a list, for staggered entrance. */
  index?: number;
}

/**
 * Photo-forward card. With a photo: full-bleed image, species name set in the serif over a
 * gradient scrim. Without: a warm gradient block with the same layout, so the feed keeps its rhythm.
 */
export function SightingCard({ sighting, profile, engagement, onLike, compact, pending, index = 0 }: Props) {
  const { colors, dark } = useTheme();
  const sp = speciesByCode(sighting.species_code);
  const hidden = 'location_hidden' in sighting && sighting.location_hidden;
  const fuzzed = 'location_fuzzed' in sighting && sighting.location_fuzzed;
  const place = hidden ? 'Location hidden' : fuzzed ? 'Near home' : sighting.place_name;
  const hasPhoto = !!(sighting.local_photo_uri || sighting.photo_path);
  const height = compact ? 160 : 300;
  const name = sp?.common ?? sighting.species_code;

  return (
    <Rise index={index}>
      <Link href={{ pathname: '/sighting/[id]', params: { id: sighting.id } }} asChild>
        <Tap scaleTo={0.98}>
          <View style={{ borderRadius: radius.lg, overflow: 'hidden', height, backgroundColor: colors.surfaceAlt }}>
            {hasPhoto ? (
              <Photo path={sighting.photo_path} localUri={sighting.local_photo_uri} style={{ width: '100%', height }} />
            ) : (
              <LinearGradient colors={dark ? ['#3A2A1E', '#1F1C17'] : ['#F1D9C4', '#E6C7A8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: '100%', height, alignItems: 'flex-end', justifyContent: 'flex-start', padding: spacing.md }}>
                <Text style={{ fontFamily: fonts.displayItalic, fontSize: compact ? 60 : 110, color: colors.accent, opacity: 0.35, lineHeight: compact ? 64 : 116 }}>{initials(name)}</Text>
              </LinearGradient>
            )}
            <LinearGradient
              colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.72)']}
              locations={[0.35, 0.6, 1]}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, justifyContent: 'flex-end', padding: spacing.md }}
              pointerEvents="box-none"
            >
              {profile ? (
                <Row style={{ position: 'absolute', top: spacing.md, left: spacing.md }}>
                  <Avatar uri={profile.avatar_url} name={profile.display_name || profile.username} size={24} />
                  <Text variant="caption" style={{ color: '#fff', fontFamily: fonts.medium, textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 }}>
                    {profile.display_name || profile.username}
                  </Text>
                </Row>
              ) : null}
              <Row style={{ position: 'absolute', top: spacing.md, right: spacing.md }} gap={6}>
                {sighting.sensitive ? <Badge icon="eye-off-outline" /> : null}
                {sighting.visibility === 'private' ? <Badge icon="lock-closed-outline" /> : null}
                {sighting.visibility === 'followers' ? <Badge icon="people-outline" /> : null}
                {pending ? <Badge icon="cloud-upload-outline" /> : null}
              </Row>
              <Text style={{ fontFamily: fonts.display, fontSize: compact ? 22 : 28, lineHeight: compact ? 26 : 32, letterSpacing: -0.4, color: '#fff' }} numberOfLines={2}>
                {name}
              </Text>
              <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)', marginTop: 2 }} numberOfLines={1}>
                {[place, formatDate(sighting.observed_at)].filter(Boolean).join(' · ')}
              </Text>
              {!compact && sighting.note ? (
                <Text numberOfLines={2} style={{ color: 'rgba(255,255,255,0.92)', marginTop: spacing.xs, fontSize: 15 }}>
                  {sighting.note}
                </Text>
              ) : null}
              {engagement ? (
                <Row style={{ marginTop: spacing.sm }} gap={spacing.lg}>
                  <Pressable onPress={onLike} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Ionicons name={engagement.liked_by_me ? 'heart' : 'heart-outline'} size={22} color={engagement.liked_by_me ? colors.accent : '#fff'} />
                    <Text variant="label" style={{ color: '#fff' }}>
                      {engagement.like_count}
                    </Text>
                  </Pressable>
                  <Row gap={5}>
                    <Ionicons name="chatbubble-outline" size={19} color="#fff" />
                    <Text variant="label" style={{ color: '#fff' }}>
                      {engagement.comment_count}
                    </Text>
                  </Row>
                </Row>
              ) : null}
            </LinearGradient>
          </View>
        </Tap>
      </Link>
    </Rise>
  );
}

function Badge({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={{ backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 999, padding: 6 }}>
      <Ionicons name={icon} size={14} color="#fff" />
    </View>
  );
}

function initials(name: string) {
  return name
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}
