import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Input, Screen, Text } from '@/components/ui';
import { friendlyAuthError, useAuth } from '@/lib/auth';
import { spacing } from '@/lib/theme';

export default function ForgotPassword() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await resetPassword(email);
      Alert.alert('Check your email', 'If an account exists for that address, a reset link is on its way.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('Could not send', friendlyAuthError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Screen scroll style={{ paddingTop: insets.top + spacing.xxl, gap: spacing.xl }}>
        <View style={{ gap: spacing.xs }}>
          <Text variant="title">Reset password</Text>
          <Text muted>We will email you a link to choose a new one.</Text>
        </View>
        <Input label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" returnKeyType="send" onSubmitEditing={submit} />
        <Button title="Send reset link" onPress={submit} loading={busy} disabled={!email.includes('@')} />
        <Button title="Back" kind="ghost" onPress={() => router.back()} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
