import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SupportContacts } from '@/components/SupportContacts';
import { TicketRow } from '@/components/Support';
import { Button, Empty, ErrorBox, Loading, Screen, SectionTitle, Text } from '@/components/ui';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { arabicError } from '@/lib/utils';

export default function SupportList() {
  const { session } = useSession();
  const q = useQuery({ queryKey: ['tickets', 'mine', session?.user.id], queryFn: () => api.getMyTickets(session!.user.id), enabled: !!session, retry: false });
  return (
    <Screen edges={['bottom']}>
      <Text variant="muted">أرسل استفسارك أو المشكلة التقنية، وتابع الرد من هنا.</Text>
      {!session ? (
        <Empty icon="headset" title="سجّل دخولك لفتح طلب دعم" action={<Button title="تسجيل الدخول" onPress={() => router.push('/auth')} />} />
      ) : (
        <>
          <Button title="طلب دعم جديد" icon="plus" style={{ marginTop: 12 }} onPress={() => router.push('/support/new')} testID="support-new" />
          <SectionTitle title="طلباتي" />
          {q.isLoading ? <Loading /> : q.error ? <ErrorBox message={arabicError(q.error)} onRetry={q.refetch} /> : q.data?.length
            ? q.data.map((t) => <TicketRow key={t.id} t={t} onPress={() => router.push(`/support/${t.id}`)} />)
            : <Text variant="muted">لا توجد طلبات دعم.</Text>}
        </>
      )}
      <SupportContacts title="أو تواصل معنا مباشرة" message="السلام عليكم، أحتاج مساعدة في تطبيق ماتعطل" />
    </Screen>
  );
}
