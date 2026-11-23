// عناصر واجهة الدخول والتسجيل بهوية «ماتعطل»: رأس «الطريق» المتحرك، مبدّل بشريحة منزلقة،
// حقول بأيقونات وتوهج عند التركيز، حقل تلفون +965، ومربعات رمز التحقق مع التعبئة التلقائية.
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useEffect, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, gradients, isDark, radius } from '@/lib/theme';
import { Icon, Text } from './ui';

const native = Platform.OS !== 'web';

/** رأس بهوية ماتعطل: تدرّج ملكي، شعار، وخطوط طريق تتحرك بهدوء */
export function AuthHero({ title, subtitle, topInset, children }: { title: string; subtitle?: string; topInset: number; children?: ReactNode }) {
  const [move] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(move, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: native }));
    loop.start();
    return () => loop.stop();
  }, [move]);
  const shift = move.interpolate({ inputRange: [0, 1], outputRange: [0, 56] });
  return (
    <LinearGradient colors={gradients.brand} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[h.hero, { paddingTop: topInset + 18 }]}>
      <View style={h.orb} />
      {/* الطريق */}
      <View style={h.road} pointerEvents="none">
        <Animated.View style={[h.lane, { transform: [{ translateX: shift }] }]}>
          {Array.from({ length: 14 }).map((_, i) => <View key={i} style={h.dash} />)}
        </Animated.View>
      </View>
      <View style={h.brandRow}>
        <View style={h.mark}><Icon name="car-wrench" size={22} color={colors.white} /></View>
        <Text style={h.word} maxFontSizeMultiplier={1.2}>ماتعطل<Text style={h.dot}>•</Text></Text>
      </View>
      <Text style={h.title}>{title}</Text>
      {subtitle ? <Text style={h.sub}>{subtitle}</Text> : null}
      {children}
    </LinearGradient>
  );
}

/** مبدّل «حساب جديد / تسجيل دخول» بشريحة منزلقة */
export function AuthSwitch<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  const idx = Math.max(0, options.findIndex(([k]) => k === value));
  const [x] = useState(() => new Animated.Value(idx));
  const [w, setW] = useState(0);
  useEffect(() => { Animated.spring(x, { toValue: idx, useNativeDriver: native, speed: 18, bounciness: 6 }).start(); }, [idx, x]);
  const seg = w / options.length;
  return (
    <View style={sw.wrap} onLayout={(e) => setW(e.nativeEvent.layout.width - 8)}>
      {w > 0 ? (
        // في RTL أول خيار على اليمين
        <Animated.View style={[sw.pill, { width: seg, transform: [{ translateX: x.interpolate({ inputRange: [0, options.length - 1 || 1], outputRange: [0, -(seg * (options.length - 1))] }) }] }]} />
      ) : null}
      {options.map(([k, label]) => (
        <Pressable key={k} onPress={() => onChange(k)} style={sw.opt} accessibilityRole="tab" accessibilityState={{ selected: k === value }} testID={`switch-${k}`}>
          <Text style={[sw.txt, k === value && { color: colors.white }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** حقل بأيقونة، توهج عند التركيز، وزر إظهار كلمة المرور */
export const AuthField = forwardRef<ComponentRef<typeof TextInput>, TextInputProps & { icon: string; label: string; ltr?: boolean; secureToggle?: boolean; error?: string }>(
  function AuthField({ icon, label, ltr, secureToggle, error, style, ...p }, ref) {
    const [focus, setFocus] = useState(false);
    const [hidden, setHidden] = useState(!!secureToggle);
    return (
      <View style={{ marginTop: 12 }}>
        <View style={[f.box, focus && f.boxFocus, error ? { borderColor: colors.danger } : null]}>
          <View style={[f.icon, focus && { backgroundColor: colors.primary }]}><Icon name={icon} size={19} color={focus ? colors.white : colors.primary} /></View>
          <TextInput
            ref={ref}
            placeholder={label}
            placeholderTextColor={colors.placeholder}
            accessibilityLabel={label}
            {...p}
            secureTextEntry={secureToggle ? hidden : p.secureTextEntry}
            onFocus={(e) => { setFocus(true); p.onFocus?.(e); }}
            onBlur={(e) => { setFocus(false); p.onBlur?.(e); }}
            style={[f.input, ltr && { writingDirection: 'ltr', textAlign: 'left' }, style]}
          />
          {secureToggle ? (
            <Pressable onPress={() => setHidden(!hidden)} hitSlop={10} accessibilityRole="button" accessibilityLabel={hidden ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور'} style={{ paddingHorizontal: 12 }}>
              <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={21} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        {error ? <Text variant="small" style={{ color: colors.danger, marginTop: 4 }}>{error}</Text> : null}
      </View>
    );
  },
);

/** حقل التلفون الكويتي: علم + ‎+965 ثابت، 8 أرقام من اليسار لليمين */
export function KuwaitPhoneField({ value, onChangeText, testID, autoFocus, onSubmitEditing }: {
  value: string; onChangeText: (v: string) => void; testID?: string; autoFocus?: boolean; onSubmitEditing?: () => void;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[f.box, f.phoneBox, focus && f.boxFocus]}>
      <View style={f.cc}>
        <View style={f.flag}>
          <View style={{ flex: 1, backgroundColor: '#007A3D' }} /><View style={{ flex: 1, backgroundColor: '#FFFFFF' }} /><View style={{ flex: 1, backgroundColor: '#CE1126' }} />
          <View style={f.flagBlack} />
        </View>
        <Text style={f.ccText}>+965</Text>
      </View>
      <View style={f.sep} />
      <TextInput
        value={value}
        onChangeText={(v) => onChangeText(v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0)).replace(/\D/g, '').slice(0, 8))}
        keyboardType="number-pad" inputMode="numeric" textContentType="telephoneNumber" autoComplete="tel" maxLength={8}
        placeholder="رقم التلفون" placeholderTextColor={colors.placeholder} accessibilityLabel="رقم التلفون"
        autoFocus={autoFocus} onSubmitEditing={onSubmitEditing} returnKeyType="next"
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        testID={testID} style={[f.input, f.phoneInput]}
      />
    </View>
  );
}

/** مربعات رمز التحقق (6) فوق حقل واحد يدعم التعبئة التلقائية من الرسائل */
export const OtpBoxes = forwardRef<ComponentRef<typeof TextInput>, { value: string; onChange: (v: string) => void; length?: number; testID?: string; error?: boolean }>(
  function OtpBoxes({ value, onChange, length = 6, testID, error }, ref) {
    return (
      <View>
        <View style={o.row}>
          {Array.from({ length }).map((_, i) => {
            const active = i === Math.min(value.length, length - 1);
            return (
              <View key={i} style={[o.box, value[i] ? o.filled : null, active && o.active, error && { borderColor: colors.danger }]}>
                <Text style={o.txt}>{value[i] ?? ''}</Text>
              </View>
            );
          })}
        </View>
        <TextInput
          ref={ref} value={value} maxLength={length}
          onChangeText={(v) => onChange(v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/\D/g, '').slice(0, length))}
          keyboardType="number-pad" inputMode="numeric" textContentType="oneTimeCode" autoComplete="sms-otp" importantForAutofill="yes"
          caretHidden accessibilityLabel="رمز التحقق" testID={testID} style={o.hidden}
        />
      </View>
    );
  },
);

/** دخول ناعم للمحتوى عند تغيّر الخطوة */
export function FadeSlide({ k, children }: { k: string; children: ReactNode }) {
  const [a] = useState(() => new Animated.Value(0));
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [k, a]);
  return <Animated.View style={{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>{children}</Animated.View>;
}

const h = StyleSheet.create({
  hero: { paddingHorizontal: 22, paddingBottom: 64, borderBottomLeftRadius: 36, borderBottomRightRadius: 36, overflow: 'hidden' },
  orb: { position: 'absolute', width: 280, height: 280, borderRadius: 140, backgroundColor: 'rgba(255,255,255,0.07)', top: -120, left: -90 },
  road: { position: 'absolute', left: 0, right: 0, bottom: 22, height: 4, overflow: 'hidden', opacity: 0.35 },
  lane: { flexDirection: 'row', gap: 22, marginLeft: -56 },
  dash: { width: 34, height: 4, borderRadius: 2, backgroundColor: colors.accent },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  word: { color: '#fff', fontFamily: fonts.heavy, fontSize: 24, lineHeight: 38, includeFontPadding: false },
  dot: { color: colors.accent, fontSize: 26, lineHeight: 38 },
  title: { color: '#fff', fontFamily: fonts.heavy, fontSize: 28, lineHeight: 42, marginTop: 22 },
  sub: { color: 'rgba(255,255,255,0.82)', fontFamily: fonts.medium, fontSize: 14.5, lineHeight: 23 },
});
const sw = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: isDark ? colors.input : colors.primarySoft, borderRadius: 999, padding: 4 },
  pill: { position: 'absolute', top: 4, bottom: 4, right: 4, borderRadius: 999, backgroundColor: colors.primary },
  opt: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  txt: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
});
const f = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', minHeight: 58, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.inputBorder, backgroundColor: colors.input, paddingStart: 8 },
  boxFocus: { borderColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 56, paddingHorizontal: 12, fontFamily: fonts.medium, fontSize: 16, color: colors.inputText, writingDirection: 'rtl', textAlign: 'right' },
  phoneBox: { direction: 'ltr', marginTop: 12, paddingStart: 0, paddingLeft: 12 },
  cc: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flag: { width: 26, height: 18, borderRadius: 4, overflow: 'hidden' },
  flagBlack: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 9, backgroundColor: '#000', transform: [{ skewX: '0deg' }] },
  ccText: { fontFamily: fonts.bold, fontSize: 17, color: colors.inputText, writingDirection: 'ltr' },
  sep: { width: 1, height: 28, backgroundColor: colors.line, marginHorizontal: 12 },
  phoneInput: { writingDirection: 'ltr', textAlign: 'left', fontFamily: fonts.bold, fontSize: 19, letterSpacing: 2, paddingHorizontal: 0 },
});
const o = StyleSheet.create({
  row: { flexDirection: 'row', direction: 'ltr', justifyContent: 'center', gap: 8 },
  box: { flex: 1, maxWidth: 52, height: 62, borderRadius: 16, borderWidth: 1.5, borderColor: colors.inputBorder, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center' },
  filled: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  active: { borderColor: colors.primary, borderWidth: 2.5 },
  txt: { fontFamily: fonts.heavy, fontSize: 24, lineHeight: 32, color: colors.inputText },
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent' },
});
