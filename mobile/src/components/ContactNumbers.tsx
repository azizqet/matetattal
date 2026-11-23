// أرقام تواصل المعلن: رقم الاتصال (8 أرقام) + اختيار رقم الواتساب (نفس الرقم أو رقم مختلف).
import { View } from 'react-native';
import { Chip, PhoneField, Row, Text } from '@/components/ui';

export function ContactNumbers({ phone, onPhone, sameWhatsapp, onSameWhatsapp, whatsapp, onWhatsapp, phoneLabel = 'رقم الاتصال', testID = 'contact' }: {
  phone: string; onPhone: (v: string) => void;
  sameWhatsapp: boolean; onSameWhatsapp: (v: boolean) => void;
  whatsapp: string; onWhatsapp: (v: string) => void;
  phoneLabel?: string; testID?: string;
}) {
  return (
    <View>
      <PhoneField label={phoneLabel} value={phone} onChangeText={onPhone} testID={`${testID}-phone`} />
      <Text variant="label" style={{ marginTop: 12 }}>رقم الواتساب</Text>
      <Row style={{ flexWrap: 'wrap' }}>
        <Chip label="نفس رقم الاتصال" icon="whatsapp" active={sameWhatsapp} onPress={() => onSameWhatsapp(true)} />
        <Chip label="رقم مختلف" active={!sameWhatsapp} onPress={() => onSameWhatsapp(false)} />
      </Row>
      {!sameWhatsapp ? <PhoneField label="رقم الواتساب" value={whatsapp} onChangeText={onWhatsapp} testID={`${testID}-whatsapp`} /> : null}
    </View>
  );
}
