import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Button, Field, Screen, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { arabicError } from '@/lib/utils';

export default function Complaint() {
  const { company } = useLocalSearchParams<{ company?: string }>();
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    if (subject.trim().length < 3) return toast('اكتب عنواناً (3 أحرف على الأقل)');
    if (body.trim().length < 5) return toast('اكتب التفاصيل');
    setBusy(true);
    try {
      await api.createComplaint({ company_id: company ? Number(company) : null, subject: subject.trim(), body: body.trim() });
      toast('وصلتنا رسالتك، شكراً لك');
      router.back();
    } catch (e) { toast(arabicError(e)); } finally { setBusy(false); }
  }

  return (
    <Screen edges={['bottom']}>
      <Text variant="muted">رسالتك تصل للإدارة مباشرة وتتم مراجعتها بسرية.</Text>
      <Field label="العنوان" value={subject} onChangeText={setSubject} maxLength={120} />
      <Field label="التفاصيل" value={body} onChangeText={setBody} multiline maxLength={2000} />
      <Button title="إرسال" icon="send" loading={busy} onPress={send} style={{ marginTop: 18 }} />
    </Screen>
  );
}
