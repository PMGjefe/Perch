import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React, { useState } from 'react';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

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
        <View style={{ gap: spacing.md }}>
          <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" />
          <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" textContentType="password" onSubmitEditing={submit} />
          <Button title="Sign in" onPress={submit} loading={busy} disabled={!email || !password} />
        </View>
        <AuthProviders />
        <Link href="/(auth)/sign-up" asChild>
          <Text style={{ textAlign: 'center', color: colors.accent, fontFamily: fonts.semibold }}>New here? Create an account</Text>
        </Link>
      </Screen>
    </KeyboardAvoidingView>
  );
}
