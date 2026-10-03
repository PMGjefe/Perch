import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { Comments } from '@/components/Comments';
import { ErrorState } from '@/components/ErrorState';
import { reportContent } from '@/components/ReportSheet';
import { Photo } from '@/components/Photo';
import { Avatar, BottomInset, Button, Card, Empty, IconButton, Loading, Row, Screen, Text } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useUserId } from '@/lib/auth';
import { backOr } from '@/lib/nav';
import { shareList } from '@/lib/share';
import { formatDate } from '@/lib/format';
import { deleteList, fetchEngagement, fetchList, fetchProfile, fetchSightingsByIds, isFollowingList, setLike, setListFollow } from '@/lib/social';
import { speciesByCode } from '@/lib/taxonomy';
import { radius, spacing, useTheme } from '@/lib/theme';
import type { Engagement } from '@/types/db';

export default function ListDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const router = useRouter();
  const { colors } = useTheme();
  const [eng, setEng] = useState<Engagement | null>(null);
  const [following, setFollowing] = useState<boolean | null>(null);

  const { data, loading, error, reload } = useAsync(async () => {
    const res = await fetchList(id);
    if (!res) return null;
    const [profile, sightings, e, f] = await Promise.all([
      fetchProfile(res.list.user_id),
      fetchSightingsByIds(res.items.map((i) => i.sighting_id).filter((s): s is string => !!s)),
      fetchEngagement('list', [id]),
      isFollowingList(userId, id),
    ]);
    setEng(e.get(id) ?? { target_id: id, like_count: 0, comment_count: 0, liked_by_me: false });
    setFollowing(f);
    return { ...res, profile, sightings };
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const isOwner = data?.list.user_id === userId;

  const toggleLike = async () => {
    if (!eng) return;
    const next = { ...eng, liked_by_me: !eng.liked_by_me, like_count: eng.like_count + (eng.liked_by_me ? -1 : 1) };
    setEng(next);
    try {
      await setLike(userId, 'list', id, next.liked_by_me);
    } catch {
      setEng(eng);
    }
  };

  const toggleFollow = async () => {
    if (following == null) return;
    setFollowing(!following);
    try {
      await setListFollow(userId, id, !following);
    } catch {
      setFollowing(following);
    }
  };

  const remove = () =>
    Alert.alert('Delete this list?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteList(id);
            backOr('/(tabs)/me');
          } catch (e) {
            Alert.alert('Could not delete', e instanceof Error ? e.message : String(e));
          }
        },
      },
    ]);

  if (loading && !data) return <Loading />;
  if (error && !data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        <ErrorState error={error} onRetry={reload} />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        <Empty icon="eye-off-outline" title="Not available" body="This list is private or was deleted." />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Row gap={0}>
              <IconButton name="share-outline" label="Share" onPress={() => shareList(data.list)} />
              {isOwner ? (
                <>
                  <IconButton name="create-outline" label="Edit list" onPress={() => router.push({ pathname: '/list/edit/[id]', params: { id } })} />
                  <IconButton name="trash-outline" label="Delete list" color={colors.danger} onPress={remove} />
                </>
              ) : (
                <IconButton name="flag-outline" label="Report" onPress={() => reportContent(userId, 'list', id)} />
              )}
            </Row>
          ),
        }}
      />
      <Screen scroll style={{ gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          <Row>
            {!data.list.is_public ? <Ionicons name="lock-closed-outline" size={18} color={colors.textFaint} /> : null}
            <Text variant="title" style={{ flex: 1 }}>
              {data.list.title}
            </Text>
          </Row>
          {data.list.description ? <Text muted>{data.list.description}</Text> : null}
        </View>

        {data.profile ? (
          <Link href={{ pathname: '/user/[id]', params: { id: data.profile.id } }} asChild>
            <Pressable>
              <Row>
                <Avatar uri={data.profile.avatar_url} name={data.profile.display_name || data.profile.username} size={30} />
                <Text variant="label">{data.profile.display_name || data.profile.username}</Text>
                <Text variant="caption" faint>
                  · {formatDate(data.list.created_at)}
                </Text>
              </Row>
            </Pressable>
          </Link>
        ) : null}

        <Row gap={spacing.md}>
          {eng ? <Button title={`${eng.like_count}`} kind={eng.liked_by_me ? 'primary' : 'secondary'} icon={eng.liked_by_me ? 'heart' : 'heart-outline'} onPress={toggleLike} style={{ paddingVertical: 9 }} /> : null}
          {!isOwner && following != null ? <Button title={following ? 'Following' : 'Follow list'} kind={following ? 'secondary' : 'primary'} icon={following ? 'checkmark' : 'add'} onPress={toggleFollow} style={{ paddingVertical: 9 }} /> : null}
        </Row>

        <View style={{ gap: spacing.sm }}>
          {data.items.length === 0 ? (
            <Text muted>This list is empty.</Text>
          ) : null}
          {data.items.map((item, i) => {
            const sighting = item.sighting_id ? data.sightings.get(item.sighting_id) : undefined;
            const code = item.species_code ?? sighting?.species_code;
            const sp = speciesByCode(code);
            const href = item.sighting_id
              ? { pathname: '/sighting/[id]' as const, params: { id: item.sighting_id } }
              : { pathname: '/species/[code]' as const, params: { code: code ?? '' } };
            return (
              <Link key={item.id} href={href} asChild>
                <Pressable>
                  <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm }}>
                    <Text variant="caption" faint style={{ width: 22, textAlign: 'right' }}>
                      {i + 1}
                    </Text>
                    <Photo
                      path={sighting?.photo_path}
                      style={{ width: 52, height: 52, borderRadius: radius.md }}
                      fallback={
                        <View style={{ width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
                          <Ionicons name={item.sighting_id ? 'eye-outline' : 'leaf-outline'} size={20} color={colors.accent} />
                        </View>
                      }
                    />
                    <View style={{ flex: 1 }}>
                      <Text variant="subheading" numberOfLines={1}>
                        {sp?.common ?? (item.sighting_id && !sighting ? 'Sighting not visible' : code)}
                      </Text>
                      <Text variant="caption" muted numberOfLines={2}>
                        {[sighting ? `${sighting.place_name ?? ''} ${formatDate(sighting.observed_at)}`.trim() : sp?.sci, item.note].filter(Boolean).join(' — ')}
                      </Text>
                    </View>
                  </Card>
                </Pressable>
              </Link>
            );
          })}
        </View>

        <Comments type="list" id={id} onCountChange={(d) => setEng((e) => (e ? { ...e, comment_count: e.comment_count + d } : e))} />
        <BottomInset />
      </Screen>
    </KeyboardAvoidingView>
  );
}
