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

/** Height of the avatar row and the badges row, which the poster's name clears when either is present. */
const TOP_ROW = 26;

/**
 * Photo-forward card. With a photo: full-bleed image, species name set in the serif over a
 * gradient scrim. Without: a typographic poster on a warm gradient keyed to the bird's family,
 * so an imported, photo-less diary still reads as a diary of birds.
 */
export function SightingCard({ sighting, profile, engagement, onLike, compact, pending, index = 0 }: Props) {
  const { colors } = useTheme();
  const sp = speciesByCode(sighting.species_code);
  const hidden = 'location_hidden' in sighting && sighting.location_hidden;
  const fuzzed = 'location_fuzzed' in sighting && sighting.location_fuzzed;
  const place = hidden ? 'Location hidden' : fuzzed ? 'Near home' : sighting.place_name;
  const hasPhoto = !!(sighting.local_photo_uri || sighting.photo_path);
  const height = compact ? 160 : 300;
  const name = sp?.common ?? sighting.species_code;
  const when = formatDate(sighting.observed_at);
  const meta = [place, when].filter(Boolean).join(' · ');
  // Over a photo everything is white on the scrim; on a poster it is the theme's ink.
  const ink = hasPhoto ? '#fff' : colors.text;

  const badges: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [];
  if (sighting.sensitive) badges.push({ icon: 'eye-off-outline', label: 'Sensitive location' });
  if (sighting.visibility === 'private') badges.push({ icon: 'lock-closed-outline', label: 'Only you' });
  if (sighting.visibility === 'followers') badges.push({ icon: 'people-outline', label: 'Followers only' });
  if (pending) badges.push({ icon: 'cloud-upload-outline', label: 'Not backed up yet' });

  return (
    <Rise index={index}>
      <Link href={{ pathname: '/sighting/[id]', params: { id: sighting.id } }} asChild>
        <Tap scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${name}${place ? `, ${place}` : ''}, ${when}`}>
          <View style={{ borderRadius: radius.lg, overflow: 'hidden', height, backgroundColor: colors.surfaceAlt }}>
            {hasPhoto ? (
              <>
                <Photo path={sighting.photo_path} localUri={sighting.local_photo_uri} style={{ width: '100%', height }} />
                <LinearGradient
                  colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.15)', 'rgba(0,0,0,0.72)']}
                  locations={[0.35, 0.6, 1]}
                  style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, justifyContent: 'flex-end', padding: spacing.md }}
                  pointerEvents="box-none"
                >
                  <Text style={{ fontFamily: fonts.display, fontSize: compact ? 22 : 28, lineHeight: compact ? 26 : 32, letterSpacing: -0.4, color: '#fff' }} numberOfLines={2}>
                    {name}
                  </Text>
                  <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)', marginTop: 2 }} numberOfLines={1}>
                    {meta}
                  </Text>
                  {!compact && sighting.note ? (
                    <Text numberOfLines={2} style={{ color: 'rgba(255,255,255,0.92)', marginTop: spacing.xs, fontSize: 15 }}>
                      {sighting.note}
                    </Text>
                  ) : null}
                  {engagement ? <EngagementRow engagement={engagement} onLike={onLike} color={ink} accent={colors.accent} /> : null}
                </LinearGradient>
              </>
            ) : (
              <>
                <SpeciesPoster name={name} family={sp?.family} compact={compact} topInset={profile || badges.length ? TOP_ROW + spacing.sm : 0} />
                <View style={{ position: 'absolute', left: spacing.md, right: spacing.md, bottom: spacing.md }} pointerEvents="box-none">
                  {!compact && sighting.note ? (
                    <Text numberOfLines={2} style={{ fontSize: 15, color: colors.text }}>
                      {sighting.note}
                    </Text>
                  ) : null}
                  <Text variant="caption" muted style={{ marginTop: 2 }} numberOfLines={1}>
                    {meta}
                  </Text>
                  {engagement ? <EngagementRow engagement={engagement} onLike={onLike} color={ink} accent={colors.accent} /> : null}
                </View>
              </>
            )}
            {profile ? (
              <Row style={{ position: 'absolute', top: spacing.md, left: spacing.md }}>
                <Avatar uri={profile.avatar_url} name={profile.display_name || profile.username} size={24} />
                <Text variant="caption" style={[{ color: ink, fontFamily: fonts.medium }, hasPhoto && { textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 }]}>
                  {profile.display_name || profile.username}
                </Text>
              </Row>
            ) : null}
            {badges.length ? (
              <Row style={{ position: 'absolute', top: spacing.md, right: spacing.md }} gap={6}>
                {badges.map((b) => (
                  <Badge key={b.icon} icon={b.icon} label={b.label} onPhoto={hasPhoto} />
                ))}
              </Row>
            ) : null}
          </View>
        </Tap>
      </Link>
    </Rise>
  );
}

/**
 * Plain card for a sighting without a photo: the name in the serif on a quiet surface, with the
 * family underneath, like an entry in a field guide. Fills its parent.
 */
export function SpeciesPoster({ name, family, compact, topInset = 0 }: { name: string; family?: string; compact?: boolean; topInset?: number }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: '100%', height: '100%', padding: spacing.md, paddingTop: spacing.md + topInset, justifyContent: 'flex-start', backgroundColor: colors.surfaceAlt }}>
      <Text style={{ fontFamily: fonts.display, fontSize: compact ? 24 : 32, lineHeight: compact ? 28 : 36, letterSpacing: -0.4, color: colors.text }} numberOfLines={compact ? 2 : 3}>
        {name}
      </Text>
      {family ? (
        <Text variant="caption" muted style={{ marginTop: 2 }} numberOfLines={1}>
          {family}
        </Text>
      ) : null}
    </View>
  );
}

function EngagementRow({ engagement, onLike, color, accent }: { engagement: Engagement; onLike?: () => void; color: string; accent: string }) {
  const liked = engagement.liked_by_me;
  return (
    <Row style={{ marginTop: spacing.sm }} gap={spacing.lg}>
      <Pressable
        onPress={onLike}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={liked ? `Unlike, ${engagement.like_count}` : `Like, ${engagement.like_count}`}
        accessibilityState={{ selected: liked }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 44, minWidth: 44, justifyContent: 'center' }}
      >
        <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? accent : color} />
        <Text variant="label" style={{ color }}>
          {engagement.like_count}
        </Text>
      </Pressable>
      <Row gap={5} accessible accessibilityLabel={`${engagement.comment_count} comments`}>
        <Ionicons name="chatbubble-outline" size={19} color={color} />
        <Text variant="label" style={{ color }}>
          {engagement.comment_count}
        </Text>
      </Row>
    </Row>
  );
}

function Badge({ icon, label, onPhoto }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPhoto: boolean }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={label} style={{ backgroundColor: onPhoto ? 'rgba(0,0,0,0.35)' : colors.surfaceAlt, borderRadius: radius.pill, padding: 6 }}>
      <Ionicons name={icon} size={14} color={onPhoto ? '#fff' : colors.textMuted} />
    </View>
  );
}
