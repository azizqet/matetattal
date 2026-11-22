import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Badge, Card, Icon, Row, Screen, Text } from '@/components/ui';
import { LEGAL_DOCS } from '@/content/legal';
import * as api from '@/lib/api';
import { colors } from '@/lib/theme';

export default function LegalIndex() {
  const pub = useQuery({ queryKey: ['terms', 'current', 'all'], queryFn: () => api.getCurrentTerms() });
  return (
    <Screen edges={['bottom']}>
      <Text variant="muted">«ماتعطل» منصة تقنية وسيطة. اقرأ الشروط والسياسات التي تنظم استخدام التطبيق.</Text>
      {LEGAL_DOCS.map((d) => (
        <Pressable key={d.id} onPress={() => router.push(`/legal/${d.id}`)} accessibilityRole="button" testID={`legal-${d.id}`}>
          <Card style={{ marginTop: 10 }}>
            <Row gap={10}>
              <Icon name="file-document-outline" />
              <View style={{ flex: 1 }}>
                <Text variant="title">{d.title}</Text>
                <Text variant="small">{d.summary}</Text>
              </View>
              {pub.data?.some((p) => p.kind === d.id)
                ? <Badge label={`نافذة · ${pub.data.find((p) => p.kind === d.id)!.version}`} tone="green" />
                : <Badge label="مسودة" tone="yellow" />}
              <Icon name="chevron-left" color={colors.muted} />
            </Row>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
