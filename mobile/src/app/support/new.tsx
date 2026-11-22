import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { Button, Field, Row, Screen, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { arabicError } from '@/lib/utils';

export default function NewTicket() {
  const { session } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [img, setImg] = useState<{ uri: string; mime: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  async function pick() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled && r.assets[0]) {
      if ((r.assets[0].fileSize ?? 0) > 5 * 1024 * 1024) return toast('الصورة كبيرة. الحد 5 ميجا');
      setImg({ uri: r.assets[0].uri, mime: r.assets[0].mimeType ?? 'image/jpeg' });
    }
  }
  async function submit() {
    if (!session) return router.push('/auth');
    if (subject.trim().length < 3) return toast('اكتب عنوان الطلب');
    if (body.trim().length < 5) return toast('اكتب التفاصيل');
    if (sending.current) return;
    sending.current = true; setBusy(true);
    try {
      const t = await api.openTicket(subject);
      const path = img ? await api.uploadSupportImage(session.user.id, t.id, img.uri, img.mime) : null;
      await api.sendSupportMessage(t.id, body, path);
      qc.invalidateQueries({ queryKey: ['tickets'] });
      toast('وصل طلبك للدعم الفني');
      router.replace(`/support/${t.id}`);
    } catch (e) { toast(arabicError(e)); sending.current = false; } finally { setBusy(false); }
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
      <Screen edges={['bottom']}>
        <Field label="عنوان الطلب" value={subject} onChangeText={setSubject} maxLength={120} placeholder="مثال: ما يوصلني رمز التحقق" testID="ticket-subject" />
        <Field label="التفاصيل" value={body} onChangeText={setBody} multiline maxLength={3000} testID="ticket-body" />
        <Row style={{ marginTop: 12 }}>
          <Button small kind="soft" icon="image-plus" title={img ? 'تغيير الصورة' : 'إرفاق صورة'} onPress={pick} />
          {img ? <Image source={{ uri: img.uri }} style={{ width: 56, height: 56, borderRadius: 10 }} /> : null}
        </Row>
        <Text variant="small" style={{ marginTop: 8 }}>طلبك خاص بينك وبين إدارة ماتعطل فقط.</Text>
        <Button title="إرسال" icon="send" loading={busy} onPress={submit} style={{ marginTop: 16 }} testID="ticket-submit" />
      </Screen>
    </KeyboardAvoidingView>
  );
}
