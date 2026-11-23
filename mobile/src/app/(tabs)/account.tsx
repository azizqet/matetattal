import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, Button, Card, Icon, Row, Screen, Text, useToast } from '@/components/ui';
import * as api from '@/lib/api';
import { isAdmin, useSession } from '@/lib/session';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients } from '@/lib/theme';
import { arabicError, localPhone } from '@/lib/utils';

function Item({ icon, label, onPress, badge, danger, testID }: { icon: string; label: string; onPress: () => void; badge?: number; danger?: boolean; testID?: string }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.item, pressed && { backgroundColor: colors.primarySoft }]} accessibilityRole="button" testID={testID}>
      <Icon name={icon} color={danger ? colors.danger : colors.primary} />
      <Text style={{ flex: 1, color: danger ? colors.danger : colors.text }}>{label}</Text>
      {badge ? <Badge label={String(badge)} tone="red" /> : null}
      <Icon name="chevron-left" color={colors.muted} />
    </Pressable>
  );
}

export default function Account() {
  const { session, profile, signOut } = useSession();
  const toast = useToast();
  const notes = useQuery({ queryKey: ['notifications'], queryFn: api.getNotifications, enabled: !!session });
  const unread = notes.data?.filter((n) => !n.read_at).length ?? 0;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const phone = api.loginPhoneOf(session?.user.email) || localPhone(session?.user.phone) || profile?.phone || '';

  async function deleteAccount() {
    setDeleting(true);
    try {
      await api.deleteMyAccount();
      await signOut();
      toast('تم حذف حسابك');
    } catch (e) { toast(arabicError(e)); } finally { setDeleting(false); setConfirmDelete(false); }
  }

  return (
    <Screen>
      <Text variant="h1">حسابي</Text>
      {session ? (
        <Card style={{ marginTop: 12 }}>
          <Row gap={12}>
            <LinearGradient colors={gradients.brand} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={st.avatar}>
              <Text style={{ color: colors.white, fontFamily: fonts.heavy, fontSize: 22, lineHeight: 30 }}>{(profile?.full_name || 'م').trim()[0]?.toUpperCase()}</Text>
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text variant="title">{profile?.full_name || 'مستخدم ماتعطل'}</Text>
              <Text variant="small" style={{ writingDirection: 'ltr', textAlign: 'right' }}>{phone || session.user.email}</Text>
            </View>
            <Button small kind="ghost" icon="pencil" title="" onPress={() => router.push('/profile')} />
          </Row>
        </Card>
      ) : (
        <Card style={{ marginTop: 12 }}>
          <Text variant="title">أهلاً بك في ماتعطل</Text>
          <Text variant="muted">سوّ حسابك برقم تلفونك وكلمة سر لإضافة الإعلانات وطلب الخدمات ومتابعتها.</Text>
          <Button title="سجّل دخولك أو سوّ حساب" style={{ marginTop: 12 }} onPress={() => router.push('/auth')} testID="login-btn" />
        </Card>
      )}

      <Card style={st.list}>
        {session ? (
          <>
            <Item icon="bullhorn-outline" label="إعلاناتي" onPress={() => router.push('/my-ads')} testID="acc-my-ads" />
            <Item icon="clipboard-text-outline" label="طلباتي" onPress={() => router.push('/requests')} />
            <Item icon="heart-outline" label="المفضلة" onPress={() => router.push('/favorites')} />
            <Item icon="bell-outline" label="الإشعارات" badge={unread} onPress={() => router.push('/notifications')} />
            <Item icon="key-chain-variant" label="رمز استعادة الحساب" onPress={() => router.push('/recovery-code')} testID="acc-recovery" />
          </>
        ) : null}
        <Item icon="store-plus-outline" label="انضم كمقدم خدمة" onPress={() => router.push('/join')} testID="acc-join" />
        <Item icon="headset" label="الدعم الفني" onPress={() => router.push('/support')} testID="acc-support" />
        <Item icon="file-document-outline" label="الشروط والسياسات" onPress={() => router.push('/legal')} />
        {isAdmin(profile) ? <Item icon="shield-crown-outline" label="لوحة الإدارة" onPress={() => router.push('/admin')} /> : null}
      </Card>

      {session ? (
        <Card style={st.list}>
          <Item icon="logout" label="تسجيل الخروج" onPress={() => signOut().catch(() => {})} testID="acc-logout" />
          <Item icon="account-remove-outline" label="حذف الحساب" danger onPress={() => setConfirmDelete(true)} testID="acc-delete" />
        </Card>
      ) : null}
      {confirmDelete ? (
        <Card style={{ marginTop: 12, borderColor: colors.danger }}>
          <Text variant="title" style={{ color: colors.danger }}>حذف الحساب نهائياً؟</Text>
          <Text variant="small">تُحذف بياناتك الشخصية وإعلاناتك وطلباتك ومحادثات الدعم، ولا يمكن التراجع.</Text>
          <Row style={{ marginTop: 10 }}>
            <Button title="نعم، احذف حسابي" kind="danger" style={{ flex: 1 }} loading={deleting} onPress={deleteAccount} testID="acc-delete-confirm" />
            <Button title="تراجع" kind="soft" style={{ flex: 1 }} onPress={() => setConfirmDelete(false)} />
          </Row>
        </Card>
      ) : null}
      <Text variant="small" style={{ textAlign: 'center', marginTop: 20 }}>ماتعطل · الإصدار 1.0.0</Text>
    </Screen>
  );
}

const st = StyleSheet.create({
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  list: { marginTop: 14, padding: 0, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.line },
});
