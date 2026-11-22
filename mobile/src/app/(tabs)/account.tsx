import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Badge, Button, Card, Icon, Row, Screen, Text } from '@/components/ui';
import * as api from '@/lib/api';
import { isAdmin, useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

const ROLE_AR: Record<string, string> = { customer: 'عميل', company: 'مقدم خدمة', staff: 'مشرف', admin: 'مدير' };

function Item({ icon, label, onPress, badge }: { icon: string; label: string; onPress: () => void; badge?: number }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.item, pressed && { backgroundColor: colors.primarySoft }]} accessibilityRole="button">
      <Icon name={icon} />
      <Text style={{ flex: 1 }}>{label}</Text>
      {badge ? <Badge label={String(badge)} tone="red" /> : null}
      <Icon name="chevron-left" color={colors.muted} />
    </Pressable>
  );
}

export default function Account() {
  const { session, profile, signOut } = useSession();
  const notes = useQuery({ queryKey: ['notifications'], queryFn: api.getNotifications, enabled: !!session });
  const unread = notes.data?.filter((n) => !n.read_at).length ?? 0;

  return (
    <Screen>
      <Text variant="h1">حسابي</Text>
      {session ? (
        <Card style={{ marginTop: 12 }}>
          <Row gap={12}>
            <View style={st.avatar}><Icon name="account" size={30} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text variant="title">{profile?.full_name || 'مستخدم ماتعطل'}</Text>
              <Text variant="small">{session.user.email}</Text>
            </View>
            {profile ? <Badge label={ROLE_AR[profile.role] ?? profile.role} /> : null}
          </Row>
        </Card>
      ) : (
        <Card style={{ marginTop: 12 }}>
          <Text variant="title">أهلاً بك في ماتعطل</Text>
          <Text variant="muted">سجّل لحفظ المفضلة وطلب الخدمات ومتابعتها، أو لإدارة شركتك.</Text>
          <Row style={{ marginTop: 12 }}>
            <Button title="دخول" style={{ flex: 1 }} onPress={() => router.push('/auth')} testID="login-btn" />
            <Button title="حساب جديد" kind="soft" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/auth', params: { mode: 'register' } })} />
          </Row>
        </Card>
      )}

      <Card style={{ marginTop: 14, padding: 0, overflow: 'hidden' }}>
        {session ? (
          <>
            <Item icon="bell-outline" label="الإشعارات" badge={unread} onPress={() => router.push('/notifications')} />
            <Item icon="heart-outline" label="المفضلة" onPress={() => router.push('/favorites')} />
            <Item icon="account-edit-outline" label="بياناتي" onPress={() => router.push('/profile')} />
          </>
        ) : null}
        <Item icon="store-outline" label={profile?.role === 'company' ? 'لوحة شركتي' : 'سجّل شركتك في ماتعطل'} onPress={() => router.push(session ? '/business' : '/join')} />
        {isAdmin(profile) ? <Item icon="shield-crown-outline" label="لوحة الإدارة" onPress={() => router.push('/admin')} /> : null}
        <Item icon="message-alert-outline" label="شكوى أو اقتراح" onPress={() => router.push(session ? '/complaint' : '/auth')} />
        <Item icon="phone-outline" label="تواصل مع الدعم" onPress={() => router.push('/contact')} />
        <Item icon="file-document-outline" label="الشروط والسياسات" onPress={() => router.push('/legal')} />
      </Card>

      {session ? <Button title="تسجيل الخروج" kind="danger" icon="logout" style={{ marginTop: 18 }} onPress={signOut} /> : null}
      <Text variant="small" style={{ textAlign: 'center', marginTop: 20 }}>ماتعطل · الإصدار 1.0.0</Text>
    </Screen>
  );
}

const st = StyleSheet.create({
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.line },
});
