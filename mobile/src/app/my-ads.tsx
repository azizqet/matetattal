import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { AdCard } from '@/components/Ads';
import { Button, Empty, ErrorBox, Loading, Screen } from '@/components/ui';
import * as api from '@/lib/api';
import { useServiceNames } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { arabicError } from '@/lib/utils';

export default function MyAds() {
  const { session } = useSession();
  const names = useServiceNames();
  const q = useQuery({ queryKey: ['my-ads', session?.user.id], queryFn: () => api.getMyAds(session!.user.id), enabled: !!session, retry: false });
  if (!session) return <Empty icon="bullhorn-outline" title="سجّل دخولك" action={<Button title="تسجيل الدخول" onPress={() => router.push('/auth')} />} />;
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox message={arabicError(q.error)} onRetry={q.refetch} />;
  return (
    <Screen edges={['bottom']}>
      {q.data?.length ? q.data.map((a) => <AdCard key={a.id} ad={a} serviceName={names[a.service_id]} showStatus />) : (
        <Empty icon="bullhorn-outline" title="ما عندك إعلانات" action={<Button title="أضف إعلان" icon="plus" onPress={() => router.push('/add')} />} />
      )}
    </Screen>
  );
}
