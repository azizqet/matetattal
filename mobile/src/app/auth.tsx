// صفحة التسجيل والدخول الموحّدة: رقم تلفون كويتي (+965) + كلمة سر. بدون SMS وبدون بريد.
// مبادئ ثابتة حتى تعمل الكتابة على الآيفون والأندرويد:
//  • TextInput قياسي مباشرة: بدون تغليف بعناصر ضغط، بدون حركات، بدون writingDirection، بدون maxLength
//    (التنقية في onChangeText)، وبدون textContentType="newPassword" (يفتح «كلمة سر قوية» ويمنع الكتابة على iOS).
// الأمان في الخادم: الرقم فريد، كلمة السر bcrypt، حدود محاولات، وصلاحية المدير من قاعدة البيانات فقط.
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConsentCheckbox, rememberRegistrationConsent, useRequiredTerms } from '@/components/Consent';
import { Icon, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors, fonts, gradients, radius, shadow } from '@/lib/theme';
import { arabicError, isKuwaitMobile } from '@/lib/utils';

const latin = (v: string) => v.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
/** رقم كويتي محلي (8) من أي إدخال: كتابة، لصق «‎+965 9991 2313»، «00965…»، أو تعبئة تلقائية */
export function cleanPhone(v: string) {
  let d = latin(v).replace(/\D/g, '');
  if (d.length > 8 && d.startsWith('00965')) d = d.slice(5);
  else if (d.length > 8 && d.startsWith('965')) d = d.slice(3);
  return d.slice(0, 8);
}
/** رمز الاستعادة: حروف A-F وأرقام فقط، يُنسّق تلقائياً XXXXXX-XXXXXX-XXXXXX */
export function cleanRecovery(v: string) {
  const raw = latin(v).toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 18);
  return raw.match(/.{1,6}/g)?.join('-') ?? '';
}
/** نفس شرط الخادم: 8 أحرف على الأقل وفيها رقم وحرف غير رقمي */
export function passwordProblem(p: string): string | null {
  if (p.length < 8) return 'كلمة السر لازم تكون 8 أحرف على الأقل';
  if (!/\d/.test(p) || !/\D/.test(p)) return 'كلمة السر لازم تحتوي حروفاً وأرقاماً';
  if (p.length > 72) return 'كلمة السر طويلة جداً';
  return null;
}

type Mode = 'login' | 'signup' | 'forgot' | 'saveCode' | 'email';

export default function Auth() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { refreshProfile } = useSession();
  const terms = useRequiredTerms(['customers', 'privacy']);
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [email, setEmail] = useState('');
  const [recovery, setRecovery] = useState('');
  const [newCode, setNewCode] = useState('');
  const [saved, setSaved] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uid, setUid] = useState<string | null>(null);

  // الأزرار معطلة أثناء الانتظار، فلا يُرسل الطلب مرتين
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await fn(); } catch (e) { toast(arabicError(e)); } finally { setBusy(false); }
  }

  const go = (m: Mode) => { setMode(m); setPassword(''); setPassword2(''); setRecovery(''); setShow(false); };

  // المدير يرى لوحة الإدارة مباشرة — الصلاحية تُقرأ من قاعدة البيانات (profiles.role) والخادم يفرضها بـ RLS
  async function finish(userId: string, welcome: string) {
    const prof = await api.getMyProfile(userId).catch(() => null);
    await refreshProfile().catch(() => {});
    toast(welcome);
    router.replace(prof?.role === 'admin' ? '/admin' : '/');
  }

  const login = () => run(async () => {
    if (!isKuwaitMobile(phone)) { toast('اكتب رقم تلفون كويتي من 8 أرقام يبدأ بـ 5 أو 6 أو 9'); return; }
    if (!password) { toast('اكتب كلمة السر'); return; }
    const user = await api.signInWithPhonePassword(phone, password);
    if (user) await finish(user.id, 'أهلاً فيك');
  });

  const loginEmail = () => run(async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { toast('اكتب البريد الإلكتروني'); return; }
    if (!password) { toast('اكتب كلمة السر'); return; }
    const user = await api.signInWithEmailPassword(email, password);
    if (user) await finish(user.id, 'أهلاً فيك');
  });

  const signup = () => run(async () => {
    if (name.trim().length < 2) { toast('اكتب اسمك'); return; }
    if (!isKuwaitMobile(phone)) { toast('اكتب رقم تلفون كويتي من 8 أرقام يبدأ بـ 5 أو 6 أو 9'); return; }
    const bad = passwordProblem(password);
    if (bad) { toast(bad); return; }
    if (password !== password2) { toast('كلمتا السر غير متطابقتين'); return; }
    if (terms.docs.length && !agreed) { toast('وافق على الشروط وسياسة الخصوصية للمتابعة'); return; }
    const user = await api.signUpWithPhonePassword(phone, password, name);
    if (!user) { toast('تعذّر إنشاء الحساب، حاول مرة ثانية'); return; }
    if (terms.docs.length) await rememberRegistrationConsent(terms.docs.map((d) => d.id)).catch(() => {});
    setUid(user.id);
    setPassword(''); setPassword2('');
    // رمز الاستعادة: الطريقة الوحيدة لاسترجاع الحساب بدون SMS أو بريد
    const code = await api.createRecoveryCode().catch(() => '');
    if (code) { setNewCode(code); setSaved(false); setMode('saveCode'); return; }
    await finish(user.id, 'تم إنشاء حسابك');
  });

  const reset = () => run(async () => {
    if (!isKuwaitMobile(phone)) { toast('اكتب رقم تلفون كويتي من 8 أرقام'); return; }
    if (recovery.replace(/-/g, '').length !== 18) { toast('اكتب رمز الاستعادة كاملاً (18 خانة)'); return; }
    const bad = passwordProblem(password);
    if (bad) { toast(bad); return; }
    if (password !== password2) { toast('كلمتا السر غير متطابقتين'); return; }
    const ok = await api.resetPasswordWithRecovery(phone, recovery, password);
    if (!ok) { toast('رقم التلفون أو رمز الاستعادة غير صحيح'); return; }
    toast('تم تغيير كلمة السر. سجّل دخولك بكلمة السر الجديدة');
    go('login');
  });

  const shareCode = () => { Share.share({ message: `رمز استعادة حساب ماتعطل: ${newCode}` }).catch(() => {}); };

  const back = () => {
    if (mode === 'forgot' || mode === 'email') { go('login'); return; }
    if (router.canGoBack()) router.back(); else router.replace('/');
  };

  const titles: Record<Mode, [string, string]> = {
    login: ['حياك في ماتعطل', 'ادخل برقم تلفونك وكلمة السر'],
    signup: ['حساب جديد', 'سجّل برقم تلفونك وكلمة سر — بدون رسائل'],
    forgot: ['نسيت كلمة السر؟', 'استخدم رمز الاستعادة اللي حفظته عند التسجيل'],
    saveCode: ['احفظ رمز الاستعادة', 'هذا الرمز هو الطريقة الوحيدة لاسترجاع حسابك إذا نسيت كلمة السر'],
    email: ['حساب قديم بالبريد', 'للحسابات اللي انسجلت سابقاً بالبريد الإلكتروني'],
  };

  const passwordField = (label: string, value: string, set: (v: string) => void, testID: string, submit?: () => void) => (
    <>
      <Text style={st.label}>{label}</Text>
      <View style={st.pwRow}>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={(v) => set(v.slice(0, 72))}
          secureTextEntry={!show}
          textContentType="password"
          autoComplete="password"
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="••••••••"
          placeholderTextColor={colors.placeholder}
          returnKeyType={submit ? 'done' : 'next'}
          onSubmitEditing={submit}
          style={[st.input, st.ltr, st.grow, st.pwPad]}
        />
        <Pressable onPress={() => setShow(!show)} hitSlop={8} accessibilityRole="button" accessibilityLabel={show ? 'إخفاء كلمة السر' : 'إظهار كلمة السر'} style={st.eye} testID={`${testID}-eye`}>
          <Icon name={show ? 'eye-off-outline' : 'eye-outline'} size={22} color={colors.muted} />
        </Pressable>
      </View>
    </>
  );

  const phoneField = (submit?: () => void) => (
    <>
      <Text style={st.label}>رقم التلفون</Text>
      <View style={st.phoneRow}>
        <View style={st.cc}><Text style={st.ccText}>🇰🇼 +965</Text></View>
        <TextInput
          testID="phone"
          value={phone}
          onChangeText={(v) => setPhone(cleanPhone(v))}
          keyboardType="number-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          placeholder="XXXXXXXX"
          placeholderTextColor={colors.placeholder}
          returnKeyType="done"
          onSubmitEditing={submit}
          style={[st.input, st.ltr, st.grow]}
        />
      </View>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={gradients.brand} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[st.hero, { paddingTop: insets.top + 12 }]}>
            {mode !== 'saveCode' ? (
              <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel="رجوع" style={st.back} testID="auth-back">
                <Icon name="arrow-right" size={24} color={colors.white} />
              </Pressable>
            ) : null}
            <Text style={st.brand}>ماتعطل<Text style={st.dot}>•</Text></Text>
            <Text style={st.title}>{titles[mode][0]}</Text>
            <Text style={st.sub}>{titles[mode][1]}</Text>
          </LinearGradient>

          <View style={st.card}>
            {mode === 'login' || mode === 'signup' ? (
              <View style={st.tabs} accessibilityRole="tablist">
                {(['login', 'signup'] as const).map((m) => (
                  <Pressable key={m} onPress={() => go(m)} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}
                    style={[st.tab, mode === m && st.tabOn]} testID={`tab-${m}`}>
                    <Text style={[st.tabText, mode === m && st.tabTextOn]}>{m === 'login' ? 'تسجيل دخول' : 'حساب جديد'}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {mode === 'login' ? (
              <>
                {phoneField()}
                {passwordField('كلمة السر', password, setPassword, 'password', login)}
                <MainButton title="دخول" onPress={login} busy={busy} disabled={phone.length !== 8 || !password} testID="login" />
                <Pressable onPress={() => go('forgot')} hitSlop={8} accessibilityRole="button" style={st.row} testID="to-forgot">
                  <Text style={st.link}>نسيت كلمة السر؟</Text>
                </Pressable>
              </>
            ) : mode === 'signup' ? (
              <>
                <Text style={st.label}>الاسم</Text>
                <TextInput testID="name" value={name} onChangeText={(v) => setName(v.slice(0, 80))} autoComplete="name" textContentType="name"
                  placeholder="اسمك" placeholderTextColor={colors.placeholder} returnKeyType="next" style={[st.input, st.rtl]} />
                {phoneField()}
                {passwordField('كلمة السر', password, setPassword, 'password')}
                <Text style={st.hint}>8 أحرف على الأقل، فيها حروف وأرقام</Text>
                {passwordField('تأكيد كلمة السر', password2, setPassword2, 'password2', signup)}
                <ConsentCheckbox docs={terms.docs} checked={agreed} onChange={setAgreed} />
                <MainButton title="إنشاء الحساب" onPress={signup} busy={busy}
                  disabled={name.trim().length < 2 || phone.length !== 8 || !password || !password2} testID="signup" />
                <Text style={st.note}>رقمك ما يظهر لأي أحد، ونحفظ كلمة السر مشفّرة.</Text>
              </>
            ) : mode === 'forgot' ? (
              <>
                {phoneField()}
                <Text style={st.label}>رمز الاستعادة</Text>
                <TextInput testID="recovery" value={recovery} onChangeText={(v) => setRecovery(cleanRecovery(v))} autoCapitalize="characters" autoCorrect={false}
                  autoComplete="off" placeholder="XXXXXX-XXXXXX-XXXXXX" placeholderTextColor={colors.placeholder} style={[st.input, st.ltr, st.mono]} />
                {passwordField('كلمة السر الجديدة', password, setPassword, 'password')}
                {passwordField('تأكيد كلمة السر الجديدة', password2, setPassword2, 'password2', reset)}
                <MainButton title="تغيير كلمة السر" onPress={reset} busy={busy} disabled={phone.length !== 8 || !recovery || !password || !password2} testID="reset" />
                <View style={st.info}>
                  <Icon name="shield-lock-outline" size={20} color={colors.link} />
                  <Text style={st.infoText}>لحماية حسابك ما نقدر نسترجعه برقم التلفون وحده. إذا ضاع رمز الاستعادة تواصل مع الدعم الفني من حساب آخر أو عبر «تواصل معنا».</Text>
                </View>
                <Pressable onPress={() => router.push('/contact')} hitSlop={8} accessibilityRole="button" style={st.row}><Text style={st.link}>تواصل معنا</Text></Pressable>
              </>
            ) : mode === 'saveCode' ? (
              <>
                <View style={st.codeBox} testID="recovery-code-box">
                  <Text selectable style={st.codeText} testID="recovery-code">{newCode}</Text>
                </View>
                <Pressable onPress={shareCode} accessibilityRole="button" style={st.secondary} testID="share-code">
                  <Icon name="share-variant-outline" size={20} color={colors.link} />
                  <Text style={st.link}>حفظ أو مشاركة الرمز</Text>
                </Pressable>
                <View style={[st.info, { backgroundColor: colors.warningBg }]}>
                  <Icon name="alert-outline" size={20} color={colors.warningText} />
                  <Text style={[st.infoText, { color: colors.warningText }]}>اكتبه أو صوّره واحفظه في مكان آمن. ما راح نعرضه مرة ثانية، ولا أحد من فريقنا يطلبه منك.</Text>
                </View>
                <Pressable onPress={() => setSaved(!saved)} accessibilityRole="checkbox" accessibilityState={{ checked: saved }} style={st.check} testID="saved-check">
                  <Icon name={saved ? 'checkbox-marked' : 'checkbox-blank-outline'} size={26} color={saved ? colors.primary : colors.muted} />
                  <Text style={{ flex: 1, fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 24, color: colors.text }}>حفظت رمز الاستعادة</Text>
                </Pressable>
                <MainButton title="ابدأ" onPress={() => run(() => finish(uid ?? '', 'أهلاً فيك في ماتعطل'))} busy={busy} disabled={!saved} testID="code-done" />
              </>
            ) : (
              <>
                <Text style={st.label}>البريد الإلكتروني</Text>
                <TextInput testID="email" value={email} onChangeText={(v) => setEmail(v.replace(/\s/g, '').slice(0, 120))} keyboardType="email-address" autoCapitalize="none"
                  autoCorrect={false} autoComplete="email" textContentType="emailAddress" placeholder="name@example.com" placeholderTextColor={colors.placeholder} style={[st.input, st.ltr]} />
                {passwordField('كلمة السر', password, setPassword, 'password', loginEmail)}
                <MainButton title="دخول" onPress={loginEmail} busy={busy} disabled={!email || !password} testID="login-email" />
              </>
            )}
          </View>

          {mode === 'login' ? (
            <Pressable onPress={() => go('email')} hitSlop={8} accessibilityRole="button" style={st.row} testID="to-email">
              <Text style={[st.link, { color: colors.muted }]}>عندك حساب قديم بالبريد؟</Text>
            </Pressable>
          ) : null}
          {mode === 'login' || mode === 'signup' ? (
            <Pressable onPress={() => router.push('/legal')} hitSlop={8} accessibilityRole="button" style={st.row}>
              <Text style={st.link}>الشروط والسياسات</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function MainButton({ title, onPress, busy, disabled, testID }: { title: string; onPress: () => void; busy: boolean; disabled?: boolean; testID: string }) {
  return (
    <Pressable onPress={onPress} disabled={busy || disabled} accessibilityRole="button" accessibilityLabel={title} testID={testID}
      style={({ pressed }) => [st.btn, (busy || disabled) && { opacity: 0.55 }, pressed && { opacity: 0.85 }]}>
      <LinearGradient colors={gradients.brand} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      {busy ? <ActivityIndicator color={colors.white} /> : <Text style={st.btnText}>{title}</Text>}
    </Pressable>
  );
}

const st = StyleSheet.create({
  hero: { paddingHorizontal: 22, paddingBottom: 56, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  back: { alignSelf: 'flex-start', width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brand: { color: '#fff', fontFamily: fonts.heavy, fontSize: 24, lineHeight: 38 },
  dot: { color: colors.accent },
  title: { color: '#fff', fontFamily: fonts.heavy, fontSize: 28, lineHeight: 42, marginTop: 12 },
  sub: { color: '#fff', opacity: 0.92, fontFamily: fonts.medium, fontSize: 16, lineHeight: 26 },
  card: { marginTop: -32, marginHorizontal: 16, padding: 20, borderRadius: radius.xl, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, ...shadow },
  tabs: { flexDirection: 'row', backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 4, marginBottom: 6 },
  tab: { flex: 1, height: 46, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.card, ...shadow, shadowOpacity: 0.08 },
  tabText: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 24, color: colors.muted },
  tabTextOn: { color: colors.link },
  label: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 24, color: colors.label, marginBottom: 8, marginTop: 14 },
  hint: { fontFamily: fonts.medium, fontSize: 13.5, lineHeight: 20, color: colors.muted, marginTop: 6 },
  phoneRow: { flexDirection: 'row', direction: 'ltr', gap: 8 },
  pwRow: { flexDirection: 'row', direction: 'ltr', alignItems: 'center' },
  eye: { position: 'absolute', right: 12, height: 58, width: 40, alignItems: 'center', justifyContent: 'center' },
  cc: { height: 58, paddingHorizontal: 14, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  ccText: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 24, color: colors.link },
  // حقل قياسي: إطار + خط واضح فقط
  input: { height: 58, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.inputBorder, backgroundColor: colors.input, paddingHorizontal: 16, fontSize: 19, color: colors.inputText, fontFamily: fonts.bold },
  ltr: { textAlign: 'left' },
  // يمنع الحقل من تجاوز البطاقة على الشاشات الصغيرة (عرض ذاتي للحقل في المتصفح)
  grow: { flex: 1, minWidth: 0, width: 0 },
  pwPad: { paddingRight: 52 },
  rtl: { textAlign: 'right', fontSize: 18 },
  mono: { fontSize: 17, letterSpacing: 1 },
  btn: { marginTop: 20, height: 56, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontFamily: fonts.bold, fontSize: 17, lineHeight: 26 },
  note: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: colors.muted, textAlign: 'center', marginTop: 12 },
  row: { alignItems: 'center', marginTop: 14 },
  link: { fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 24, color: colors.link },
  info: { flexDirection: 'row', gap: 10, marginTop: 16, padding: 12, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'flex-start' },
  infoText: { flex: 1, fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: colors.text },
  codeBox: { marginTop: 4, paddingVertical: 18, paddingHorizontal: 10, borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.primarySoft, alignItems: 'center' },
  codeText: { fontFamily: fonts.heavy, fontSize: 21, lineHeight: 32, letterSpacing: 1, color: colors.heading, textAlign: 'center' },
  secondary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', marginTop: 12, height: 48, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line },
  check: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
});
