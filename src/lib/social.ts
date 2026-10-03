// Thin data helpers over Supabase for everything that is not the user's own sighting store.
import { supabase } from '@/lib/supabase';
import type { Comment, Engagement, FeedItem, LifeListRow, List, ListItem, ProfileStats, PublicProfile, PublicSighting, TargetType } from '@/types/db';

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

const profileCache = new Map<string, PublicProfile>();

/** Drop a cached profile (after the user edits their own). */
export function invalidateProfile(id: string) {
  profileCache.delete(id);
}

export async function fetchProfiles(ids: string[]): Promise<Map<string, PublicProfile>> {
  const missing = [...new Set(ids)].filter((id) => !profileCache.has(id));
  if (missing.length) {
    const { data, error } = await supabase.from('public_profiles').select('*').in('id', missing);
    fail(error);
    for (const p of (data ?? []) as PublicProfile[]) profileCache.set(p.id, p);
  }
  return new Map(ids.map((id) => [id, profileCache.get(id)]).filter((e): e is [string, PublicProfile] => !!e[1]));
}

export async function fetchProfile(id: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.from('public_profiles').select('*').eq('id', id).maybeSingle();
  fail(error);
  if (data) profileCache.set(id, data as PublicProfile);
  return (data as PublicProfile | null) ?? null;
}

export async function fetchProfileStats(id: string): Promise<ProfileStats> {
  const { data, error } = await supabase.rpc('profile_stats', { uid: id }).single();
  fail(error);
  return data as ProfileStats;
}

export async function searchProfiles(q: string): Promise<PublicProfile[]> {
  const { data, error } = await supabase.rpc('search_profiles', { q });
  fail(error);
  return (data ?? []) as PublicProfile[];
}

export async function fetchEngagement(type: TargetType, ids: string[]): Promise<Map<string, Engagement>> {
  if (!ids.length) return new Map();
  const { data, error } = await supabase.rpc('engagement', { t: type, ids });
  fail(error);
  return new Map(((data ?? []) as Engagement[]).map((e) => [e.target_id, e]));
}

export async function setLike(userId: string, type: TargetType, id: string, liked: boolean): Promise<void> {
  if (liked) {
    const { error } = await supabase.from('likes').upsert({ user_id: userId, target_type: type, target_id: id }, { onConflict: 'user_id,target_type,target_id' });
    fail(error);
  } else {
    const { error } = await supabase.from('likes').delete().match({ user_id: userId, target_type: type, target_id: id });
    fail(error);
  }
}

export async function fetchComments(type: TargetType, id: string): Promise<Comment[]> {
  const { data, error } = await supabase.from('comments').select('*').eq('target_type', type).eq('target_id', id).order('created_at', { ascending: true });
  fail(error);
  return (data ?? []) as Comment[];
}

export async function addComment(userId: string, type: TargetType, id: string, body: string): Promise<Comment> {
  const { data, error } = await supabase.from('comments').insert({ user_id: userId, target_type: type, target_id: id, body }).select('*').single();
  fail(error);
  return data as Comment;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', id);
  fail(error);
}

export async function setFollow(userId: string, followeeId: string, follow: boolean): Promise<void> {
  if (follow) {
    const { error } = await supabase.from('follows').upsert({ follower_id: userId, followee_id: followeeId }, { onConflict: 'follower_id,followee_id' });
    fail(error);
  } else {
    const { error } = await supabase.from('follows').delete().match({ follower_id: userId, followee_id: followeeId });
    fail(error);
  }
}

export async function fetchFollowers(userId: string): Promise<PublicProfile[]> {
  const { data, error } = await supabase.from('follows').select('follower_id').eq('followee_id', userId).eq('status', 'accepted');
  fail(error);
  const ids = (data ?? []).map((r: { follower_id: string }) => r.follower_id);
  return [...(await fetchProfiles(ids)).values()];
}

export async function fetchFollowing(userId: string): Promise<PublicProfile[]> {
  const { data, error } = await supabase.from('follows').select('followee_id').eq('follower_id', userId).eq('status', 'accepted');
  fail(error);
  const ids = (data ?? []).map((r: { followee_id: string }) => r.followee_id);
  return [...(await fetchProfiles(ids)).values()];
}

export async function fetchPublicSighting(id: string): Promise<PublicSighting | null> {
  const { data, error } = await supabase.from('public_sightings').select('*').eq('id', id).maybeSingle();
  fail(error);
  return (data as PublicSighting | null) ?? null;
}

export async function fetchUserSightings(userId: string, limit = 200): Promise<PublicSighting[]> {
  const { data, error } = await supabase.from('public_sightings').select('*').eq('user_id', userId).order('observed_at', { ascending: false }).limit(limit);
  fail(error);
  return (data ?? []) as PublicSighting[];
}

export async function fetchUserLifeList(userId: string): Promise<LifeListRow[]> {
  const { data, error } = await supabase.from('life_list').select('*').eq('user_id', userId).order('first_seen', { ascending: false });
  fail(error);
  return (data ?? []) as LifeListRow[];
}

/** Omit `before` to let the server use its own clock (device clocks drift). */
export async function fetchFeed(before: string | undefined, pageSize = 30): Promise<FeedItem[]> {
  const { data, error } = await supabase.rpc('feed', before ? { before, page_size: pageSize } : { page_size: pageSize });
  fail(error);
  return (data ?? []) as FeedItem[];
}

// ---------------------------------------------------------------- lists
export async function fetchLists(userId: string): Promise<List[]> {
  const { data, error } = await supabase.from('lists').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  fail(error);
  return (data ?? []) as List[];
}

export async function fetchFollowedLists(userId: string): Promise<List[]> {
  const { data, error } = await supabase.from('list_follows').select('list_id').eq('user_id', userId);
  fail(error);
  const ids = (data ?? []).map((r: { list_id: string }) => r.list_id);
  if (!ids.length) return [];
  const { data: lists, error: e2 } = await supabase.from('lists').select('*').in('id', ids).order('updated_at', { ascending: false });
  fail(e2);
  return (lists ?? []) as List[];
}

export async function fetchList(id: string): Promise<{ list: List; items: ListItem[] } | null> {
  const { data, error } = await supabase.from('lists').select('*').eq('id', id).maybeSingle();
  fail(error);
  if (!data) return null;
  const { data: items, error: e2 } = await supabase.from('list_items').select('*').eq('list_id', id).order('position');
  fail(e2);
  return { list: data as List, items: (items ?? []) as ListItem[] };
}

export async function saveList(input: Partial<List> & { user_id: string; title: string }): Promise<List> {
  const { data, error } = await supabase.from('lists').upsert(input).select('*').single();
  fail(error);
  return data as List;
}

export async function deleteList(id: string): Promise<void> {
  const { error } = await supabase.from('lists').delete().eq('id', id);
  fail(error);
}

/** Insert the new item set first, then delete whatever else the list held, so a failed insert never empties the list. */
export async function replaceListItems(listId: string, items: Pick<ListItem, 'species_code' | 'sighting_id' | 'note'>[]): Promise<void> {
  let keep: string[] = [];
  if (items.length) {
    const { data, error } = await supabase
      .from('list_items')
      .insert(items.map((it, position) => ({ ...it, list_id: listId, position: position + 100000 }))) // above any old position
      .select('id');
    fail(error);
    keep = (data ?? []).map((r: { id: string }) => r.id);
  }
  let del = supabase.from('list_items').delete().eq('list_id', listId);
  if (keep.length) del = del.not('id', 'in', `(${keep.join(',')})`);
  const { error: e2 } = await del;
  fail(e2);
  // Normalise positions in one request now that the old rows are gone.
  if (keep.length) {
    const { error: e3 } = await supabase.from('list_items').upsert(keep.map((id, position) => ({ id, list_id: listId, position })), { onConflict: 'id' });
    fail(e3);
  }
}

export async function isFollowingList(userId: string, listId: string): Promise<boolean> {
  const { data, error } = await supabase.from('list_follows').select('list_id').match({ user_id: userId, list_id: listId }).maybeSingle();
  fail(error);
  return !!data;
}

export async function setListFollow(userId: string, listId: string, follow: boolean): Promise<void> {
  if (follow) {
    const { error } = await supabase.from('list_follows').upsert({ user_id: userId, list_id: listId }, { onConflict: 'user_id,list_id' });
    fail(error);
  } else {
    const { error } = await supabase.from('list_follows').delete().match({ user_id: userId, list_id: listId });
    fail(error);
  }
}

export async function fetchSightingsByIds(ids: string[]): Promise<Map<string, PublicSighting>> {
  if (!ids.length) return new Map();
  const { data, error } = await supabase.from('public_sightings').select('*').in('id', ids);
  fail(error);
  return new Map(((data ?? []) as PublicSighting[]).map((s) => [s.id, s]));
}

// ---------------------------------------------------------------- moderation
export async function blockUser(userId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from('blocks').upsert({ blocker_id: userId, blocked_id: blockedId }, { onConflict: 'blocker_id,blocked_id' });
  fail(error);
  profileCache.delete(blockedId);
}
export async function unblockUser(userId: string, blockedId: string): Promise<void> {
  const { error } = await supabase.from('blocks').delete().match({ blocker_id: userId, blocked_id: blockedId });
  fail(error);
}
export async function isBlocked(userId: string, otherId: string): Promise<boolean> {
  const { data, error } = await supabase.from('blocks').select('blocked_id').match({ blocker_id: userId, blocked_id: otherId }).maybeSingle();
  fail(error);
  return !!data;
}
export type ReportTarget = 'sighting' | 'list' | 'comment' | 'profile';
export async function report(userId: string, type: ReportTarget, id: string, reason: string): Promise<void> {
  const { error } = await supabase.from('reports').insert({ reporter_id: userId, target_type: type, target_id: id, reason });
  fail(error);
}
/** Deletes the account server-side (auth user, rows, photos). Caller signs out afterwards. */
export async function deleteAccount(userId: string): Promise<void> {
  for (const bucket of ['sighting-photos', 'avatars']) {
    const { data } = await supabase.storage.from(bucket).list(userId, { limit: 1000 });
    const names = (data ?? []).map((o) => `${userId}/${o.name}`);
    if (names.length) await supabase.storage.from(bucket).remove(names);
  }
  const { error } = await supabase.rpc('delete_account');
  fail(error);
}

// ---------------------------------------------------------------- follow requests
export async function fetchFollowRequests(userId: string): Promise<PublicProfile[]> {
  const { data, error } = await supabase.from('follows').select('follower_id').eq('followee_id', userId).eq('status', 'pending');
  fail(error);
  return [...(await fetchProfiles((data ?? []).map((r: { follower_id: string }) => r.follower_id))).values()];
}
export async function answerFollowRequest(userId: string, followerId: string, accept: boolean): Promise<void> {
  const q = accept
    ? supabase.from('follows').update({ status: 'accepted' }).match({ follower_id: followerId, followee_id: userId })
    : supabase.from('follows').delete().match({ follower_id: followerId, followee_id: userId });
  const { error } = await q;
  fail(error);
}
export async function removeFollower(userId: string, followerId: string): Promise<void> {
  const { error } = await supabase.from('follows').delete().match({ follower_id: followerId, followee_id: userId });
  fail(error);
}
