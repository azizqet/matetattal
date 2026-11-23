import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, Platform, Pressable, ScrollView, StyleSheet, Text as RNText, TextInput, View,
  type PressableProps, type StyleProp, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, gradients, isDark, radius, shadow } from '@/lib/theme';

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
/** حركة ضغط ناعمة (تصغير خفيف) — تعمل على الجهاز الأصلي بدون مكتبات إضافية */
export function useScale(to = 0.97) {
  const [v] = useState(() => new Animated.Value(1));
  const run = (x: number) => Animated.spring(v, { toValue: x, useNativeDriver: Platform.OS !== 'web', speed: 40, bounciness: 6 }).start();
  return { style: { transform: [{ scale: v }] }, onPressIn: () => run(to), onPressOut: () => run(1) };
}

export function Button({ title, onPress, kind = 'primary', icon, loading, disabled, small, style, testID }: {
  title: string; onPress?: () => void; kind?: BtnKind; icon?: string; loading?: boolean; disabled?: boolean; small?: boolean;
  style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const bg = { primary: colors.primary, soft: colors.primarySoft, whatsapp: colors.whatsapp, danger: colors.dangerSoft, ghost: 'transparent' }[kind];
  const fg = { primary: colors.white, soft: colors.link, whatsapp: colors.white, danger: colors.danger, ghost: colors.link }[kind];
  const scale = useScale();
  const content = loading ? <ActivityIndicator color={fg} /> : (
    <>
      {icon ? <Icon name={icon} size={small ? 18 : 20} color={fg} /> : null}
      {title ? <RNText style={[t.base, s.btnText, small && { fontSize: 14.5, lineHeight: 22 }, { color: fg }]}>{title}</RNText> : null}
    </>
  );
  return (
    <Animated.View style={[scale.style, { opacity: disabled ? 0.5 : 1 }, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={title || icon}
        disabled={disabled || loading}
        onPressIn={scale.onPressIn}
        onPressOut={scale.onPressOut}
        onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
        style={[s.btn, small && s.btnSm, { backgroundColor: bg, overflow: 'hidden' }, kind === 'primary' && !small && s.btnGlow]}
      >
        {kind === 'primary' ? <LinearGradient colors={gradients.brand} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} /> : null}
        {content}
      </Pressable>
    </Animated.View>
  );
}

/** عنصر قابل للضغط مع حركة تصغير خفيفة */
export function PressableScale({ children, onPress, style, testID, accessibilityLabel }: {
  children: ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; testID?: string; accessibilityLabel?: string;
}) {
  const scale = useScale(0.96);
  return (
    <Animated.View style={[scale.style, style]}>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
        onPressIn={scale.onPressIn} onPressOut={scale.onPressOut}
        onPress={() => { if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
        style={{ flex: 1 }}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** هيكل تحميل نابض (بدل دوّامة التحميل في القوائم) */
export function Skeleton({ width = '100%', height = 16, radius: r = 10, style }: { width?: number | `${number}%`; height?: number; radius?: number; style?: StyleProp<ViewStyle> }) {
  const [op] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(op, { toValue: 0.5, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [op]);
  return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: isDark ? '#1C2740' : '#E6EBF4', opacity: op }, style]} />;
}

export function Card({ children, style, onPress, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: PressableProps['onPress']; testID?: string }) {
  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [s.card, style, pressed && { transform: [{ scale: 0.985 }], opacity: 0.94 }]}>
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
        placeholderTextColor={colors.placeholder}
        {...p}
        accessibilityLabel={label}
        style={[s.input, p.multiline && { minHeight: 90, textAlignVertical: 'top' }, error ? { borderColor: colors.danger } : null, style as StyleProp<TextStyle>]}
      />
      {error ? <Text variant="small" style={{ color: colors.danger, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}

/**
 * خانة رقم هاتف كويتي: اتجاه LTR ثابت، لون أسود واضح، لوحة أرقام، 8 أرقام فقط.
 * سبب العطل السابق: الخانة العامة Field تفرض writingDirection: 'rtl' داخل جذر direction: 'rtl'،
 * والأرقام نص LTR؛ على iOS/Android الأصلي قد يُرسم النص خارج الجزء الظاهر من الخانة فلا تظهر الأرقام.
 * هنا نثبت الاتجاه والمحاذاة يساراً، ونحوّل الأرقام العربية (٠-٩) إلى إنجليزية بدل حذفها.
 */
export function PhoneField({ label, value, onChangeText, error, testID, placeholder = '9xxxxxxx' }: {
  label: string; value: string; onChangeText: (v: string) => void; error?: string; testID?: string; placeholder?: string;
}) {
  return (
    <View style={{ marginTop: 12 }}>
      <Text variant="label">{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={(v) => onChangeText(phoneInput(v))}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="telephoneNumber"
        autoComplete="tel"
        autoCorrect={false}
        maxLength={8}
        placeholder={placeholder}
        placeholderTextColor={colors.placeholder}
        selectionColor={colors.primary}
        style={[s.input, s.phoneInput, error ? { borderColor: colors.danger } : null]}
      />
      {error ? <Text variant="small" style={{ color: colors.danger, marginTop: 4 }}>{error}</Text> : null}
    </View>
  );
}

/** ينظّف إدخال الهاتف: أرقام عربية/فارسية → إنجليزية، يحذف ما سواها، و8 أرقام كحد أقصى */
export function phoneInput(v: string): string {
  return v
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '')
    .slice(0, 8);
}

export function Chip({ label, active, onPress, icon }: { label: string; active?: boolean; onPress?: () => void; icon?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }}
      style={[s.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      {icon ? <Icon name={icon} size={16} color={active ? colors.white : colors.link} /> : null}
      <RNText style={[t.base, { fontSize: 14.5, lineHeight: 22, fontFamily: fonts.bold, color: active ? colors.white : colors.text }]}>{label}</RNText>
    </Pressable>
  );
}

export function Row({ children, style, gap = 8 }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Badge({ label, tone = 'blue' }: { label: string; tone?: 'blue' | 'green' | 'yellow' | 'red' | 'gray' }) {
  const m = {
    blue: [colors.primarySoft, colors.primary], green: [colors.successSoft, colors.successText], yellow: [colors.warningBg, colors.warningText],
    red: [colors.dangerSoft, colors.danger], gray: [isDark ? '#1C2740' : '#EEF1F6', colors.muted],
  }[tone];
  return <View style={[s.badge, { backgroundColor: m[0] }]}><RNText style={[t.base, { fontSize: 13, lineHeight: 20, fontFamily: fonts.bold, color: m[1] }]}>{label}</RNText></View>;
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
          <RNText style={[t.base, { color: colors.white, textAlign: 'center', fontFamily: fonts.medium }]}>{msg}</RNText>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

const t = StyleSheet.create({
  // أحجام أكبر وأسطر بارتفاع كافٍ (≈1.5×) حتى لا يُقص أي حرف عربي
  base: { fontFamily: fonts.regular, color: colors.text, writingDirection: 'rtl' },
  body: { fontSize: 16, lineHeight: 26 },
  small: { fontSize: 14, lineHeight: 22, color: colors.muted, fontFamily: fonts.medium },
  muted: { fontSize: 15.5, lineHeight: 25, color: colors.muted },
  label: { fontSize: 15, lineHeight: 23, fontFamily: fonts.bold, color: colors.label, marginBottom: 6 },
  title: { fontSize: 17.5, fontFamily: fonts.bold, color: colors.heading, lineHeight: 27 },
  h2: { fontSize: 20, fontFamily: fonts.bold, color: colors.heading, lineHeight: 31 },
  h1: { fontSize: 27, fontFamily: fonts.heavy, color: colors.heading, lineHeight: 40 },
});

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  btn: { minHeight: 50, borderRadius: radius.md, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSm: { minHeight: 40, paddingHorizontal: 12, borderRadius: radius.sm },
  btnText: { fontFamily: fonts.bold, fontSize: 16.5, lineHeight: 26 },
  btnGlow: { shadowColor: colors.primary, shadowOpacity: isDark ? 0.5 : 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 14, ...shadow },
  input: {
    backgroundColor: colors.input, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16.5, fontFamily: fonts.medium, color: colors.inputText, writingDirection: 'rtl',
  },
  phoneInput: { color: colors.inputText, writingDirection: 'ltr', textAlign: 'left', fontSize: 17, letterSpacing: 1, minHeight: 50, includeFontPadding: false },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.card },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 16 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  toast: { position: 'absolute', bottom: 100, alignSelf: 'center', maxWidth: '88%', backgroundColor: colors.toast, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
});
