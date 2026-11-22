import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { ConsentCheckbox, rememberRegistrationConsent, useRequiredTerms } from '@/components/Consent';
import { Button, Card, Chip, Field, Row, Screen, Text, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { arabicError } from '@/lib/utils';

type Mode = 'login' | 'register' | 'reset';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ltr = { writingDirection: 'ltr' as const, textAlign: 'left' as const, color: colors.inputText };

/**
 * حساب موحد بالبريد الإلكتروني وكلمة المرور عبر Supabase Auth (عميل / مقدم خدمة / معلن).
 * لا موافقة من المالك على التسجيل. الحساب يُعتبر مفعّلاً فقط بعد تأكيد البريد (إن كان التأكيد مفعّلاً في Supabase).
 */
export default function Auth() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const toast = useToast();
  const terms = useRequiredTerms(['customers', 'privacy']);
  const [mode, setMode] = useState<Mode>(params.mode === 'register' ? 'register' : 'login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const lock = useRef(false);

  const done = () => { if (router.canGoBack()) router.back(); else router.replace('/'); };
  const switchMode = (m: Mode) => { setMode(m); setNotice(null); setPassword(''); setConfirm(''); };

  async function run(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await fn(); } catch (e) { toast(arabicError(e)); } finally { lock.current = false; setBusy(false); }
  }

  const submit = () => run(async () => {
    const em = email.trim().toLowerCase();
    if (!EMAIL.test(em)) { toast('اكتب بريداً إلكترونياً صحيحاً'); return; }
    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: Linking.createURL('auth-callback') });
      if (error) throw error;
      setNotice('إذا كان البريد مسجلاً لدينا، وصلتك رسالة فيها رابط لتعيين كلمة مرور جديدة. افتح الرابط من هذا الجوال.');
      return;
    }
    if (password.length < 8) { toast('كلمة المرور 8 أحرف على الأقل'); return; }
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: em, password });
      if (error) throw error;
      toast('أهلاً بك'); done(); return;
    }
    // إنشاء حساب
    if (name.trim().length < 2) { toast('اكتب اسمك'); return; }
    if (password !== confirm) { toast('كلمتا المرور غير متطابقتين'); return; }
    if (!/[A-Za-z؀-ۿ]/.test(password) || !/\d/.test(password)) { toast('كلمة المرور لازم تحتوي حروفاً وأرقاماً'); return; }
    if (terms.docs.length && !agreed) { toast('وافق على الشروط وسياسة الخصوصية للمتابعة'); return; }
    const { data, error } = await supabase.auth.signUp({
      email: em, password,
      options: { data: { full_name: name.trim().slice(0, 80) }, emailRedirectTo: Linking.createURL('auth-callback') },
    });
    if (error) throw error;
    // Supabase لا يكشف وجود البريد: يرجع مستخدماً بلا هويات إذا كان البريد مسجلاً مسبقاً
    if (data.user && (data.user.identities?.length ?? 0) === 0) { toast('هذا البريد مسجل مسبقاً، سجّل الدخول'); switchMode('login'); return; }
    if (terms.docs.length) await rememberRegistrationConsent(terms.docs.map((d) => d.id));
    // الدخول الفوري: عند إيقاف «تأكيد البريد» في Supabase تعود الجلسة مباشرة فينتقل المستخدم للرئيسية
    if (data.session) { toast('أهلاً بك في ماتعطل'); router.replace('/'); return; }
    setNotice(`أرسلنا رابط التفعيل إلى ${em}. افتح الرسالة واضغط الرابط، ثم سجّل الدخول. لا يمكن الدخول قبل تفعيل البريد.`);
    setMode('login'); setPassword(''); setConfirm('');
  });

  const title = mode === 'login' ? 'تسجيل الدخول' : mode === 'register' ? 'إنشاء حساب جديد' : 'نسيت كلمة المرور';
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <Screen edges={['bottom']}>
        {mode !== 'reset' ? (
          <Row style={{ marginBottom: 8 }}>
            <Chip label="تسجيل الدخول" active={mode === 'login'} onPress={() => switchMode('login')} />
            <Chip label="إنشاء حساب جديد" active={mode === 'register'} onPress={() => switchMode('register')} />
          </Row>
        ) : null}
        <Text variant="h1">{title}</Text>
        <Text variant="muted">
          {mode === 'register' ? 'حساب واحد لطلب الخدمات وإضافة الإعلانات والتواصل مع الدعم الفني.' : mode === 'reset' ? 'اكتب بريدك ونرسل لك رابط تعيين كلمة مرور جديدة.' : 'ادخل بالبريد الإلكتروني وكلمة المرور.'}
        </Text>

        {notice ? (
          <Card style={{ marginTop: 12, backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }} testID="auth-notice">
            <Text style={{ color: colors.heading }}>{notice}</Text>
          </Card>
        ) : null}

        {mode === 'register' ? <Field label="الاسم" value={name} onChangeText={setName} autoComplete="name" maxLength={80} testID="auth-name" /> : null}
        <Field label="البريد الإلكتروني" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          autoComplete="email" textContentType="emailAddress" style={ltr} testID="email" />
        {mode !== 'reset' ? (
          <Field label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'} textContentType={mode === 'login' ? 'password' : 'newPassword'} style={ltr} testID="password" />
        ) : null}
        {mode === 'register' ? (
          <>
            <Field label="تأكيد كلمة المرور" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoComplete="new-password"
              textContentType="newPassword" style={ltr} testID="password-confirm" />
            <Text variant="small" style={{ marginTop: 4 }}>8 أحرف على الأقل، فيها حروف وأرقام.</Text>
            <ConsentCheckbox docs={terms.docs} checked={agreed} onChange={setAgreed} />
          </>
        ) : null}

        <Button title={mode === 'login' ? 'دخول' : mode === 'register' ? 'إنشاء الحساب' : 'إرسال رابط إعادة التعيين'} loading={busy} onPress={submit}
          style={{ marginTop: 20 }} testID="auth-submit" />
        <View style={{ marginTop: 8 }}>
          {mode === 'login' ? <Button title="نسيت كلمة المرور؟" kind="ghost" small onPress={() => switchMode('reset')} testID="auth-forgot" /> : null}
          {mode === 'reset' ? <Button title="الرجوع لتسجيل الدخول" kind="ghost" small onPress={() => switchMode('login')} /> : null}
        </View>
        <Button title="الشروط والسياسات" kind="ghost" small icon="file-document-outline" style={{ marginTop: 12 }} onPress={() => router.push('/legal')} />
      </Screen>
    </KeyboardAvoidingView>
  );
}
