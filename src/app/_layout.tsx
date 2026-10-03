import { SplashScreen, Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SyncProvider } from '@/components/SyncProvider';
import { WelcomeGate } from '@/components/WelcomeGate';
import { Loading } from '@/components/ui';
import { AuthProvider, useAuth } from '@/lib/auth';
import { useAppFonts } from '@/lib/fonts';
import { fonts, useTheme } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <SyncProvider>
            <Root />
          </SyncProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Root() {
  const { colors, dark } = useTheme();
  const { session, loading } = useAuth();
  const fontsReady = useAppFonts();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!loading && fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [loading, fontsReady]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {});
  }, [colors.bg]);

  // Auth gate: signed-out users only see the (auth) group; signed-in users never do.
  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!session && !inAuth) router.replace('/(auth)/sign-in');
    else if (session && inAuth) router.replace('/(tabs)/diary');
  }, [session, loading, segments, router]);

  if (loading || !fontsReady) return <Loading />;

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontFamily: fonts.semibold, fontSize: 17 },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sighting/[id]" options={{ title: '' }} />
        <Stack.Screen name="sighting/edit/[id]" options={{ title: 'Edit sighting', presentation: 'modal' }} />
        <Stack.Screen name="list/[id]" options={{ title: '' }} />
        <Stack.Screen name="list/edit/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings/index" options={{ title: 'Profile & privacy' }} />
        <Stack.Screen name="settings/import" options={{ title: 'Import' }} />
        <Stack.Screen name="search" options={{ title: 'Find people' }} />
        <Stack.Screen name="user/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="user/[id]/followers" options={{ title: '' }} />
        <Stack.Screen name="species/[code]" options={{ title: '' }} />
        <Stack.Screen name="year/[year]" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="welcome" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
      </Stack>
      <WelcomeGate />
    </>
  );
}
