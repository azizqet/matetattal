// شاشة تشخيص مؤقتة: تفصل بين مشكلة في الجهاز/Expo Go وبين مشكلة في مكوّنات التطبيق.
// (أ) TextInput أصلي بدون أي تنسيق، (ب) لوحة أرقام أصلية، (ج) خانات التطبيق نفسها. سجل أحداث مباشر لكل خانة.
import { useState } from 'react';
import { I18nManager, Keyboard, Platform, ScrollView, TextInput, View } from 'react-native';
import { AuthField, KuwaitPhoneField } from '@/components/AuthUI';
import { Button, Card, Text } from '@/components/ui';
import { colors } from '@/lib/theme';

export default function InputTest() {
  const [log, setLog] = useState<string[]>([]);
  const add = (m: string) => setLog((l) => [`${new Date().toLocaleTimeString('en-GB')} ${m}`, ...l].slice(0, 30));
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState('');
  const raw = { borderWidth: 1, borderColor: '#888', padding: 12, fontSize: 18, color: '#000', backgroundColor: '#fff', marginTop: 6 } as const;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <Text variant="small">النظام: {Platform.OS} {String(Platform.Version)} · RTL: {String(I18nManager.isRTL)}</Text>

      <Card style={{ marginTop: 10 }}>
        <Text variant="title">(أ) خانة أصلية بدون تنسيق</Text>
        <TextInput testID="raw-text" value={a} onChangeText={(t) => { setA(t); add(`أ change "${t}"`); }}
          onFocus={() => add('أ focus')} onBlur={() => add('أ blur')} placeholder="اكتب هنا" style={raw} />
        <Text variant="small">القيمة: «{a}»</Text>
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Text variant="title">(ب) لوحة أرقام أصلية</Text>
        <TextInput testID="raw-number" value={b} onChangeText={(t) => { setB(t); add(`ب change "${t}"`); }} keyboardType="number-pad"
          onFocus={() => add('ب focus')} onBlur={() => add('ب blur')} placeholder="12345678" style={raw} />
        <Text variant="small">القيمة: «{b}»</Text>
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Text variant="title">(ج) خانات التطبيق</Text>
        <AuthField icon="account-outline" label="الاسم" value={name} onChangeText={(t) => { setName(t); add(`الاسم "${t}"`); }}
          onFocus={() => add('الاسم focus')} onBlur={() => add('الاسم blur')} testID="t-name" />
        <KuwaitPhoneField value={phone} onChangeText={(t) => { setPhone(t); add(`التلفون "${t}"`); }} testID="t-phone" />
        <AuthField icon="lock-outline" label="كلمة المرور" value={pw} onChangeText={(t) => { setPw(t); add(`المرور طول=${t.length}`); }} ltr secureToggle
          onFocus={() => add('المرور focus')} onBlur={() => add('المرور blur')} testID="t-pw" />
      </Card>

      <Button title="إغلاق لوحة المفاتيح" kind="soft" small style={{ marginTop: 12 }} onPress={() => Keyboard.dismiss()} />
      <Card style={{ marginTop: 12 }}>
        <Text variant="title">سجل الأحداث</Text>
        {log.length ? log.map((l, i) => <Text key={i} variant="small" style={{ color: colors.text }}>{l}</Text>) : <Text variant="small">لا أحداث بعد</Text>}
      </Card>
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}
