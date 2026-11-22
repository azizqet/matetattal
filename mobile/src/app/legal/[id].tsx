import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Card, Empty, Screen, Text } from '@/components/ui';
import { getLegalDoc } from '@/content/legal';
import { colors, fonts } from '@/lib/theme';

export default function LegalDocScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const doc = getLegalDoc(id);
  if (!doc) return <Empty icon="file-remove-outline" title="الوثيقة غير موجودة" />;
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: doc.title }} />
      {doc.status === 'draft' ? (
        <View style={{ backgroundColor: colors.warningBg, borderRadius: 12, padding: 12, marginBottom: 12 }} testID="legal-draft-banner">
          <Text style={{ color: colors.warningText, fontFamily: fonts.bold }}>مسودة — غير نافذة بعد</Text>
          <Text variant="small" style={{ color: colors.warningText }}>هذه النسخة بانتظار المراجعة القانونية واعتماد الإدارة.</Text>
        </View>
      ) : null}
      <Text variant="h1" style={{ fontSize: 22 }}>{doc.title}</Text>
      <Text variant="small">الإصدار {doc.version}{doc.effectiveDate ? ` · سارية من ${doc.effectiveDate}` : ''}</Text>
      {doc.sections.map((s, i) => (
        <Card key={`${doc.id}-${i}`} style={{ marginTop: 12 }}>
          <Text variant="title">{i + 1}. {s.title}</Text>
          {s.body.map((p, j) => <Text key={j} style={{ marginTop: 6 }}>• {p}</Text>)}
        </Card>
      ))}
    </Screen>
  );
}
