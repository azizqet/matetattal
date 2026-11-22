import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, Platform, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow } from '@/lib/theme';

export type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
export const Icon = ({ name, size = 22, color = colors.primary }: { name: IconName | string; size?: number; color?: string }) => (
  <MaterialCommunityIcons name={name as IconName} size={size} color={color} />
);

type Variant = 'body' | 'small' | 'title' | 'h1' | 'h2' | 'label' | 'muted';
export function Text({ variant = 'body', style, ...p }: TextProps & { variant?: Variant }) {
  return <RNText {...p} style={[t.base, t[variant], style]} />;
}

export function Screen({ children, scroll = true, style, edges = ['top'] }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle>; edges?: ('top' | 'bottom')[] }) {
  return (
    <SafeAreaView edges={edges} style={s.screen}>
      {scroll ? (
        <ScrollView contentContainerStyle={[s.content, style]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
      ) : (
        <View style={[s.content, { flex: 1 }, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type BtnKind = 'primary' | 'soft' | 'whatsapp' | 'danger' | 'ghost';
export function Button({ title, onPress, kind = 'primary', icon, loading, disabled, small, style, testID }: {
  title: string; onPress?: () => void; kind?: BtnKind; icon?: string; loading?: boolean; disabled?: boolean; small?: boolean;
  style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const bg = { primary: colors.primary, soft: colors.primarySoft, whatsapp: colors.whatsapp, danger: '#FDECEA', ghost: 'transparent' }[kind];
  const fg = { primary: colors.white, soft: colors.primary, whatsapp: colors.white, danger: colors.danger, ghost: colors.primary }[kind];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      style={({ pressed }) => [s.btn, small && s.btnSm, { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Icon name={icon} size={small ? 18 : 20} color={fg} /> : null}
          <RNText style={[t.base, s.btnText, small && { fontSize: 13 }, { color: fg }]}>{title}</RNText>
        </>
      )}
    </Pressable>
  );
}

export function Card({ children, style, onPress, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: PressableProps['onPress']; testID?: string }) {
  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [s.card, style, pressed && { transform: [{ scale: 0.99 }], opacity: 0.95 }]}>
        {children}
      </Pressable>
    );
  }
  return <View testID={testID} style={[s.card, style]}>{children}</View>;
}

export function Field({ label, error, style, ...p }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text variant="label">{label}</Text>
      <TextInput
        placeholderTextColor="#98A3B8"
        {...p}
        accessibilityLabel={label}
        style={[s.input, p.multiline && { minHeight: 90, textAlignVertical: 'top' }, error ? { borderColor: colors.danger } : null, style as StyleProp<TextStyle>]}
      />
      {error ? <Text variant="small" style={{ color: colors.danger, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={[s.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      {icon ? <Icon name={icon} size={16} color={active ? colors.white : colors.primary} /> : null}
      <RNText style={[t.base, { fontSize: 13, fontFamily: fonts.medium, color: active ? colors.white : colors.text }]}>{label}</RNText>
    </Pressable>
  );
}

export function Row({ children, style, gap = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Badge({ label, tone = 'blue' }: { label: string; tone?: 'blue' | 'green' | 'yellow' | 'red' | 'gray' }) {
  const m = {
    blue: [colors.primarySoft, colors.primary], green: ['#E7F7EE', '#0F7A40'], yellow: [colors.warningBg, colors.warningText],
    red: ['#FDECEA', colors.danger], gray: ['#EEF1F6', colors.muted],
  }[tone];
  return <View style={[s.badge, { backgroundColor: m[0] }]}><RNText style={[t.base, { fontSize: 12, fontFamily: fonts.bold, color: m[1] }]}>{label}</RNText></View>;
}

export function Empty({ icon = 'magnify', title, subtitle, action }: { icon?: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <View style={s.empty}>
      <View style={s.emptyIcon}><Icon name={icon} size={30} /></View>
      <Text variant="h2" style={{ textAlign: 'center' }}>{title}</Text>
      {subtitle ? <Text variant="muted" style={{ textAlign: 'center', marginTop: 4 }}>{subtitle}</Text> : null}
      {action ? <View style={{ marginTop: 14, alignSelf: 'stretch' }}>{action}</View> : null}
    </View>
  );
}

export function Loading({ label = 'جاري التحميل...' }: { label?: string }) {
  return <View style={s.empty}><ActivityIndicator color={colors.primary} size="large" /><Text variant="muted" style={{ marginTop: 10 }}>{label}</Text></View>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Empty icon="wifi-off" title="ما قدرنا نجيب البيانات" subtitle={message}
      action={onRetry ? <Button title="إعادة المحاولة" icon="refresh" onPress={onRetry} /> : undefined} />
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return <Row style={{ justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }}><Text variant="h2">{title}</Text>{action}</Row>;
}

export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <Row gap={1}>
      {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name={value >= i ? 'star' : value >= i - 0.5 ? 'star-half-full' : 'star-outline'} size={size} color={colors.accent} />)}
    </Row>
  );
}

// ===== Toast بسيط يعمل على كل المنصات =====
const ToastCtx = createContext<(msg: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [op] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(op, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== 'web' }).start();
    timer.current = setTimeout(() => Animated.timing(op, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start(() => setMsg(null)), 3000);
  }, [op]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg ? (
        <Animated.View pointerEvents="none" style={[s.toast, { opacity: op }]} accessibilityLiveRegion="polite">
          <RNText style={[t.base, { color: '#fff', textAlign: 'center', fontFamily: fonts.medium }]}>{msg}</RNText>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

const t = StyleSheet.create({
  base: { fontFamily: fonts.regular, color: colors.text, writingDirection: 'rtl' },
  body: { fontSize: 15, lineHeight: 24 },
  small: { fontSize: 12.5, lineHeight: 19, color: colors.muted },
  muted: { fontSize: 14, lineHeight: 22, color: colors.muted },
  label: { fontSize: 13, fontFamily: fonts.medium, color: '#243D69', marginBottom: 6 },
  title: { fontSize: 16, fontFamily: fonts.bold, color: colors.heading, lineHeight: 24 },
  h2: { fontSize: 18, fontFamily: fonts.bold, color: colors.heading, lineHeight: 27 },
  h1: { fontSize: 25, fontFamily: fonts.heavy, color: colors.heading, lineHeight: 36 },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  btn: { minHeight: 50, borderRadius: radius.md, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSm: { minHeight: 40, paddingHorizontal: 12, borderRadius: radius.sm },
  btnText: { fontFamily: fonts.bold, fontSize: 15 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 14, ...shadow },
  input: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: '#DCE5F5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: fonts.regular, color: colors.text, writingDirection: 'rtl',
  },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 16 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  toast: { position: 'absolute', bottom: 100, alignSelf: 'center', maxWidth: '88%', backgroundColor: '#15233F', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
});
