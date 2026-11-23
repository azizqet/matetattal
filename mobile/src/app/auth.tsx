// صفحة الدخول والتسجيل: البريد الإلكتروني + كلمة المرور (للعملاء والشركات). لا دخول برقم الهاتف ولا رسائل SMS.
// مبادئ ثابتة حتى تعمل الكتابة على الآيفون والأندرويد:
//  • TextInput قياسي مباشرة: بدون تغليف بعناصر ضغط، بدون حركات حوله، بدون writingDirection، بدون maxLength
//    (التنقية والحد في onChangeText)، وبدون مكوّنات تُعاد إنشاؤها مع كل حرف.
//  • التصفح لا يحتاج حساباً: هذه الصفحة تُفتح فقط عند إضافة إعلان أو طلب خدمة أو الدخول من «حسابي».
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConsentCheckbox, rememberRegistrationConsent, useRequiredTerms } from '@/components/Consent';
import { Icon, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors, fonts, gradients, radius, shadow } from '@/lib/theme';
import { arabicError } from '@/lib/utils';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** كلمة مرور الحساب الجديد: 8 خانات على الأقل وفيها حروف وأرقام */
export function passwordProblem(p: string): string | null {
  if (p.length < 8) return 'كلمة المرور 8 خانات على الأقل';
  if (!/\d/.test(p) || !/[^\d]/.test(p)) return 'كلمة المرور لازم فيها حروف وأرقام';
  return null;
}
const cleanEmail = (v: string) => v.replace(/\s/g, '').slice(0, 120);

type Mode = 'login' | 'register' | 'forgot';

export default function Auth() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { refreshProfile } = useSession();
  const terms = useRequiredTerms(['customers', 'privacy']);
  const [mode, setMode] = useState<Mode>(params.mode === 'register' ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);

  const switchMode = (m: Mode) => { setMode(m); setNotice(null); setPassword(''); setConfirm(''); };

  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await fn(); } catch (e) { toast(arabicError(e)); } finally { lock.current = false; setBusy(false); }
  }

  // المدير يرى لوحة الإدارة مباشرة — الصلاحية تُقرأ من قاعدة البيانات (profiles.role) والخادم يفرضها بـ RLS
  async function finish(userId: string) {
    const prof = await api.getMyProfile(userId).catch(() => null);
    await refreshProfile().catch(() => {});
    toast('أهلاً فيك');
    if (prof?.role === 'admin') { router.replace('/admin'); return; }
    if (router.canGoBack()) router.back(); else router.replace('/');
  }

  const submit = () => run(async () => {
    const em = email.trim().toLowerCase();
    if (!EMAIL_RE.test(em)) { toast('اكتب بريد إلكتروني صحيح'); return; }

    if (mode === 'forgot') {
      await api.sendPasswordReset(em);
      setNotice(`إذا كان ${em} مسجلاً عندنا، بيوصلك رابط لتعيين كلمة مرور جديدة. افتح الرابط من هذا الجوال.`);
      return;
    }

    if (mode === 'login') {
      if (!password) { toast('اكتب كلمة المرور'); return; }
      const user = await api.signInWithEmail(em, password);
      if (user) await finish(user.id);
      return;
    }

    // حساب جديد
    if (name.trim().length < 2) { toast('اكتب اسمك'); return; }
    const pw = passwordProblem(password);
    if (pw) { toast(pw); return; }
    if (password !== confirm) { toast('كلمتا المرور غير متطابقتين'); return; }
    if (terms.docs.length && !agreed) { toast('وافق على الشروط وسياسة الخصوصية للمتابعة'); return; }
    const r = await api.signUpWithEmail(em, password, name);
    if (r.exists) { toast('هذا البريد مسجل مسبقاً، سجّل دخولك'); switchMode('login'); return; }
    if (terms.docs.length) await rememberRegistrationConsent(terms.docs.map((d) => d.id));
    if (!r.needsConfirm && r.user) { await finish(r.user.id); return; }
    setMode('login'); setPassword(''); setConfirm('');
    setNotice(`أرسلنا رابط التفعيل إلى ${em}. افتح الرسالة واضغط الرابط، بعدها سجّل دخولك.`);
  });

  const back = () => {
    if (mode === 'forgot') { switchMode('login'); return; }
    if (router.canGoBack()) router.back(); else router.replace('/');
  };

  const titles: Record<Mode, [string, string]> = {
    login: ['حياك في ماتعطل', 'سجّل دخولك بالإيميل وكلمة المرور'],
    register: ['حساب جديد', 'حساب واحد لطلب الخدمات وإضافة الإعلانات'],
    forgot: ['نسيت كلمة المرور؟', 'اكتب إيميلك ونرسل لك رابط تعيين كلمة مرور جديدة'],
  };
  const action = { login: 'تسجيل الدخول', register: 'سوّ حسابي', forgot: 'أرسل الرابط' }[mode];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
          <LinearGradient colors={gradients.brand} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[st.hero, { paddingTop: insets.top + 12 }]}>
            <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel="رجوع" style={st.back} testID="auth-back">
              <Icon name="arrow-right" size={24} color={colors.white} />
            </Pressable>
            <Text style={st.brand}>ماتعطل<Text style={st.dot}>•</Text></Text>
            <Text style={st.title}>{titles[mode][0]}</Text>
            <Text style={st.sub}>{titles[mode][1]}</Text>
          </LinearGradient>

          <View style={st.card}>
            {mode !== 'forgot' ? (
              <View style={st.tabs}>
                {(['login', 'register'] as const).map((m) => (
                  <Pressable key={m} onPress={() => switchMode(m)} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}
                    style={[st.tab, mode === m && st.tabOn]} testID={`tab-${m}`}>
                    <Text style={[st.tabText, mode === m && st.tabTextOn]}>{m === 'login' ? 'تسجيل الدخول' : 'حساب جديد'}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {notice ? <Text style={st.notice} testID="auth-notice">{notice}</Text> : null}

            {mode === 'register' ? (
              <>
                <Text style={st.label}>الاسم</Text>
                <TextInput testID="name" value={name} onChangeText={(v) => setName(v.slice(0, 80))} autoComplete="name" textContentType="name"
                  placeholder="اسمك أو اسم شركتك" placeholderTextColor={colors.placeholder} returnKeyType="next" style={[st.input, st.rtl]} />
              </>
            ) : null}

            <Text style={[st.label, mode === 'register' && st.gap]}>البريد الإلكتروني</Text>
            <TextInput testID="email" value={email} onChangeText={(v) => setEmail(cleanEmail(v))} keyboardType="email-address"
              autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType={mode === 'register' ? 'emailAddress' : 'username'}
              placeholder="name@example.com" placeholderTextColor={colors.placeholder} returnKeyType={mode === 'forgot' ? 'send' : 'next'}
              onSubmitEditing={mode === 'forgot' ? submit : undefined} style={[st.input, st.ltr]} />

            {mode !== 'forgot' ? (
              <>
                <Text style={[st.label, st.gap]}>كلمة المرور</Text>
                <TextInput testID="password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'} textContentType={mode === 'register' ? 'newPassword' : 'password'}
                  placeholder={mode === 'register' ? '8 خانات، حروف وأرقام' : '••••••••'} placeholderTextColor={colors.placeholder}
                  returnKeyType={mode === 'login' ? 'go' : 'next'} onSubmitEditing={mode === 'login' ? submit : undefined} style={[st.input, st.ltr]} />
              </>
            ) : null}

            {mode === 'register' ? (
              <>
                <Text style={[st.label, st.gap]}>تأكيد كلمة المرور</Text>
                <TextInput testID="confirm" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoCorrect={false}
                  autoComplete="new-password" textContentType="newPassword" placeholderTextColor={colors.placeholder}
                  returnKeyType="done" style={[st.input, st.ltr]} />
                <ConsentCheckbox docs={terms.docs} checked={agreed} onChange={setAgreed} />
              </>
            ) : null}

            <MainButton title={action} onPress={submit} busy={busy} testID="submit" />

            {mode === 'login' ? (
              <Pressable onPress={() => switchMode('forgot')} hitSlop={8} accessibilityRole="button" style={st.row} testID="forgot">
                <Text style={st.link}>نسيت كلمة المرور؟</Text>
              </Pressable>
            ) : mode === 'forgot' ? (
              <Pressable onPress={() => switchMode('login')} hitSlop={8} accessibilityRole="button" style={st.row}>
                <Text style={st.link}>رجوع لتسجيل الدخول</Text>
              </Pressable>
            ) : null}
            <Text style={st.note}>بياناتك ما تظهر لأي أحد. تقدر تتصفح الخدمات والشركات بدون حساب.</Text>
          </View>

          <Pressable onPress={() => router.push('/legal')} hitSlop={8} accessibilityRole="button" style={st.row}>
            <Text style={st.link}>الشروط والسياسات</Text>
          </Pressable>
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
  label: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 24, color: colors.label, marginBottom: 8 },
  // حقل قياسي: إطار + خط واضح فقط
  input: { height: 56, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.inputBorder, backgroundColor: colors.input, paddingHorizontal: 16, fontSize: 17, color: colors.inputText, fontFamily: fonts.bold },
  ltr: { textAlign: 'left' },
  rtl: { textAlign: 'right', fontSize: 18 },
  gap: { marginTop: 14 },
  tabs: { flexDirection: 'row', backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 4, marginBottom: 16 },
  tab: { flex: 1, height: 44, borderRadius: radius.md - 2, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.card, ...shadow },
  tabText: { fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 24, color: colors.muted },
  tabTextOn: { color: colors.link },
  notice: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 24, color: colors.heading, backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 12, marginBottom: 12 },
  btn: { marginTop: 18, height: 56, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontFamily: fonts.bold, fontSize: 17, lineHeight: 26 },
  note: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 22, color: colors.muted, textAlign: 'center', marginTop: 12 },
  row: { alignItems: 'center', marginTop: 14 },
  link: { fontFamily: fonts.bold, fontSize: 15.5, lineHeight: 24, color: colors.link },
});
