// عناصر واجهة الدخول والتسجيل بهوية «ماتعطل».
// كل العناصر داخل حدود الشاشة (لا عناصر مطلقة خارج الإطار)، أسماء الخانات ظاهرة دائماً فوقها،
// ونصوص كحلية عالية التباين (WCAG AA) في الوضعين الفاتح والداكن.
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View, type TextInputProps } from 'react-native';
import { colors, fonts, gradients, isDark, radius } from '@/lib/theme';
import { Icon, Text } from './ui';

const native = Platform.OS !== 'web';
const toLatinDigits = (v: string) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

/** رأس بهوية ماتعطل: تدرّج ملكي + شعار بنبض خفيف — كل شيء داخل الإطار */
export function AuthHero({ title, subtitle, topInset, children, onBack }: { title: string; subtitle?: string; topInset: number; children?: ReactNode; onBack?: () => void }) {
  return (
    <LinearGradient colors={gradients.brand} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[h.hero, { paddingTop: topInset }]}>
      {/* زر رجوع داخل المنطقة الآمنة (بدل رأس النظام الشفاف الذي كان يتداخل مع المحتوى وشريط الحالة) */}
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="رجوع" style={h.back} testID="auth-back">
          <Icon name="arrow-right" size={24} color={colors.white} />
        </Pressable>
      ) : null}
      <View style={h.brandRow}>
        <View style={h.mark}>
          <Icon name="car-wrench" size={24} color={colors.white} />
        </View>
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

// ===== نظام الإدخال الموحّد =====
// قواعد ثابتة لكل الخانات حتى لا يُصلَح حقل ويخرب غيره:
//  1) TextInput لا يُغلَّف أبداً بعنصر قابل للضغط (Pressable) — الأيقونة وحدها قابلة للضغط وتنقل التركيز للحقل،
//     فلا يتنافس عنصر آخر على لمسات الكتابة/اللصق/التحديد.
//  2) لا maxLength على الحقول المنسّقة (التلفون/الرمز): iOS يقص النص الملصوق أو المعبّأ تلقائياً قبل وصوله
//     (مثل «‎+965 9770 6792» → «‎+965 977») أو يرفضه كاملاً. التنقية والحد يتمّان في onChangeText.
//  3) المكوّنات معرّفة خارج الشاشة، بمفاتيح ثابتة، ومعزولة بـ memo — لا إعادة إنشاء ولا فقدان تركيز مع كل حرف.
//  4) لا عناصر شفافة فوق الحقول (الطبقة المخفية الوحيدة لمربعات الرمز تحت مكوّنها فقط).

/** أرقام عربية/فارسية → إنجليزية */
export const toLatin = toLatinDigits;

/** رقم تلفون كويتي محلي (8 أرقام) من أي إدخال: كتابة، لصق «‎+965 9770 6792»، «00965…»، أو تعبئة تلقائية */
export function sanitizeKwPhone(input: string): string {
  let d = toLatinDigits(input).replace(/\D/g, '');
  if (d.length > 8 && d.startsWith('00965')) d = d.slice(5);
  else if (d.length > 8 && d.startsWith('965')) d = d.slice(3);
  return d.slice(0, 8);
}

/** إطار الخانة: الاسم فوقها دائماً، أيقونة تنقل التركيز، وتوهج عند الكتابة */
function FieldShell({ label, icon, focused, onIconPress, children, trailing, hint, ltrRow }: {
  label: string; icon?: ReactNode | string; focused: boolean; onIconPress: () => void; children: ReactNode; trailing?: ReactNode; hint?: string; ltrRow?: boolean;
}) {
  return (
    <View style={f.group}>
      <Text style={f.label}>{label}</Text>
      <View style={[f.box, ltrRow && f.ltrRow, focused && f.boxFocus]}>
        {icon ? (
          <Pressable onPress={onIconPress} hitSlop={8} accessible={false}>
            {typeof icon === 'string' ? <Icon name={icon} size={22} color={focused ? colors.link : colors.muted} /> : icon}
          </Pressable>
        ) : null}
        {children}
        {trailing}
      </View>
      {hint ? <Text style={f.hint}>{hint}</Text> : null}
    </View>
  );
}

type FieldProps = TextInputProps & { icon: string; label: string; ltr?: boolean; secureToggle?: boolean; hint?: string };

/** خانة نصية عامة (الاسم، البريد، كلمة المرور…) */
export const AuthField = memo(forwardRef<ComponentRef<typeof TextInput>, FieldProps>(
  function AuthField({ icon, label, ltr, secureToggle, hint, style, onChangeText, onFocus, onBlur, ...p }, ref) {
    const [focus, setFocus] = useState(false);
    const [hidden, setHidden] = useState(!!secureToggle);
    const inner = useRef<ComponentRef<typeof TextInput>>(null);
    useImperativeHandle(ref, () => inner.current as ComponentRef<typeof TextInput>, []);
    // iOS يمسح الحقل السري عند أول حرف بعد إعادة إخفائه — نُكمل على النص بدل مسحه
    const reHidden = useRef(false);
    const toggle = () => {
      if (!hidden) reHidden.current = true;
      setHidden(!hidden);
      setTimeout(() => inner.current?.focus(), 0); // يبقى التركيز ولوحة المفاتيح على الحقل
    };
    const change = (t: string) => {
      const prev = typeof p.value === 'string' ? p.value : '';
      if (reHidden.current && Platform.OS === 'ios' && prev.length > 1 && t.length === 1) { reHidden.current = false; onChangeText?.(prev + t); return; }
      reHidden.current = false;
      onChangeText?.(t);
    };
    return (
      <FieldShell label={label} icon={icon} focused={focus} onIconPress={() => inner.current?.focus()} hint={hint}
        trailing={secureToggle ? (
          <Pressable onPress={toggle} hitSlop={12} accessibilityRole="button" accessibilityLabel={hidden ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور'} testID={`${p.testID ?? 'pw'}-eye`}>
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={23} color={colors.text} />
          </Pressable>
        ) : null}>
        <TextInput
          ref={inner}
          placeholderTextColor={colors.placeholder}
          accessibilityLabel={label}
          editable
          {...p}
          onChangeText={change}
          secureTextEntry={secureToggle ? hidden : p.secureTextEntry}
          onFocus={(e) => { setFocus(true); onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); onBlur?.(e); }}
          style={[f.input, ltr && f.ltr, style]}
        />
      </FieldShell>
    );
  },
));

/** خانة التلفون الكويتي: العلم و‎+965 ثابتان ومنفصلان عن الرقم، 8 أرقام فقط، ولوحة أرقام */
export const KuwaitPhoneField = memo(function KuwaitPhoneField({ label = 'رقم التلفون', value, onChangeText, testID, autoFocus, onSubmitEditing }: {
  label?: string; value: string; onChangeText: (v: string) => void; testID?: string; autoFocus?: boolean; onSubmitEditing?: () => void;
}) {
  const [focus, setFocus] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const change = (t: string) => onChangeText(sanitizeKwPhone(t));
  const prefix = (
    <View style={f.cc} accessibilityLabel="مفتاح الكويت +965">
      <View style={f.flag}>
        <View style={{ flex: 1, backgroundColor: '#007A3D' }} /><View style={{ flex: 1, backgroundColor: '#FFFFFF' }} /><View style={{ flex: 1, backgroundColor: '#CE1126' }} />
        <View style={f.flagBlack} pointerEvents="none" />
      </View>
      <Text style={f.ccText}>+965</Text>
      <View style={f.sep} />
    </View>
  );
  return (
    <FieldShell label={label} icon={prefix} focused={focus} onIconPress={() => input.current?.focus()} ltrRow>
      <TextInput
        ref={input}
        value={value}
        onChangeText={change}
        editable
        keyboardType="number-pad" inputMode="numeric" textContentType="telephoneNumber" autoComplete="tel"
        placeholder="XXXX XXXX" placeholderTextColor={colors.placeholder} accessibilityLabel={label}
        autoFocus={autoFocus} onSubmitEditing={onSubmitEditing} returnKeyType="next" autoCorrect={false} spellCheck={false}
        onFocus={() => setFocus(true)} onBlur={() => setFocus(false)}
        testID={testID} style={[f.input, f.phoneInput]}
      />
    </FieldShell>
  );
});

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
          ref={ref} value={value}
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
  back: { alignSelf: 'flex-start', width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
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
  input: { flex: 1, minWidth: 0, minHeight: 56, paddingVertical: 0, fontFamily: fonts.bold, fontSize: 17, color: colors.inputText, textAlign: 'right' },
  ltr: { textAlign: 'left' },
  ltrRow: { direction: 'ltr' },
  cc: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  flag: { width: 26, height: 18, borderRadius: 4, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  flagBlack: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 9, backgroundColor: '#000' },
  ccText: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 26, color: colors.inputText, writingDirection: 'ltr' },
  sep: { width: 1.5, height: 28, backgroundColor: colors.inputBorder, marginStart: 4 },
  phoneInput: { textAlign: 'left', fontSize: 19 },
});
const o = StyleSheet.create({
  row: { flexDirection: 'row', direction: 'ltr', justifyContent: 'center', gap: 8 },
  box: { flex: 1, maxWidth: 52, height: 62, borderRadius: 16, borderWidth: 1.5, borderColor: colors.inputBorder, backgroundColor: colors.input, alignItems: 'center', justifyContent: 'center' },
  filled: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  active: { borderColor: colors.primary, borderWidth: 2.5 },
  txt: { fontFamily: fonts.heavy, fontSize: 25, lineHeight: 34, color: colors.inputText },
  hidden: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.02, color: 'transparent' },
});
