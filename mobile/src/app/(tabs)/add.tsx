import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdForm } from '@/components/Ads';
import { Button, Card, Empty, Icon, Text } from '@/components/ui';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function AddAd() {
  const { session, profile } = useSession();
  const qc = useQueryClient();
  const [formKey, setFormKey] = useState(0);
  const [sent, setSent] = useState(false);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
          <Text variant="h1">أضف إعلان</Text>
          {!session ? (
            <Empty icon="bullhorn-outline" title="سجّل دخولك لإضافة إعلان" subtitle="التسجيل برقم جوالك خلال ثوانٍ."
              action={<Button title="تسجيل الدخول" onPress={() => router.push('/auth')} testID="add-login" />} />
          ) : sent ? (
            <Card style={{ marginTop: 14, alignItems: 'center' }}>
              <Icon name="clock-check-outline" size={40} />
              <Text variant="title" style={{ marginTop: 8 }}>وصل إعلانك</Text>
              <Text variant="muted" style={{ textAlign: 'center' }}>حالته الآن «بانتظار الموافقة». بيوصلك إشعار عند القبول أو الرفض.</Text>
              <Button title="إعلاناتي" style={{ marginTop: 12, alignSelf: 'stretch' }} onPress={() => router.push('/my-ads')} />
              <Button title="إضافة إعلان آخر" kind="ghost" onPress={() => { setSent(false); setFormKey(formKey + 1); }} />
            </Card>
          ) : (
            <AdForm key={formKey} uid={session.user.id} defaultPhone={profile?.phone}
              onSaved={() => { qc.invalidateQueries({ queryKey: ['my-ads'] }); setSent(true); }} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
