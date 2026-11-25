import { router, useLocalSearchParams } from 'expo-router';
import { SupportContacts } from '@/components/SupportContacts';
import { Button, Card, Screen, Text } from '@/components/ui';
import { colors } from '@/lib/theme';

/** شاشة التواصل مع إدارة ماتعطل (تُفتح من «حسابي» وبعد إرسال طلب الانضمام) */
export default function Contact() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();
  const afterJoin = reason === 'join';
  return (
    <Screen edges={['bottom']}>
      {afterJoin ? (
        <Card style={{ backgroundColor: colors.successSoft, borderColor: colors.successSoft }}>
          <Text variant="title">وصل طلب انضمامك ✓</Text>
          <Text variant="muted">ستتواصل معك الإدارة لمراجعة بيانات شركتك وتفعيل الاشتراك. ويمكنك التواصل مباشرة على أحد الأرقام التالية.</Text>
        </Card>
      ) : (
        <Text variant="muted">للاستفسارات والاشتراكات والإعلانات والدعم الفني.</Text>
      )}
      <SupportContacts message={afterJoin ? 'السلام عليكم، أرسلت طلب انضمام شركة في تطبيق ماتعطل' : 'السلام عليكم، عندي استفسار عن تطبيق ماتعطل'} />
      <Button title="الشروط والسياسات" kind="ghost" icon="file-document-outline" style={{ marginTop: 16 }} onPress={() => router.push('/legal')} />
      {afterJoin ? <Button title="العودة للرئيسية" kind="soft" style={{ marginTop: 8 }} onPress={() => router.replace('/')} /> : null}
    </Screen>
  );
}
