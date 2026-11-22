import { Stack, useLocalSearchParams } from 'expo-router';
import { CompanyList } from '@/components/CompanyList';
import { useServiceNames } from '@/lib/queries';

export default function ServiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const names = useServiceNames();
  return (
    <>
      <Stack.Screen options={{ title: names[id] ?? 'الخدمة' }} />
      <CompanyList fixedService={id} />
    </>
  );
}
