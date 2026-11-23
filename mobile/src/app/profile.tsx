import { router } from 'expo-router';
import { useState } from 'react';
import { Button, Field, PhoneField, Screen, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { useSession } from '@/lib/session';
import { arabicError, isKuwaitMobile, localPhone } from '@/lib/utils';

export default function ProfileScreen() {
  const { session, profile, refreshProfile } = useSession();
  const toast = useToast();
  const [nameInput, setName] = useState<string | null>(null);
  const [phoneInput, setPhone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const name = nameInput ?? profile?.full_name ?? '';
  const phone = phoneInput ?? localPhone(profile?.phone);
  if (!session) return null;

  async function save() {
    if (phone && !isKuwaitMobile(phone)) return toast('رقم الجوال لازم 8 أرقام يبدأ بـ 5 أو 6 أو 9');
    setBusy(true);
    try {
      await api.updateMyProfile(session!.user.id, { full_name: name.trim().slice(0, 80), phone: phone ? localPhone(phone) : null });
      await refreshProfile();
      toast('تم الحفظ');
      router.back();
    } catch (e) { toast(arabicError(e)); } finally { setBusy(false); }
  }

  return (
    <Screen edges={['bottom']}>
      <Text variant="muted" style={{ textAlign: 'right' }}>
        {api.loginPhoneOf(session.user.email) ? `رقم الدخول: ⁦+965 ${api.loginPhoneOf(session.user.email)}⁩ (لا يتغير)` : session.user.email}
      </Text>
      <Field label="الاسم" value={name} onChangeText={setName} maxLength={80} />
      <PhoneField label="رقم التواصل" value={phone} onChangeText={setPhone} testID="profile-phone" />
      <Button title="حفظ" loading={busy} onPress={save} style={{ marginTop: 18 }} />
    </Screen>
  );
}
