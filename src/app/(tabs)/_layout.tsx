import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { fonts, useTheme } from '@/lib/theme';

export default function TabsLayout() {
  const { colors, dark } = useTheme();
  const glass = Platform.OS === 'ios';
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleStyle: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.3 },
        headerTitleAlign: 'left',
        tabBarStyle: glass
          ? { position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 }
          : { backgroundColor: colors.tabBar, borderTopColor: colors.border },
        tabBarBackground: glass ? () => <BlurView tint={dark ? 'dark' : 'light'} intensity={70} style={StyleSheet.absoluteFill} /> : undefined,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.semibold },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="diary" options={{ title: 'Diary', tabBarIcon: ({ color, size }) => <Ionicons name="book-outline" size={size} color={color} /> }} />
      <Tabs.Screen
        name="log"
        options={{
          title: 'Log',
          headerShown: false,
          tabBarLabel: () => null,
          tabBarIcon: () => (
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: -22,
                shadowColor: colors.accent,
                shadowOpacity: 0.45,
                shadowRadius: 14,
                shadowOffset: { width: 0, height: 6 },
                elevation: 8,
              }}
            >
              <Ionicons name="add" size={34} color={colors.onAccent} />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="life" options={{ title: 'Life list', tabBarIcon: ({ color, size }) => <Ionicons name="list-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="me" options={{ title: 'Me', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
    </Tabs>
  );
}
