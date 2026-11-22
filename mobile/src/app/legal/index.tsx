import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Badge, Card, Icon, Row, Screen, Text } from '@/components/ui';
import { LEGAL_DOCS } from '@/content/legal';
import { colors } from '@/lib/theme';

export default function LegalIndex() {
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
              {d.status === 'draft' ? <Badge label="مسودة" tone="yellow" /> : null}
              <Icon name="chevron-left" color={colors.muted} />
            </Row>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
