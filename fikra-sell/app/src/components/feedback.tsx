import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, {
  Easing, FadeInDown, FadeOutDown, interpolate, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useI18n, type TKey } from '../i18n';
import { toAppError } from '../lib/errors';
import { useTheme } from '../theme/ThemeProvider';
import { font, radius, space } from '../theme/tokens';
import { Icon } from './Icon';
import { Button, T } from './ui';

// ── Skeleton shimmer ─────────────────────────────────────
export function Skeleton({ w = '100%', h = 16, r = radius.sm, style }: { w?: DimensionValue; h?: DimensionValue; r?: number; style?: ViewStyle }) {
  const { c } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => { p.set(withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true)); }, [p]);
  const a = useAnimatedStyle(() => ({ opacity: interpolate(p.value, [0, 1], [0.55, 1]) }));
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: c.skeleton }, a, style]} />;
}

export function AdCardSkeleton({ list }: { list?: boolean }) {
  if (list) {
    return (
      <View style={{ flexDirection: 'row', gap: space.md, padding: space.md }}>
        <Skeleton w={112} h={112} r={radius.lg} />
        <View style={{ flex: 1, gap: 10, paddingTop: 6 }}><Skeleton w="85%" /><Skeleton w="50%" /><Skeleton w="35%" h={22} /></View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, gap: 10 }}>
      <Skeleton h={150} r={radius.md} />
      <Skeleton w="85%" /><Skeleton w="45%" h={20} />
    </View>
  );
}

// ── Loader ───────────────────────────────────────────────────────────
export function BulbLoader({ size = 44, label }: { size?: number; label?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: space.md, padding: space.xl }} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator size={size > 36 ? 'large' : 'small'} color={c.primary} />
      {label && <T v="small" muted>{label}</T>}
    </View>
  );
}

// ── Empty / error states ───────────────────────────────────────────────
export function EmptyState({ title, body, action, onAction, icon, lit = false }: { title: string; body?: string; action?: string; onAction?: () => void; icon?: string; lit?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: space.xxxl, paddingVertical: space.huge, gap: space.md }}>
      <View style={{ width: 112, height: 112, borderRadius: 56, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm }}>
        <Icon name={icon ?? (lit ? 'search' : 'list')} size={46} color={c.primary} />
      </View>
      <T v="h3" center>{title}</T>
      {body && <T v="body" muted center>{body}</T>}
      {action && <Button title={action} onPress={onAction} small style={{ marginTop: space.sm, minWidth: 160 }} />}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  const e = toAppError(error);
  const offline = e.key === 'errors.network';
  return (
    <EmptyState
      icon={offline ? 'wifiOff' : 'help'}
      title={offline ? t('empty.offlineTitle') : t('empty.errorTitle')}
      body={offline ? t('empty.offlineBody') : t(e.key, e.vars)}
      action={onRetry ? t('common.retry') : undefined}
      onAction={onRetry}
    />
  );
}

// ── Toasts ─────────────────────────────────────────────────────────────
type ToastMsg = { id: number; text: string; tone: 'info' | 'success' | 'error' };
type ToastCtx = { show: (text: string, tone?: ToastMsg['tone']) => void; error: (e: unknown) => void; success: (key: TKey, vars?: Record<string, string | number>) => void };
const ToastContext = createContext<ToastCtx>({ show: () => {}, error: () => {}, success: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, tone: ToastMsg['tone'] = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setMsg({ id: Date.now(), text, tone });
    timer.current = setTimeout(() => setMsg(null), 3200);
  }, []);
  const ctx: ToastCtx = {
    show,
    error: (e) => { const a = toAppError(e); show(t(a.key, a.vars), 'error'); },
    success: (key, vars) => show(t(key, vars), 'success'),
  };
  return (
    <ToastContext.Provider value={ctx}>
      {children}
      {msg && (
        <Animated.View key={msg.id} entering={FadeInDown.springify().damping(18)} exiting={FadeOutDown} pointerEvents="box-none"
          style={{ position: 'absolute', start: space.lg, end: space.lg, bottom: insets.bottom + 96, zIndex: 999 }}>
          <Pressable onPress={() => setMsg(null)} accessibilityLiveRegion="polite" accessibilityRole="alert"
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: c.scheme === 'dark' ? '#2A2B32' : c.ink, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: space.lg }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: msg.tone === 'error' ? '#FF6B61' : msg.tone === 'success' ? '#3CC48E' : c.accent }} />
            <Text style={{ flex: 1, color: '#FFFFFF', fontFamily: font.medium, fontSize: 14, lineHeight: 21 }}>{msg.text}</Text>
          </Pressable>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);

// ── Bottom sheet ───────────────────────────────────────────────────────
export function Sheet({ visible, onClose, title, children, footer, scroll = true }: { visible: boolean; onClose: () => void; title?: string; children: React.ReactNode; footer?: React.ReactNode; scroll?: boolean }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} onPress={onClose} accessibilityLabel="close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <View style={{ backgroundColor: c.bg, borderTopLeftRadius: radius.crown, borderTopRightRadius: radius.crown, maxHeight: '88%', paddingBottom: insets.bottom + space.md }}>
          <View style={{ alignItems: 'center', paddingTop: 10 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.lineStrong }} /></View>
          {title && (
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.xl, paddingVertical: space.md }}>
              <T v="h3" style={{ flex: 1 }}>{title}</T>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="close"><Icon name="close" size={22} color={c.textMuted} /></Pressable>
            </View>
          )}
          {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.md }}>{children}</ScrollView>
            : <View style={{ paddingHorizontal: space.xl, flexShrink: 1 }}>{children}</View>}
          {footer && <View style={{ paddingHorizontal: space.xl, paddingTop: space.md }}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Confirm dialog ─────────────────────────────────────────────────────
export function Confirm({ visible, title, body, confirm, danger, onConfirm, onClose, loading }: { visible: boolean; title: string; body?: string; confirm: string; danger?: boolean; onConfirm: () => void; onClose: () => void; loading?: boolean }) {
  const { t } = useI18n();
  return (
    <Sheet visible={visible} onClose={onClose} title={title} scroll={false}
      footer={<View style={{ gap: space.sm }}><Button title={confirm} kind={danger ? 'danger' : 'primary'} onPress={onConfirm} loading={loading} testID="confirm-ok" /><Button title={t('common.cancel')} kind="ghost" onPress={onClose} /></View>}>
      {body && <T muted style={{ paddingBottom: space.sm }}>{body}</T>}
    </Sheet>
  );
}

// ── Offline banner ─────────────────────────────────────────────────────
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false && s.isInternetReachable !== false)), []);
  return online;
}

export function OfflineBanner() {
  const online = useOnline();
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <Animated.View entering={FadeInDown} style={{ position: 'absolute', top: insets.top + 6, start: space.lg, end: space.lg, zIndex: 998, flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: c.ink, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: 14, alignSelf: 'center' }}>
      <Icon name="wifiOff" size={16} color="#FFFFFF" />
      <Text style={{ color: '#FFFFFF', fontFamily: font.medium, fontSize: 12 }}>{t('offline.banner')}</Text>
    </Animated.View>
  );
}
