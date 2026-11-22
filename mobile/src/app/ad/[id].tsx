import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView } from 'react-native';
import { AdForm, adTone } from '@/components/Ads';
import { Badge, Button, Card, Empty, Loading, Row, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { useServiceNames } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';
import { AD_STATUS_AR, arabicError, formatKwd, telUrl, whatsappUrl } from '@/lib/utils';

export default function AdScreen() {
  const id = Number(useLocalSearchParams<{ id: string }>().id);
  const { session } = useSession();
  const names = useServiceNames();
  const toast = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const q = useQuery({ queryKey: ['ad', id], queryFn: () => api.getAd(id), enabled: Number.isFinite(id), retry: false });
  const del = useMutation({
    mutationFn: () => api.deleteAd(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-ads'] }); qc.invalidateQueries({ queryKey: ['ads'] }); toast('تم حذف الإعلان'); router.back(); },
    onError: (e) => toast(arabicError(e)),
  });
  const [confirmDel, setConfirmDel] = useState(false);

  if (q.isLoading) return <Loading />;
  const ad = q.data;
  if (!ad) return <Empty icon="bullhorn-outline" title="الإعلان غير متاح" subtitle="قد يكون بانتظار الموافقة أو تم إيقافه" />;
  const mine = session?.user.id === ad.owner_id;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 48, width: '100%', maxWidth: 640, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'الإعلان' }} />
      {editing && session ? (
        <AdForm uid={session.user.id} ad={ad} onSaved={() => {
          setEditing(false); qc.invalidateQueries({ queryKey: ['ad', id] }); qc.invalidateQueries({ queryKey: ['my-ads'] });
          toast('تم الحفظ. الإعلان بانتظار المراجعة');
        }} />
      ) : (
        <>
          {ad.images.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {ad.images.map((u) => <Image key={u} source={{ uri: u }} style={{ width: 260, height: 190, borderRadius: 16 }} contentFit="cover" />)}
            </ScrollView>
          ) : null}
          <Card style={{ marginTop: 12 }}>
            {mine ? <Row style={{ marginBottom: 6 }}><Badge label={AD_STATUS_AR[ad.status]} tone={adTone(ad.status)} /></Row> : null}
            <Text variant="h1" style={{ fontSize: 22 }}>{ad.title}</Text>
            <Text variant="muted">{[names[ad.service_id], ad.area_name].filter(Boolean).join(' · ')}</Text>
            {ad.price != null ? <Text style={{ fontFamily: fonts.heavy, fontSize: 20, color: colors.primary, marginTop: 4 }}>{formatKwd(ad.price)}</Text> : null}
            <Text style={{ marginTop: 10 }}>{ad.description}</Text>
            {mine && ad.status === 'rejected' && ad.reject_reason ? <Text variant="small" style={{ color: colors.danger, marginTop: 8 }}>سبب الرفض: {ad.reject_reason}</Text> : null}
          </Card>
          <Row style={{ marginTop: 12 }}>
            <Button title="اتصال" icon="phone" style={{ flex: 1 }} onPress={() => Linking.openURL(telUrl(ad.phone)).catch(() => {})} testID="ad-call" />
            <Button title="واتساب" icon="whatsapp" kind="whatsapp" style={{ flex: 1 }} onPress={() => Linking.openURL(whatsappUrl(ad.phone, `السلام عليكم، بخصوص إعلانك «${ad.title}» في ماتعطل`)).catch(() => {})} testID="ad-wa" />
          </Row>
          {mine ? (
            <>
              <Button title="تعديل الإعلان" kind="soft" icon="pencil" style={{ marginTop: 10 }} onPress={() => setEditing(true)} />
              {!confirmDel ? <Button title="حذف الإعلان" kind="ghost" icon="delete-outline" onPress={() => setConfirmDel(true)} /> : (
                <Row style={{ marginTop: 6 }}>
                  <Button title="تأكيد الحذف" kind="danger" style={{ flex: 1 }} loading={del.isPending} onPress={() => del.mutate()} />
                  <Button title="تراجع" kind="soft" style={{ flex: 1 }} onPress={() => setConfirmDel(false)} />
                </Row>
              )}
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}
