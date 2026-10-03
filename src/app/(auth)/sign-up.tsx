import { Link } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthProviders } from '@/components/AuthProviders';
import { Button, Input, Screen, Text } from '@/components/ui';
import { friendlyAuthError, useAuth } from '@/lib/auth';
import { fonts, spacing, useTheme } from '@/lib/theme';
import { USERNAME } from '@/lib/validation';

export default function SignUp() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { signUpWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = email.includes('@') && USERNAME.test(username) && password.length >= 8;

  const submit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const { needsConfirmation } = await signUpWithPassword(email, password, username);
      if (needsConfirmation) Alert.alert('Check your email', 'Confirm your address, then sign in.');
    } catch (e) {
      Alert.alert('Sign-up failed', friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll style={{ paddingTop: insets.top + spacing.xxl, gap: spacing.xl, paddingBottom: insets.bottom + spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="title">Create account</Text>
          <Text muted>Perch is not an ID app. Bring your sightings here after you have named the bird.</Text>
        </View>
        <View style={{ gap: spacing.md }}>
          <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" textContentType="emailAddress" />
          <Input label="Username" value={username} onChangeText={(t) => setUsername(t.toLowerCase())} autoCapitalize="none" autoCorrect={false} placeholder="letters, numbers, underscore" />
          <Input label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" placeholder="at least 8 characters" onSubmitEditing={submit} />
          <Button title="Create account" onPress={submit} loading={busy} disabled={!valid} />
        </View>
        <AuthProviders />
        <Text variant="caption" faint style={{ textAlign: 'center' }}>
          By creating an account you agree to the Terms of use and Privacy policy, both in Settings.
        </Text>
        <Link href="/(auth)/sign-in" asChild>
          <Text style={{ textAlign: 'center', color: colors.accent, fontFamily: fonts.semibold }}>Already have an account? Sign in</Text>
        </Link>
      </Screen>
    </KeyboardAvoidingView>
  );
}
