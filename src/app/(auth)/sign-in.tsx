import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import type { TextInput } from 'react-native';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthProviders } from '@/components/AuthProviders';
import { Button, Input, Screen, Text } from '@/components/ui';
import { friendlyAuthError, useAuth } from '@/lib/auth';
import { fonts, spacing, useTheme } from '@/lib/theme';

export default function SignIn() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signInWithPassword } = useAuth();
  // Arriving from sign-up: the address is prefilled and the email form is already open.
  const { email: emailParam } = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(emailParam ?? '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [useEmail, setUseEmail] = useState(!!emailParam);
  const passwordRef = useRef<TextInput>(null);

  const submit = async () => {
    if (!email || !password) return;
    setBusy(true);
    try {
      await signInWithPassword(email, password);
    } catch (e) {
      Alert.alert('Sign-in failed', friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll style={{ paddingTop: insets.top + spacing.xxl, gap: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={{ alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg }}>
          <Ionicons name="leaf" size={40} color={colors.accent} />
          <Text variant="display" style={{ fontSize: 56, lineHeight: 60 }}>
            Perch
          </Text>
          <Text style={{ fontFamily: fonts.displayItalic, fontSize: 19, color: colors.textMuted, textAlign: 'center' }}>Your sightings, your life list, your people.</Text>
        </View>
        <AuthProviders lead />
        {emailParam ? (
          <Text variant="caption" muted style={{ textAlign: 'center' }}>
            Confirm the link we sent, then sign in.
          </Text>
        ) : null}
        {useEmail ? (
          <View style={{ gap: spacing.md }}>
            <Input label="Email" value={email} onChangeText={setEmail} autoFocus={!emailParam} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} blurOnSubmit={false} />
            <Input ref={passwordRef} label="Password" value={password} onChangeText={setPassword} autoFocus={!!emailParam} secureTextEntry autoComplete="password" textContentType="password" returnKeyType="go" onSubmitEditing={submit} />
            <Button title="Sign in" onPress={submit} loading={busy} disabled={!email || !password} />
            <Link href="/(auth)/forgot-password" asChild>
              <Text variant="caption" muted style={{ textAlign: 'center', paddingVertical: spacing.sm }}>
                Forgot your password?
              </Text>
            </Link>
          </View>
        ) : (
          <Button title="Sign in with email" kind="secondary" icon="mail-outline" onPress={() => setUseEmail(true)} />
        )}
        <Link href="/(auth)/sign-up" asChild>
          <Text style={{ textAlign: 'center', color: colors.accent, fontFamily: fonts.semibold, paddingVertical: spacing.md }}>New here? Create an account</Text>
        </Link>
      </Screen>
    </KeyboardAvoidingView>
  );
}
