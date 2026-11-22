import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Chip, Field, Row, Screen, Text, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { arabicError } from '@/lib/utils';

export default function Auth() {
  const params = useLocalSearchParams<{ mode?: string; type?: string }>();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(params.mode === 'register' ? 'register' : 'login');
  const [type, setType] = useState<'customer' | 'company'>(params.type === 'company' ? 'company' : 'customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  const done = () => {
    if (router.canGoBack()) router.back(); else router.replace('/');
    if (type === 'company' && mode === 'register') setTimeout(() => router.push('/business'), 50);
  };

  async function submit() {
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return toast('اكتب إيميل صحيح');
    if (mode !== 'reset' && password.length < 6) return toast('كلمة السر 6 أحرف على الأقل');
    if (mode === 'register' && name.trim().length < 2) return toast('اكتب اسمك');
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password });
        if (error) throw error;
        toast('أهلاً بك');
        done();
      } else if (mode === 'register') {
        const { data, error } = await supabase.auth.signUp({ email: em, password, options: { data: { full_name: name.trim(), account_type: type } } });
        if (error) throw error;
        if (data.session) { toast('تم إنشاء حسابك'); done(); }
        else { toast('أرسلنا رابط التفعيل إلى بريدك. فعّل الحساب ثم سجّل الدخول'); setMode('login'); }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(em);
        if (error) throw error;
        toast('أرسلنا رابط إعادة تعيين كلمة السر إلى بريدك');
        setMode('login');
      }
    } catch (e) {
      toast(arabicError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        <Text variant="h1">{mode === 'login' ? 'تسجيل الدخول' : mode === 'register' ? 'حساب جديد' : 'نسيت كلمة السر'}</Text>
        <Text variant="muted">{mode === 'register' ? 'سجّل لطلب الخدمات ومتابعتها، أو لإدارة شركتك.' : 'ادخل لحسابك في ماتعطل.'}</Text>

        {mode === 'register' ? (
          <>
            <Text variant="label" style={{ marginTop: 16 }}>نوع الحساب</Text>
            <Row>
              <Chip label="عميل" icon="account" active={type === 'customer'} onPress={() => setType('customer')} />
              <Chip label="مقدم خدمة / شركة" icon="store" active={type === 'company'} onPress={() => setType('company')} />
            </Row>
            <Field label={type === 'company' ? 'اسمك (المسؤول)' : 'الاسم'} value={name} onChangeText={setName} autoComplete="name" maxLength={80} />
          </>
        ) : null}
        <Field label="الإيميل" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" testID="email" />
        {mode !== 'reset' ? (
          <Field label="كلمة السر" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'login' ? 'current-password' : 'new-password'} testID="password" />
        ) : null}

        <Button title={mode === 'login' ? 'دخول' : mode === 'register' ? 'إنشاء الحساب' : 'إرسال الرابط'} loading={busy} onPress={submit} style={{ marginTop: 20 }} testID="auth-submit" />

        {mode === 'login' ? (
          <>
            <Button title="ما عندك حساب؟ سجّل الآن" kind="ghost" onPress={() => setMode('register')} style={{ marginTop: 8 }} />
            <Button title="نسيت كلمة السر" kind="ghost" small onPress={() => setMode('reset')} />
          </>
        ) : (
          <Button title="عندك حساب؟ سجّل الدخول" kind="ghost" onPress={() => setMode('login')} style={{ marginTop: 8 }} />
        )}
        <Text variant="small" style={{ textAlign: 'center', marginTop: 16 }}>
          بالتسجيل أنت توافق على شروط الاستخدام وسياسة الخصوصية لتطبيق ماتعطل.
        </Text>
      </Screen>
    </KeyboardAvoidingView>
  );
}
