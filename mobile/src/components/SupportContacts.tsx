import { Linking, View } from 'react-native';
import { SUPPORT_CONTACTS, formatLocalPhone, phoneInText } from '@/lib/contact';
import { colors, fonts } from '@/lib/theme';
import { telUrl, whatsappUrl } from '@/lib/utils';
import { Button, Card, Row, Text } from './ui';

/** بطاقة أرقام التواصل: زر اتصال لكل رقم، وزر واتساب فقط للأرقام المؤكدة على واتساب */
export function SupportContacts({ message, title = 'تواصل مع إدارة ماتعطل' }: { message?: string; title?: string }) {
  return (
    <Card style={{ marginTop: 12 }} testID="support-contacts">
      <Text variant="title">{title}</Text>
      {SUPPORT_CONTACTS.map((c) => (
        <View key={c.phone} style={{ marginTop: 10 }} testID={`support-${c.phone}`}>
          <Text style={{ fontFamily: fonts.bold, color: colors.heading, writingDirection: 'ltr', textAlign: 'right' }}>
            {formatLocalPhone(c.phone)}
          </Text>
          <Row style={{ marginTop: 6 }}>
            <Button small icon="phone" title={`اتصال ${phoneInText(c.phone)}`} style={{ flex: 1 }}
              testID={`call-${c.phone}`} onPress={() => Linking.openURL(telUrl(c.phone)).catch(() => {})} />
            {c.whatsapp ? (
              <Button small icon="whatsapp" kind="whatsapp" title="واتساب" style={{ flex: 1 }}
                testID={`wa-${c.phone}`} onPress={() => Linking.openURL(whatsappUrl(c.phone, message)).catch(() => {})} />
            ) : null}
          </Row>
        </View>
      ))}
    </Card>
  );
}
