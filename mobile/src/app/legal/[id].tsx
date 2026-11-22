import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { TermsBody } from '@/components/Consent';
import { Card, Empty, Loading, Screen, Text } from '@/components/ui';
import { getLegalDoc } from '@/content/legal';
import * as api from '@/lib/api';
import { colors, fonts } from '@/lib/theme';
import type { TermsKind } from '@/lib/types';

// النسخة المنشورة في قاعدة البيانات (النافذة) لها الأولوية. إن لم تُنشر بعد تُعرض المسودة المضمّنة مع تنبيه.
export default function LegalDocScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const draft = getLegalDoc(id);
  const published = useQuery({ queryKey: ['terms', 'current', id], queryFn: () => api.getCurrentTerms([id as TermsKind]), enabled: !!draft });
  if (!draft) return <Empty icon="file-remove-outline" title="الوثيقة غير موجودة" />;
  if (published.isLoading) return <Loading />;
  const doc = published.data?.[0];
  if (doc) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: doc.title }} />
        <Text variant="h1" style={{ fontSize: 22 }}>{doc.title}</Text>
        <Text variant="small" testID="legal-published">
          الإصدار {doc.version}{doc.published_at ? ` · سارية من ${new Date(doc.published_at).toLocaleDateString('ar-KW')}` : ''}
        </Text>
        <Card style={{ marginTop: 12 }}><TermsBody body={doc.body} /></Card>
      </Screen>
    );
  }
  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: draft.title }} />
      <View style={{ backgroundColor: colors.warningBg, borderRadius: 12, padding: 12, marginBottom: 12 }} testID="legal-draft-banner">
        <Text style={{ color: colors.warningText, fontFamily: fonts.bold }}>مسودة — غير نافذة بعد</Text>
        <Text variant="small" style={{ color: colors.warningText }}>هذه النسخة بانتظار المراجعة القانونية واعتماد الإدارة.</Text>
      </View>
      <Text variant="h1" style={{ fontSize: 22 }}>{draft.title}</Text>
      <Text variant="small">الإصدار {draft.version}{draft.effectiveDate ? ` · سارية من ${draft.effectiveDate}` : ''}</Text>
      {draft.sections.map((s, i) => (
        <Card key={`${draft.id}-${i}`} style={{ marginTop: 12 }}>
          <Text variant="title">{i + 1}. {s.title}</Text>
          {s.body.map((p, j) => <Text key={j} style={{ marginTop: 6 }}>• {p}</Text>)}
        </Card>
      ))}
    </Screen>
  );
}
