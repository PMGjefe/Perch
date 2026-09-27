import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  View,
  type ViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useTheme } from '@/lib/theme';

type Variant = 'title' | 'heading' | 'subheading' | 'body' | 'label' | 'caption';

const variants: Record<Variant, TextStyle> = {
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  subheading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 13 },
};

export function Text({
  variant = 'body',
  muted,
  faint,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean; faint?: boolean }) {
  const { colors } = useTheme();
  const color = faint ? colors.textFaint : muted ? colors.textMuted : colors.text;
  return <RNText {...rest} style={[variants[variant], { color }, style]} />;
}

export function Screen({
  children,
  scroll,
  padded = true,
  style,
  ...rest
}: ViewProps & { scroll?: boolean; padded?: boolean }) {
  const { colors } = useTheme();
  const base = [{ flex: 1, backgroundColor: colors.bg }, style];
  if (scroll) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={[padded && { padding: spacing.lg }, style]}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <View {...rest} style={[base, padded && { padding: spacing.lg }]}>
      {children}
    </View>
  );
}

export function Card({ children, style, ...rest }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      {...rest}
      style={[
        { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  title,
  kind = 'primary',
  loading,
  icon,
  style,
  disabled,
  ...rest
}: PressableProps & { title: string; kind?: 'primary' | 'secondary' | 'ghost' | 'danger'; loading?: boolean; icon?: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useTheme();
  const bg = kind === 'primary' ? colors.accent : kind === 'danger' ? colors.danger : kind === 'secondary' ? colors.surfaceAlt : 'transparent';
  const fg = kind === 'primary' || kind === 'danger' ? colors.onAccent : kind === 'ghost' ? colors.accent : colors.text;
  return (
    <Pressable
      {...rest}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          paddingVertical: 13,
          paddingHorizontal: spacing.xl,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
        typeof style === 'function' ? undefined : style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={18} color={fg} /> : null}
      <RNText style={{ color: fg, fontSize: 16, fontWeight: '600' }}>{title}</RNText>
    </Pressable>
  );
}

export function IconButton({ name, color, size = 22, style, ...rest }: PressableProps & { name: keyof typeof Ionicons.glyphMap; color?: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <Pressable
      hitSlop={8}
      {...rest}
      style={({ pressed }) => [{ padding: spacing.sm, opacity: pressed ? 0.6 : 1 }, typeof style === 'function' ? undefined : style]}
    >
      <Ionicons name={name} size={size} color={color ?? colors.text} />
    </Pressable>
  );
}

export function Input({ style, label, ...rest }: TextInputProps & { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text variant="label" muted>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...rest}
        style={[
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: 12,
            fontSize: 16,
            color: colors.text,
          },
          style,
        ]}
      />
    </View>
  );
}

export function Row({ children, style, gap = spacing.sm, ...rest }: ViewProps & { gap?: number }) {
  return (
    <View {...rest} style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>
      {children}
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        backgroundColor: active ? colors.accent : colors.surfaceAlt,
        opacity: pressed ? 0.7 : 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      })}
    >
      {icon ? <Ionicons name={icon} size={14} color={active ? colors.onAccent : colors.textMuted} /> : null}
      <RNText style={{ color: active ? colors.onAccent : colors.text, fontWeight: '600', fontSize: 14 }}>{label}</RNText>
    </Pressable>
  );
}

export function Avatar({ uri, name, size = 40 }: { uri?: string | null; name?: string; size?: number }) {
  const { colors } = useTheme();
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?';
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceAlt }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <RNText style={{ color: colors.accent, fontWeight: '700', fontSize: size * 0.42 }}>{initial}</RNText>
    </View>
  );
}

export function Empty({ icon = 'leaf-outline', title, body, action }: { icon?: keyof typeof Ionicons.glyphMap; title: string; body?: string; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: spacing.xxl, gap: spacing.md }}>
      <Ionicons name={icon} size={40} color={colors.textFaint} />
      <Text variant="subheading" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {body ? (
        <Text muted style={{ textAlign: 'center' }}>
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

export function BottomInset() {
  const insets = useSafeAreaInsets();
  return <View style={{ height: insets.bottom + spacing.xl }} />;
}

export function Section({ title, right, children }: { title: string; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="heading">{title}</Text>
        {right}
      </Row>
      {children}
    </View>
  );
}

/** Label on the left, number on the right. */
export function StatRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Text muted={!strong}>{label}</Text>
      <Text variant={strong ? 'heading' : 'body'}>{value}</Text>
    </Row>
  );
}
