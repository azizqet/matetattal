// عناصر واجهة الدخول والتسجيل بهوية «ماتعطل».
// كل العناصر داخل حدود الشاشة (لا عناصر مطلقة خارج الإطار)، أسماء الخانات ظاهرة دائماً فوقها،
// ونصوص كحلية عالية التباين (WCAG AA) في الوضعين الفاتح والداكن.
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View, type TextInputProps } from 'react-native';
import { colors, fonts, gradients, isDark, radius } from '@/lib/theme';
import { Icon, Text } from './ui';

const native = Platform.OS !== 'web';
const toLatinDigits = (v: string) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** رأس بهوية ماتعطل: تدرّج ملكي + شعار بنبض خفيف — كل شيء داخل الإطار */
export function AuthHero({ title, subtitle, topInset, children }: { title: string; subtitle?: string; topInset: number; children?: ReactNode }) {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
      Animated.timing(pulse, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <LinearGradient colors={gradients.brand} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[h.hero, { paddingTop: topInset }]}>
      <View style={h.brandRow}>
        <Animated.View style={[h.mark, { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }] }]}>
          <Icon name="car-wrench" size={24} color={colors.white} />
        </Animated.View>
        <Text style={h.word} maxFontSizeMultiplier={1.2}>ماتعطل<Text style={h.dot}>•</Text></Text>
      </View>
      <Text style={h.title} maxFontSizeMultiplier={1.3}>{title}</Text>
      {subtitle ? <Text style={h.sub} maxFontSizeMultiplier={1.3}>{subtitle}</Text> : null}
      {children}
      <View style={h.goldLine} />
    </LinearGradient>
  );
}

/** تبويبان منفصلان بوضوح: المحدد أزرق بنص أبيض، والآخر نص كحلي واضح */
export function AuthTabs<T extends string>({ value, options, onChange }: { value: T; options: [T, string, string][]; onChange: (v: T) => void }) {
  // على الشاشات الضيقة جداً (مثل iPhone SE) نخفي الأيقونة حتى يبقى النص في سطر واحد
  const narrow = useWindowDimensions().width < 360;
  return (
    <View style={tb.wrap} accessibilityRole="tablist">
      {options.map(([k, label, icon]) => {
        const on = k === value;
        return (
          <Pressable key={k} onPress={() => onChange(k)} style={[tb.tab, on && tb.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: on }} testID={`tab-${k}`}>
            {narrow ? null : <Icon name={icon} size={19} color={on ? colors.white : colors.text} />}
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[tb.txt, { color: on ? colors.white : colors.text }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** خانة باسم ظاهر دائماً فوقها، أيقونة، توهج عند الكتابة، وزر إظهار/إخفاء كلمة المرور */
export const AuthField = forwardRef<ComponentRef<typeof TextInput>, TextInputProps & { icon: string; label: string; ltr?: boolean; secureToggle?: boolean; hint?: string }>(
  function AuthField({ icon, label, ltr, secureToggle, hint, style, ...p }, ref) {
    const [focus, setFocus] = useState(false);
    const [hidden, setHidden] = useState(!!secureToggle);
    // مرجع داخلي + المرجع الممرَّر من الخارج: الضغط على أي جزء من الخانة (الأيقونة/الإطار) يفتح الكتابة
    const inner = useRef<ComponentRef<typeof TextInput>>(null);
    const setRefs = (node: ComponentRef<typeof TextInput> | null) => {
      inner.current = node;
      if (typeof ref === 'function') ref(node); else if (ref) ref.current = node;
    };
    // iOS يمسح محتوى الحقل السري عند أول حرف بعد إعادة الإخفاء — نحفظ النص ونكمل عليه بدل مسحه
    const reHidden = useRef(false);
    const toggle = () => {
      if (!hidden) reHidden.current = true;
      setHidden(!hidden);
      // نُبقي التركيز ولوحة المفاتيح على الحقل بعد الضغط على العين
      setTimeout(() => inner.current?.focus(), 0);
    };
    const onChangeText = (t: string) => {
      const prev = typeof p.value === 'string' ? p.value : '';
      if (reHidden.current && Platform.OS === 'ios' && prev.length > 1 && t.length === 1) { reHidden.current = false; p.onChangeText?.(prev + t); return; }
      reHidden.current = false;
      p.onChangeText?.(t);
    };
    return (
      <View style={f.group}>
        <Text style={f.label}>{label}</Text>
        <Pressable onPress={() => inner.current?.focus()} style={[f.box, focus && f.boxFocus]} accessible={false}>
          <Icon name={icon} size={22} color={focus ? colors.link : colors.muted} />
          <TextInput
            ref={setRefs}
            placeholderTextColor={colors.placeholder}
            accessibilityLabel={label}
            {...p}
            onChangeText={onChangeText}
            editable={p.editable ?? true}
            secureTextEntry={secureToggle ? hidden : p.secureTextEntry}
            onFocus={(e) => { setFocus(true); p.onFocus?.(e); }}
            onBlur={(e) => { setFocus(false); p.onBlur?.(e); }}
            style={[f.input, ltr && f.ltr, style]}
          />
          {secureToggle ? (
            // الضغط على العين لا يسحب التركيز من الحقل ولا يغلق لوحة المفاتيح
            <Pressable onPress={toggle} hitSlop={12} accessibilityRole="button" accessibilityLabel={hidden ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور'} testID={`${p.testID ?? 'pw'}-eye`}>
              <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={23} color={colors.text} />
            </Pressable>
          ) : null}
        </Pressable>
        {hint ? <Text style={f.hint}>{hint}</Text> : null}
      </View>
    );
  },
);

/** خانة التلفون الكويتي: علم + ‎+965 ثابت، 8 أرقام من اليسار لليمين */
export function KuwaitPhoneField({ label = 'رقم التلفون', value, onChangeText, testID, autoFocus, onSubmitEditing }: {
  label?: string; value: string; onChangeText: (v: string) => void; testID?: string; autoFocus?: boolean; onSubmitEditing?: () => void;
}) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={f.group}>
      <Text style={f.label}>{label}</Text>
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
          onChangeText={(v) => onChangeText(toLatinDigits(v).replace(/\D/g, '').slice(0, 8))}
          keyboardType="number-pad" inputMode="numeric" textContentType="telephoneNumber" autoComplete="tel" maxLength={8}
          placeholder="XXXX XXXX" placeholderTextColor={colors.placeholder} accessibilityLabel={label}
          autoFocus={autoFocus} onSubmitEditing={onSubmitEditing} returnKeyType="next"
          onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
          testID={testID} style={[f.input, f.phoneInput]}
        />
      </View>
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
          onChangeText={(v) => onChange(toLatinDigits(v).replace(/\D/g, '').slice(0, length))}
          keyboardType="number-pad" inputMode="numeric" textContentType="oneTimeCode" autoComplete="sms-otp" importantForAutofill="yes"
          caretHidden accessibilityLabel="رمز التحقق" testID={testID} style={o.hidden}
        />
      </View>
    );
  },
);

/** دخول ناعم للمحتوى عند تغيّر الخطوة (شفافية + انزلاق خفيف) */
export function FadeSlide({ k, children }: { k: string; children: ReactNode }) {
  const [a] = useState(() => new Animated.Value(0));
  useEffect(() => {
    a.setValue(0);
    Animated.timing(a, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: native }).start();
  }, [k, a]);
  return <Animated.View style={{ opacity: a, transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>{children}</Animated.View>;
}

const h = StyleSheet.create({
  hero: { paddingHorizontal: 22, paddingBottom: 58, borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: 'hidden' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  word: { color: '#fff', fontFamily: fonts.heavy, fontSize: 26, lineHeight: 40, includeFontPadding: false },
  dot: { color: colors.accent, fontSize: 28, lineHeight: 40 },
  title: { color: '#fff', fontFamily: fonts.heavy, fontSize: 29, lineHeight: 44, marginTop: 18 },
  sub: { color: '#FFFFFF', opacity: 0.92, fontFamily: fonts.medium, fontSize: 16, lineHeight: 26 },
  goldLine: { width: 44, height: 4, borderRadius: 2, backgroundColor: colors.accent, marginTop: 14 },
});
const tb = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 8, backgroundColor: isDark ? colors.input : '#EDF2FB', borderRadius: radius.md, padding: 5, borderWidth: 1, borderColor: colors.line },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: radius.sm },
  tabOn: { backgroundColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  txt: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 24 },
});
const f = StyleSheet.create({
  group: { marginTop: 16 },
  label: { fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 24, color: colors.label, marginBottom: 7 },
  hint: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: colors.muted, marginTop: 6 },
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 58, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.inputBorder, backgroundColor: colors.input, paddingHorizontal: 14 },
  boxFocus: { borderColor: colors.primary, borderWidth: 2, shadowColor: colors.primary, shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  input: { flex: 1, minWidth: 0, minHeight: 56, paddingVertical: 0, fontFamily: fonts.bold, fontSize: 17, color: colors.inputText, writingDirection: 'rtl', textAlign: 'right' },
  ltr: { writingDirection: 'ltr', textAlign: 'left' },
  phoneBox: { direction: 'ltr' },
  cc: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flag: { width: 26, height: 18, borderRadius: 4, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  flagBlack: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 9, backgroundColor: '#000' },
  ccText: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 26, color: colors.inputText, writingDirection: 'ltr' },
  sep: { width: 1.5, height: 28, backgroundColor: colors.inputBorder },
  phoneInput: { writingDirection: 'ltr', textAlign: 'left', fontSize: 19, letterSpacing: 2 },
});
const o = StyleSheet.create({
  row: { flexDirection: 'row', direction: 'ltr', justifyContent: 'center', gap: 8 },
  box: { flex: 1, maxWidth: 52, height: 62, borderRadius: 16, borderWidth: 1.5, borderColor: colors.inputBorder, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center' },
  filled: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  active: { borderColor: colors.primary, borderWidth: 2.5 },
  txt: { fontFamily: fonts.heavy, fontSize: 25, lineHeight: 34, color: colors.inputText },
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent' },
});
