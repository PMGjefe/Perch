import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Switch, View } from 'react-native';

import { LocationField } from '@/components/LocationField';
import { Avatar, BottomInset, Button, Input, Row, Screen, Text } from '@/components/ui';
import { useAuth, useUserId } from '@/lib/auth';
import type { LatLng } from '@/lib/geo';
import { PHOTO_BUCKET, photoUrl, supabase } from '@/lib/supabase';
import { radius, spacing, useTheme } from '@/lib/theme';

const USERNAME = /^[a-z0-9_]{3,24}$/;

export default function Settings() {
  const userId = useUserId();
  const { profile, updateProfile } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatar, setAvatar] = useState<string | null>(profile?.avatar_url ?? null);
  const [home, setHome] = useState<LatLng | null>(profile?.home_lat != null && profile.home_lng != null ? { lat: profile.home_lat, lng: profile.home_lng } : null);
  const [hideHome, setHideHome] = useState(profile?.hide_home ?? true);
  const [saving, setSaving] = useState(false);

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const path = `${userId}/avatar-${Date.now()}.jpg`;
    const bytes = await new File(res.assets[0].uri).arrayBuffer();
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
    if (error) return Alert.alert('Upload failed', error.message);
    setAvatar(photoUrl(path));
  };

  const save = async () => {
    if (!USERNAME.test(username)) return Alert.alert('Username', 'Use 3–24 lowercase letters, numbers or underscores.');
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
      });
      router.back();
    } catch (e) {
      Alert.alert('Could not save', /username/i.test(String(e)) ? 'That username is taken.' : e instanceof Error ? e.message : String(e));
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
          <Text variant="caption" style={{ color: colors.accent, fontWeight: '600' }}>
            Change photo
          </Text>
        </Pressable>
        <Input label="Display name" value={displayName} onChangeText={setDisplayName} maxLength={60} />
        <Input label="Username" value={username} onChangeText={(t) => setUsername(t.toLowerCase())} autoCapitalize="none" autoCorrect={false} />
        <Input label="Bio" value={bio} onChangeText={setBio} multiline maxLength={300} placeholder="Where you bird, what you chase" style={{ minHeight: 70, textAlignVertical: 'top' }} />

        <View style={{ gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border }}>
          <Text variant="heading">Home privacy</Text>
          <Text muted>
            Set your home and Perch blurs every pin within 500 m of it. Other people see a circle roughly a kilometre wide instead of the exact spot, and the place name is dropped. You always see your own exact pins.
          </Text>
          <LocationField label="Home" value={home} placeName="" onChange={setHome} onPlaceNameChange={() => {}} status="No home set" hidePlaceName />
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text variant="label">Hide sightings near home</Text>
              <Text variant="caption" muted>
                Applies to public and followers-only sightings.
              </Text>
            </View>
            <Switch value={hideHome} onValueChange={setHideHome} trackColor={{ true: colors.accent }} disabled={!home} />
          </Row>
          <Text variant="caption" faint>
            For a nest, roost or rarity anywhere, mark the individual sighting as sensitive instead. That hides its pin from everyone.
          </Text>
        </View>

        <Button title="Save" onPress={save} loading={saving} />
        <BottomInset />
      </Screen>
    </KeyboardAvoidingView>
  );
}
