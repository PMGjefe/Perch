import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';

import { LocationField } from '@/components/LocationField';
import { Avatar, BottomInset, Button, Input, Screen, SwitchRow, Text } from '@/components/ui';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useSyncState } from '@/components/SyncProvider';
import { deleteAccount } from '@/lib/social';
import { backOr } from '@/lib/nav';
import { useAuth, useUserId } from '@/lib/auth';
import { friendlyError } from '@/lib/errors';
import type { LatLng } from '@/lib/geo';
import { haptic } from '@/lib/haptics';
import { AVATAR_BUCKET, avatarPublicUrl, supabase } from '@/lib/supabase';
import { fonts, radius, spacing, useTheme } from '@/lib/theme';
import { USERNAME } from '@/lib/validation';

const LEGAL = (Constants.expoConfig?.extra?.legal as { privacy: string; terms: string } | undefined) ?? { privacy: 'https://example.com/privacy', terms: 'https://example.com/terms' };

// What to call this thing in copy: "only on this iPhone" reads better than "on this device".
const device = Platform.OS === 'ios' ? (Platform.isPad ? 'iPad' : 'iPhone') : 'phone';

export default function Settings() {
  const userId = useUserId();
  const router = useRouter();
  const { profile, updateProfile, signOut } = useAuth();
  const { pending } = useSyncState();
  const { colors } = useTheme();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null);
  const [home, setHome] = useState<LatLng | null>(profile?.home_lat != null && profile.home_lng != null ? { lat: profile.home_lat, lng: profile.home_lng } : null);
  const [hideHome, setHideHome] = useState(profile?.hide_home ?? true);
  const [approveFollowers, setApproveFollowers] = useState(profile?.approve_followers ?? false);
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Photos', 'Allow photo library access in Settings to choose a profile picture.');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const path = `${userId}/avatar-${Date.now()}.jpg`;
    const bytes = await new File(res.assets[0].uri).arrayBuffer();
    const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
    if (error) {
      haptic.warning();
      return Alert.alert('Could not upload', friendlyError(error, 'Could not upload that photo.'));
    }
    setAvatar(avatarPublicUrl(path));
  };

  const confirmSignOut = () =>
    pending > 0
      ? Alert.alert(
          'Some sightings have not backed up yet',
          `${pending} sighting${pending === 1 ? '' : 's'} ${pending === 1 ? 'is' : 'are'} only on this ${device}. Connect to the internet and give it a minute, or sign out and keep ${pending === 1 ? 'it' : 'them'} here for next time.`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out, keep them here', onPress: () => signOut({ keepLocal: true }) },
            { text: 'Sign out and erase', style: 'destructive', onPress: () => signOut() },
          ],
        )
      : Alert.alert('Sign out?', 'Your birds are safe in your account.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
        ]);

  const confirmDelete = () =>
    Alert.alert('Delete your account?', 'Everything you have logged will be gone. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete everything',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAccount(userId);
            await signOut();
          } catch (e) {
            haptic.warning();
            Alert.alert('Could not delete', friendlyError(e, 'Could not delete your account.'));
          }
        },
      },
    ]);

  const save = async () => {
    if (!USERNAME.test(username)) {
      haptic.warning();
      return Alert.alert('Username', 'Use 3–24 lowercase letters, numbers or underscores.');
    }
    setSaving(true);
    try {
      await updateProfile({
        display_name: displayName.trim(),
        username: username.trim(),
        bio: bio.trim(),
        avatar_url: avatar,
        home_lat: home?.lat ?? null,
        home_lng: home?.lng ?? null,
        hide_home: hideHome,
        approve_followers: approveFollowers,
      });
      backOr('/(tabs)/me');
    } catch (e) {
      haptic.warning();
      Alert.alert('Could not save', friendlyError(e, 'Could not save your profile.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: 'Profile & privacy' }} />
      <Screen scroll style={{ gap: spacing.xl }}>
        <Pressable onPress={pickAvatar} style={{ alignItems: 'center', gap: spacing.sm }}>
          <Avatar uri={avatar} name={displayName || username} size={88} />
          <Text variant="caption" style={{ color: colors.accent, fontFamily: fonts.semibold }}>
            Change photo
          </Text>
        </Pressable>
        <Input label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={60} />
        <Input label="Username" value={username} onChangeText={(t) => setUsername(t.toLowerCase())} autoCapitalize="none" autoCorrect={false} />
        <Input label="Bio" value={bio} onChangeText={setBio} multiline maxLength={300} placeholder="Where you bird, what you chase" style={{ minHeight: 70, textAlignVertical: 'top' }} />

        <View style={{ gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
          <Text variant="heading">Home privacy</Text>
          <Text muted>Set your home and other people see sightings near it as a rough circle, never the exact spot. You always see your own exact pins.</Text>
          <LocationField label="Home" value={home} placeName="" onChange={setHome} onPlaceNameChange={() => {}} status="No home set" hidePlaceName />
          <SwitchRow label="Hide sightings near home" caption="Applies to public and followers-only sightings." value={hideHome} onValueChange={setHideHome} disabled={!home} />
          <Text variant="caption" faint>
            For a nest, roost or rarity anywhere, mark the individual sighting as sensitive instead. That hides its pin from everyone.
          </Text>
        </View>

        <SwitchRow label="Approve followers" caption="New followers wait for your OK before they can see followers-only sightings." value={approveFollowers} onValueChange={setApproveFollowers} />

        <Button title="Save" onPress={save} loading={saving} />

        <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
          <Button title="Import sightings from eBird or a CSV file" kind="secondary" icon="download-outline" onPress={() => router.push('/settings/import')} />
          <Button title="Sign out" kind="ghost" onPress={confirmSignOut} />
          <Button title="Privacy policy" kind="ghost" onPress={() => WebBrowser.openBrowserAsync(LEGAL.privacy)} />
          <Button title="Terms of use" kind="ghost" onPress={() => WebBrowser.openBrowserAsync(LEGAL.terms)} />
          <Button title="Delete account" kind="ghost" onPress={confirmDelete} style={{ marginTop: spacing.lg }} />
          <Text variant="caption" faint style={{ textAlign: 'center' }}>
            Deleting removes your sightings, lists, photos and comments permanently.
          </Text>
        </View>
        <BottomInset />
      </Screen>
    </KeyboardAvoidingView>
  );
}
