import { SafeAreaView } from 'react-native-safe-area-context';
import { CompanyList } from '@/components/CompanyList';
import { Text } from '@/components/ui';
import { colors } from '@/lib/theme';

export default function Search() {
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Text variant="h1" style={{ paddingHorizontal: 16, paddingTop: 8, width: '100%', maxWidth: 640, alignSelf: 'center' }}>البحث</Text>
      <CompanyList />
    </SafeAreaView>
  );
}
