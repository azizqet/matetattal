import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '@/components/CompanyCard';
import { Badge, Button, Card, Empty, Loading, Row, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';
import type { ServiceRequest } from '@/lib/types';
import { arabicError, REQUEST_STATUS_AR, whatsappUrl } from '@/lib/utils';
import { Linking } from 'react-native';

const tone = (s: string) => (s === 'done' ? 'green' : s === 'rejected' || s === 'cancelled' ? 'red' : s === 'new' ? 'yellow' : 'blue') as 'green';

export default function Requests() {
  const { session } = useSession();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['my-requests'], queryFn: () => api.getMyRequests(session!.user.id), enabled: !!session });
  const cancel = useMutation({
    mutationFn: (id: number) => api.setRequestStatus(id, 'cancelled'),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-requests'] }); toast('تم إلغاء الطلب'); },
    onError: (e) => toast(arabicError(e)),
  });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, width: '100%', maxWidth: 640, alignSelf: 'center' }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} />}>
        <Text variant="h1">طلباتي</Text>
        {!session ? (
          <Empty icon="clipboard-account-outline" title="سجّل دخولك لمتابعة طلباتك" subtitle="تقدر تتواصل مع أي شركة مباشرة بدون تسجيل."
            action={<Button title="تسجيل الدخول" onPress={() => router.push('/auth')} />} />
        ) : q.isLoading ? <Loading /> : !q.data?.length ? (
          <Empty icon="clipboard-text-outline" title="ما عندك طلبات" subtitle="اطلب خدمة من صفحة أي شركة وتابع حالتها هنا."
            action={<Button title="ابحث عن خدمة" onPress={() => router.push('/search')} />} />
        ) : q.data.map((r: ServiceRequest) => (
          <Card key={r.id} style={{ marginTop: 12 }} onPress={() => router.push(`/company/${r.company_id}`)}>
            <Row gap={12}>
              {r.companies ? <Logo c={{ name: r.companies.name, logo_url: r.companies.logo_url }} size={48} /> : null}
              <View style={{ flex: 1 }}>
                <Text variant="title" numberOfLines={1}>{r.companies?.name ?? 'شركة'}</Text>
                <Text variant="small">#{r.id} · {new Date(r.created_at).toLocaleString('ar-KW')}</Text>
              </View>
              <Badge label={REQUEST_STATUS_AR[r.status]} tone={tone(r.status)} />
            </Row>
            {r.note ? <Text variant="muted" style={{ marginTop: 8 }}>{r.note}</Text> : null}
            <Row style={{ marginTop: 10 }}>
              {r.companies?.whatsapp ? <Button small kind="whatsapp" icon="whatsapp" title="واتساب" style={{ flex: 1 }}
                onPress={() => Linking.openURL(whatsappUrl(r.companies!.whatsapp, `بخصوص طلبي رقم ${r.id} في ماتعطل`))} /> : null}
              {['new', 'accepted'].includes(r.status) ? <Button small kind="danger" title="إلغاء" style={{ flex: 1 }} loading={cancel.isPending && cancel.variables === r.id} onPress={() => cancel.mutate(r.id)} /> : null}
            </Row>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
