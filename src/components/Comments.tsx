import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Avatar, Button, Input, Row, Text } from '@/components/ui';
import { useAsync } from '@/hooks/useAsync';
import { useUserId } from '@/lib/auth';
import { relativeTime } from '@/lib/format';
import { addComment, deleteComment, fetchComments, fetchProfiles } from '@/lib/social';
import { spacing, useTheme } from '@/lib/theme';
import type { PublicProfile, TargetType } from '@/types/db';

export function Comments({ type, id, onCountChange }: { type: TargetType; id: string; onCountChange?: (delta: number) => void }) {
  const { colors } = useTheme();
  const userId = useUserId();
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, reload } = useAsync(async () => {
    const comments = await fetchComments(type, id);
    const profiles = await fetchProfiles(comments.map((c) => c.user_id));
    return { comments, profiles };
  }, [type, id]);

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    try {
      await addComment(userId, type, id, text);
      setBody('');
      onCountChange?.(1);
      await reload();
    } catch (e) {
      Alert.alert('Could not comment', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (cid: string) =>
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteComment(cid);
          onCountChange?.(-1);
          reload();
        },
      },
    ]);

  return (
    <View style={{ gap: spacing.md }}>
      <Text variant="subheading">Comments</Text>
      {data?.comments.length === 0 ? (
        <Text variant="caption" muted>
          Nothing yet.
        </Text>
      ) : null}
      {data?.comments.map((c) => {
        const p: PublicProfile | undefined = data.profiles.get(c.user_id);
        return (
          <Pressable key={c.id} onLongPress={c.user_id === userId ? () => remove(c.id) : undefined}>
            <Row style={{ alignItems: 'flex-start' }}>
              <Avatar uri={p?.avatar_url} name={p?.display_name || p?.username} size={30} />
              <View style={{ flex: 1, gap: 2 }}>
                <Row>
                  <Text variant="label">{p?.display_name || p?.username || '…'}</Text>
                  <Text variant="caption" faint>
                    {relativeTime(c.created_at)}
                  </Text>
                </Row>
                <Text>{c.body}</Text>
              </View>
            </Row>
          </Pressable>
        );
      })}
      <Row style={{ alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Input value={body} onChangeText={setBody} placeholder="Add a comment" multiline style={{ maxHeight: 100 }} />
        </View>
        <Button title="Post" kind="secondary" onPress={submit} loading={busy} disabled={!body.trim()} style={{ paddingVertical: 12, paddingHorizontal: spacing.lg, borderColor: colors.border }} />
      </Row>
    </View>
  );
}
