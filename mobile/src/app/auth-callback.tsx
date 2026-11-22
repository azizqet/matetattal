import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Empty, Field, Loading, Screen, Text, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { arabicError } from '@/lib/utils';

/** يقرأ معاملات رابط Supabase من الجزء بعد # أو ? */
export function parseAuthUrl(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const parts = [url.split('?')[1]?.split('#')[0], url.split('#')[1]].filter(Boolean) as string[];
  for (const p of parts) for (const kv of p.split('&')) {
    const [k, v = ''] = kv.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return out;
}

/** وجهة روابط البريد: تأكيد الحساب أو إعادة تعيين كلمة المرور */
export default function AuthCallback() {
  const url = Linking.useURL();
  const toast = useToast();
  const [state, setState] = useState<'loading' | 'confirmed' | 'recovery' | 'error'>('loading');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (!url || handled.current) return;
    handled.current = true;
    (async () => {
      const q = parseAuthUrl(url);
      try {
        if (q.error_description || q.error) throw new Error(q.error_description || q.error);
        if (q.code) {
          const { error: e } = await supabase.auth.exchangeCodeForSession(q.code);
          if (e) throw e;
        } else if (q.access_token && q.refresh_token) {
          const { error: e } = await supabase.auth.setSession({ access_token: q.access_token, refresh_token: q.refresh_token });
          if (e) throw e;
        } else throw new Error('الرابط غير صالح أو انتهت صلاحيته');
        setState(q.type === 'recovery' ? 'recovery' : 'confirmed');
      } catch (e) { setError(arabicError(e)); setState('error'); }
    })();
  }, [url]);

  async function save() {
    if (password.length < 8 || !/\d/.test(password)) return toast('كلمة المرور 8 أحرف على الأقل وفيها أرقام');
    if (password !== confirm) return toast('كلمتا المرور غير متطابقتين');
    setBusy(true);
    try {
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) throw e;
      toast('تم تغيير كلمة المرور');
      router.replace('/account');
    } catch (e) { toast(arabicError(e)); } finally { setBusy(false); }
  }

  if (state === 'loading') return <Loading label="جاري التحقق من الرابط..." />;
  if (state === 'error') return <Empty icon="link-off" title="تعذّر فتح الرابط" subtitle={error} action={<Button title="تسجيل الدخول" onPress={() => router.replace('/auth')} />} />;
  if (state === 'confirmed') return <Empty icon="check-circle-outline" title="تم تفعيل حسابك" subtitle="أهلاً بك في ماتعطل" action={<Button title="ابدأ" onPress={() => router.replace('/')} />} />;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen edges={['bottom']}>
        <Text variant="h1">كلمة مرور جديدة</Text>
        <Field label="كلمة المرور الجديدة" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="new-password"
          style={{ writingDirection: 'ltr', textAlign: 'left', color: '#000' }} testID="new-password" />
        <Field label="تأكيد كلمة المرور" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" autoComplete="new-password"
          style={{ writingDirection: 'ltr', textAlign: 'left', color: '#000' }} testID="new-password-confirm" />
        <Button title="حفظ كلمة المرور" loading={busy} onPress={save} style={{ marginTop: 18 }} testID="save-password" />
      </Screen>
    </KeyboardAvoidingView>
  );
}
