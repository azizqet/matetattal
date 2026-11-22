// الدعم الفني: محادثة خاصة بين صاحب الطلب والإدارة (RLS في الخادم يمنع أي شخص آخر)
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import * as api from '@/lib/api';
import { colors } from '@/lib/theme';
import type { SupportMessage, SupportTicket } from '@/lib/types';
import { arabicError, TICKET_STATUS_AR } from '@/lib/utils';
import { Badge, Button, Card, Field, Icon, Loading, Row, Text, useToast } from './ui';

export const ticketTone = (s: string) => (s === 'resolved' ? 'green' : s === 'in_progress' ? 'blue' : 'yellow') as 'green';

export function TicketRow({ t, onPress }: { t: SupportTicket; onPress: () => void }) {
  return (
    <Card style={{ marginBottom: 10 }} onPress={onPress} testID={`ticket-${t.id}`}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text variant="title" style={{ flex: 1 }} numberOfLines={1}>{t.subject}</Text>
        <Badge label={TICKET_STATUS_AR[t.status]} tone={ticketTone(t.status)} />
      </Row>
      <Text variant="small">#{t.id} · آخر تحديث {new Date(t.last_message_at).toLocaleString('ar-KW')}</Text>
    </Card>
  );
}

function MessageImage({ path }: { path: string }) {
  const q = useQuery({ queryKey: ['support-img', path], queryFn: () => api.supportImageUrl(path), staleTime: 5 * 60_000 });
  if (!q.data) return null;
  return <Image source={{ uri: q.data }} style={{ width: 200, height: 150, borderRadius: 10, marginTop: 6 }} contentFit="cover" />;
}

export function Bubble({ m, mineSide }: { m: SupportMessage; mineSide: boolean }) {
  return (
    <View style={{ alignSelf: mineSide ? 'flex-start' : 'flex-end', maxWidth: '85%', marginBottom: 8 }}>
      <View style={{ backgroundColor: mineSide ? colors.primary : '#fff', borderRadius: 14, padding: 10, borderWidth: mineSide ? 0 : 1, borderColor: colors.line }}>
        <Text variant="small" style={{ color: mineSide ? '#DCE7FF' : colors.muted }}>{m.is_staff ? 'الدعم الفني' : 'المستخدم'}</Text>
        <Text style={{ color: mineSide ? '#fff' : colors.text }}>{m.body}</Text>
        {m.image_path ? <MessageImage path={m.image_path} /> : null}
      </View>
      <Text variant="small" style={{ marginTop: 2 }}>{new Date(m.created_at).toLocaleString('ar-KW')}</Text>
    </View>
  );
}

/** المحادثة + خانة الرد. asStaff = عرض لوحة الإدارة */
export function TicketThread({ ticket, uid, asStaff }: { ticket: SupportTicket; uid: string; asStaff?: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const msgs = useQuery({ queryKey: ['support-msgs', ticket.id], queryFn: () => api.getTicketMessages(ticket.id), refetchInterval: 20_000 });
  const [body, setBody] = useState('');
  const [img, setImg] = useState<{ uri: string; mime: string } | null>(null);
  const sending = useRef(false);
  const send = useMutation({
    mutationFn: async () => {
      const path = img ? await api.uploadSupportImage(ticket.user_id, ticket.id, img.uri, img.mime) : null;
      await api.sendSupportMessage(ticket.id, body, path);
    },
    onSuccess: () => { setBody(''); setImg(null); qc.invalidateQueries({ queryKey: ['support-msgs', ticket.id] }); qc.invalidateQueries({ queryKey: ['tickets'] }); },
    onError: (e) => toast(arabicError(e)),
    onSettled: () => { sending.current = false; },
  });
  async function pick() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!r.canceled && r.assets[0]) {
      if ((r.assets[0].fileSize ?? 0) > 5 * 1024 * 1024) return toast('الصورة كبيرة. الحد 5 ميجا');
      setImg({ uri: r.assets[0].uri, mime: r.assets[0].mimeType ?? 'image/jpeg' });
    }
  }
  return (
    <>
      {msgs.isLoading ? <Loading /> : (msgs.data ?? []).map((m) => <Bubble key={m.id} m={m} mineSide={asStaff ? m.is_staff : m.sender_id === uid} />)}
      <Card style={{ marginTop: 8 }}>
        {ticket.status === 'resolved' && !asStaff ? <Text variant="small">تم حل هذا الطلب. إذا كتبت رسالة جديدة يُعاد فتحه.</Text> : null}
        <Field label={asStaff ? 'الرد على المستخدم' : 'رسالتك'} value={body} onChangeText={setBody} multiline maxLength={3000} testID="support-body" />
        {img ? (
          <Row style={{ marginTop: 8 }}>
            <Image source={{ uri: img.uri }} style={{ width: 64, height: 64, borderRadius: 10 }} />
            <Button small kind="ghost" title="إزالة الصورة" onPress={() => setImg(null)} />
          </Row>
        ) : null}
        <Row style={{ marginTop: 10 }}>
          {!asStaff ? (
            <Pressable onPress={pick} accessibilityRole="button" accessibilityLabel="إرفاق صورة" style={{ padding: 10 }}>
              <Icon name="paperclip" />
            </Pressable>
          ) : null}
          <Button title="إرسال" icon="send" style={{ flex: 1 }} disabled={!body.trim()} loading={send.isPending} testID="support-send"
            onPress={() => { if (sending.current) return; sending.current = true; send.mutate(); }} />
        </Row>
      </Card>
    </>
  );
}
