import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import React, { forwardRef, useState } from 'react';
import {
  ActivityIndicator, Platform, Pressable, Switch as RNSwitch, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputInstance, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n } from '../i18n';
import { publicUrl } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { font, motion, radius, space, type } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

/** The focus ring is drawn by the field border; remove the browser outline on web. */
export const webNoOutline = (Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) as TextStyle;

export const haptic = {
  light: () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); },
  medium: () => { if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); },
  success: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {}); },
  error: () => { if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {}); },
};

// ── Text ───────────────────────────────────────────────────────────────
type Variant = keyof typeof type;
export function T({ v = 'body', color, muted, faint, center, style, ...p }: TextProps & { v?: Variant; color?: string; muted?: boolean; faint?: boolean; center?: boolean }) {
  const { c } = useTheme();
  return (
    <Text
      {...p}
      maxFontSizeMultiplier={1.4}
      style={[type[v], { color: color ?? (muted ? c.textMuted : faint ? c.textFaint : c.text), textAlign: center ? 'center' : 'auto', writingDirection: 'auto' }, style]}
    />
  );
}

// ── Pressable with spring scale ────────────────────────────────────────
const APressable = Animated.createAnimatedComponent(Pressable);
export const Press = forwardRef<View, PressableProps & { scale?: number; style?: StyleProp<ViewStyle> }>(function Press({ scale = 0.97, style, onPressIn, onPressOut, ...p }, ref) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      ref={ref as never}
      {...p}
      onPressIn={(e) => { s.set(withSpring(scale, motion.spring)); onPressIn?.(e); }}
      onPressOut={(e) => { s.set(withSpring(1, motion.spring)); onPressOut?.(e); }}
      style={[style, a]}
    />
  );
});

// ── Buttons ────────────────────────────────────────────────────────────
type BtnKind = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
export function Button({ title, onPress, kind = 'primary', icon, loading, disabled, style, small, testID }: {
  title: string; onPress?: () => void; kind?: BtnKind; icon?: IconName; loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; small?: boolean; testID?: string;
}) {
  const { c } = useTheme();
  const bg = { primary: c.primary, accent: c.accent, secondary: c.surface, ghost: 'transparent', danger: c.dangerSoft }[kind];
  const fg = { primary: c.onPrimary, accent: c.onAccent, secondary: c.text, ghost: c.primary, danger: c.danger }[kind];
  const off = disabled || loading;
  return (
    <Press
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      accessibilityLabel={title}
      disabled={off}
      onPress={() => { haptic.light(); onPress?.(); }}
      style={[{
        height: small ? 40 : 52, borderRadius: radius.md, backgroundColor: bg, opacity: off && !loading ? 0.45 : 1,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: small ? space.lg : space.xl,
        borderWidth: kind === 'secondary' ? 1 : 0, borderColor: c.line,
      }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Icon name={icon} size={small ? 18 : 20} color={fg} />}
          <Text style={{ fontFamily: font.semibold, fontSize: small ? 14 : 16, color: fg }}>{title}</Text>
        </>
      )}
    </Press>
  );
}

export function IconButton({ name, onPress, label, size = 22, badge, tone, style, testID }: {
  name: IconName; onPress?: () => void; label: string; size?: number; badge?: number; tone?: 'surface' | 'plain' | 'overlay'; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const { c } = useTheme();
  const bg = tone === 'surface' ? c.primarySoft : tone === 'overlay' ? 'rgba(255,255,255,0.92)' : 'transparent';
  const fg = tone === 'overlay' ? '#111111' : c.text;
  return (
    <Press testID={testID} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={() => { haptic.light(); onPress?.(); }}
      style={[{ width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }, style]}>
      <Icon name={name} size={size} color={fg} />
      {!!badge && badge > 0 && (
        <View style={{ position: 'absolute', top: 4, end: 2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: c.bg }}>
          <Text style={{ fontFamily: font.bold, fontSize: 10, color: '#FFFFFF' }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </Press>
  );
}

// ── Inputs ─────────────────────────────────────────────────────────────
export const Input = forwardRef<TextInputInstance, TextInputProps & { label?: string; error?: string | null; hint?: string; icon?: IconName; right?: React.ReactNode; containerStyle?: StyleProp<ViewStyle> }>(
  function Input({ label, error, hint, icon, right, containerStyle, style, onFocus, onBlur, multiline, ...p }, ref) {
    const { c } = useTheme();
    const { isRTL } = useI18n();
    const [focus, setFocus] = useState(false);
    return (
      <View style={[{ gap: 6 }, containerStyle]}>
        {label && <T v="small" style={{ fontFamily: font.medium }} muted>{label}</T>}
        <View style={{
          flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: space.sm, backgroundColor: c.card,
          borderRadius: radius.md, borderWidth: 1.5, borderColor: error ? c.danger : focus ? c.primary : c.line,
          paddingHorizontal: space.lg, minHeight: multiline ? 120 : 52, paddingVertical: multiline ? space.md : 0,
        }}>
          {icon && <Icon name={icon} size={20} color={c.textMuted} />}
          <TextInput
            ref={ref}
            placeholderTextColor={c.textFaint}
            selectionColor={c.primary}
            multiline={multiline}
            {...p}
            onFocus={(e) => { setFocus(true); onFocus?.(e); }}
            onBlur={(e) => { setFocus(false); onBlur?.(e); }}
            style={[{ flex: 1, fontFamily: font.regular, fontSize: 16, color: c.text, textAlign: isRTL ? 'right' : 'left', paddingVertical: Platform.OS === 'ios' ? 14 : 10, textAlignVertical: multiline ? 'top' : 'center' } as TextStyle, webNoOutline, style]}
          />
          {right}
        </View>
        {error ? <T v="small" color={c.danger}>{error}</T> : hint ? <T v="small" faint>{hint}</T> : null}
      </View>
    );
  },
);

// ── Chips / segmented ──────────────────────────────────────────────────
export function Chip({ label, active, onPress, icon, testID }: { label: string; active?: boolean; onPress?: () => void; icon?: IconName; testID?: string }) {
  const { c } = useTheme();
  return (
    <Press testID={testID} onPress={() => { haptic.light(); onPress?.(); }} accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: radius.pill,
        backgroundColor: active ? c.primary : c.bg, borderWidth: 1, borderColor: active ? c.primary : c.lineStrong }}>
      {icon && <Icon name={icon} size={16} color={active ? c.onPrimary : c.text} />}
      <Text style={{ fontFamily: font.medium, fontSize: 14, color: active ? c.onPrimary : c.text }}>{label}</Text>
    </Press>
  );
}

export function Segmented<V extends string>({ value, options, onChange }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.surface, borderRadius: radius.md, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { haptic.light(); onChange(o.value); }}
            style={{ flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.card : 'transparent',
              borderWidth: on ? 1 : 0, borderColor: c.line }}>
            <Text numberOfLines={1} style={{ fontFamily: on ? font.semibold : font.regular, fontSize: 14, color: on ? c.text : c.textMuted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Switch({ value, onValueChange, label, hint, testID }: { value: boolean; onValueChange: (v: boolean) => void; label: string; hint?: string; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={() => onValueChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md, gap: space.md }}>
      <View style={{ flex: 1 }}>
        <T v="bodyStrong">{label}</T>
        {hint && <T v="small" muted>{hint}</T>}
      </View>
      <RNSwitch testID={testID} value={value} onValueChange={(v) => { haptic.light(); onValueChange(v); }}
        trackColor={{ true: c.primary, false: c.lineStrong }} thumbColor="#FFFFFF" ios_backgroundColor={c.lineStrong} />
    </Pressable>
  );
}

// ── Rows, sections ─────────────────────────────────────────────────────
export function Row({ icon, label, value, onPress, danger, badge, testID }: { icon?: IconName; label: string; value?: string; onPress?: () => void; danger?: boolean; badge?: number; testID?: string }) {
  const { c } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 14, paddingHorizontal: space.lg, backgroundColor: pressed ? c.surface : 'transparent' })}>
      {icon && (
        <View style={{ width: 38, height: 38, borderRadius: radius.sm, backgroundColor: danger ? c.dangerSoft : c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={20} color={danger ? c.danger : c.primary} />
        </View>
      )}
      <T v="bodyStrong" style={{ flex: 1 }} color={danger ? c.danger : undefined}>{label}</T>
      {!!badge && <View style={{ minWidth: 22, height: 22, borderRadius: 11, backgroundColor: c.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}><Text style={{ fontFamily: font.bold, fontSize: 11, color: '#FFFFFF' }}>{badge}</Text></View>}
      {value && <T v="small" muted>{value}</T>}
      {onPress && <Icon name="forward" size={18} color={c.textFaint} />}
    </Pressable>
  );
}

export function Section({ title, action, onAction, children, style }: { title?: string; action?: string; onAction?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return (
    <View style={[{ gap: space.md }, style]}>
      {title && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, gap: space.sm }}>
          <T v="h3" style={{ flex: 1 }} color={c.primary}>{title}</T>
          {action && <Pressable hitSlop={10} onPress={onAction} accessibilityRole="button"><T v="small" color={c.primaryBright} style={{ fontFamily: font.semibold }}>{action}</T></Pressable>}
        </View>
      )}
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, overflow: 'hidden' }, style]}>{children}</View>;
}

// ── Header ─────────────────────────────────────────────────────────────
export function Header({ title, right, back = true, transparent, onBack, large }: { title?: string; right?: React.ReactNode; back?: boolean; transparent?: boolean; onBack?: () => void; large?: boolean }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: insets.top + 4, paddingHorizontal: space.sm, backgroundColor: transparent ? 'transparent' : c.card, borderBottomWidth: transparent || large ? 0 : 1, borderBottomColor: c.line }}>
      <View style={{ height: 52, flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        {back && <IconButton name="back" label={t('common.back')} onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} testID="header-back" />}
        {!large && <T v="h3" numberOfLines={1} style={{ flex: 1, textAlign: back ? 'auto' : 'center', marginHorizontal: back ? 0 : space.lg }}>{title}</T>}
        {large && <View style={{ flex: 1 }} />}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>{right}</View>
      </View>
      {large && title && <T v="h1" style={{ paddingHorizontal: space.sm, paddingBottom: space.md }}>{title}</T>}
    </View>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────
export function Avatar({ path, name, size = 44 }: { path?: string | null; name?: string; size?: number }) {
  const { c } = useTheme();
  const url = publicUrl('avatars', path);
  const initial = (name ?? '?').trim().charAt(0);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      {url ? <Image source={{ uri: url }} style={{ width: size, height: size }} contentFit="cover" transition={150} cachePolicy="memory-disk" />
        : <Text style={{ fontFamily: font.bold, fontSize: size * 0.42, color: c.primary }}>{initial}</Text>}
    </View>
  );
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'primary' }) {
  const { c } = useTheme();
  const map = {
    neutral: [c.surface, c.textMuted], accent: [c.accent, c.onAccent], success: [c.successSoft, c.success],
    danger: [c.dangerSoft, c.danger], primary: [c.primarySoft, c.primary],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.socket, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ fontFamily: font.semibold, fontSize: 11, color: fg }}>{label}</Text>
    </View>
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: 1, backgroundColor: c.line, marginHorizontal: space.lg }} />;
}
