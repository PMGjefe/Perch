import * as AppleAuthentication from 'expo-apple-authentication';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { friendlyAuthError, useAuth } from '@/lib/auth';
import { spacing, useTheme } from '@/lib/theme';

/** Apple + Google buttons, shared by sign-in and sign-up. */
export function AuthProviders({ lead = false }: { lead?: boolean }) {
  const { dark } = useTheme();
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const run = async (which: 'apple' | 'google', fn: () => Promise<void>) => {
    setBusy(which);
    try {
      await fn();
    } catch (e) {
      const msg = friendlyAuthError(e);
      if (msg) Alert.alert('Sign-in failed', msg);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      {lead ? null : (
        <Text variant="caption" muted style={{ textAlign: 'center' }}>
          or continue with
        </Text>
      )}
      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={dark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={999}
          style={{ height: 48 }}
          onPress={() => run('apple', signInWithApple)}
        />
      ) : null}
      <Button title="Continue with Google" kind="secondary" icon="logo-google" loading={busy === 'google'} onPress={() => run('google', signInWithGoogle)} />
    </View>
  );
}
