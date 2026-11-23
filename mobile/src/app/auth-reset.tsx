import * as Linking from 'expo-linking';
import { useRef, useState } from 'react';
import { Button, Card, Field, Screen, Text, useToast } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { arabicError } from '@/lib/utils';

/** استعادة كلمة المرور لأصحاب الحسابات القديمة بالبريد الإلكتروني */
export default function AuthReset() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const lock = useRef(false);
  async function send() {
    const em = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return toast('اكتب بريداً إلكترونياً صحيحاً');
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(em, { redirectTo: Linking.createURL('auth-callback') });
      if (error) throw error;
      setSent(true);
    } catch (e) { toast(arabicError(e)); } finally { lock.current = false; setBusy(false); }
  }
  return (
    <Screen edges={['bottom']}>
      <Text variant="h1">نسيت كلمة المرور</Text>
      <Text variant="muted">للحسابات القديمة المسجلة بالبريد. نرسل لك رابطاً لتعيين كلمة مرور جديدة.</Text>
      {sent ? (
        <Card style={{ marginTop: 14, backgroundColor: colors.primarySoft, borderColor: colors.primarySoft }} testID="reset-sent">
          <Text style={{ color: colors.heading }}>إذا كان البريد مسجلاً لدينا، وصلتك رسالة فيها الرابط. افتحه من هذا الجوال.</Text>
        </Card>
      ) : null}
      <Field label="البريد الإلكتروني" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"
        style={{ writingDirection: 'ltr', textAlign: 'left', color: colors.inputText }} testID="reset-email" />
      <Button title="إرسال رابط إعادة التعيين" icon="email-fast-outline" loading={busy} onPress={send} style={{ marginTop: 18 }} testID="reset-send" />
    </Screen>
  );
}
