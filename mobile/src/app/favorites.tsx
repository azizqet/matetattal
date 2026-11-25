import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CompanyCard } from '@/components/CompanyCard';
import { Button, Empty, Loading, Screen } from '@/components/ui';
import * as api from '@/lib/api';
import { useCompanies, useServiceNames } from '@/lib/queries';
import { useSession } from '@/lib/session';

export default function Favorites() {
  const { session } = useSession();
  const favs = useQuery({ queryKey: ['favorites'], queryFn: api.getFavorites, enabled: !!session });
  const companies = useCompanies();
  const names = useServiceNames();
  if (favs.isLoading || companies.isLoading) return <Loading />;
  const list = (companies.data ?? []).filter((c) => favs.data?.includes(c.id));
  return (
    <Screen edges={['bottom']}>
      {list.length ? list.map((c) => <CompanyCard key={c.id} c={c} serviceName={names[c.service_id ?? '']} />) : (
        <Empty icon="heart-outline" title="ما عندك مفضلة" subtitle="اضغط ♥ في صفحة أي شركة لحفظها هنا"
          action={<Button title="تصفح الشركات" onPress={() => router.push('/search')} />} />
      )}
    </Screen>
  );
}
