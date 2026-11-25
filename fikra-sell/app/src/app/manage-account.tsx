import { router } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Sheet, useToast } from '../components/feedback';
import { Badge, Button, Card, Divider, Header, Input, Row, T } from '../components/ui';
import { useI18n } from '../i18n';
import { passwordOk, useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

/** Removes every file the user owns in storage (ads + avatar), then deletes the account. */
async function deleteEverything(userId: string) {
  const { data: ads } = await supabase.from('ads').select('id').eq('user_id', userId);
  for (const a of ads ?? []) {
    const { data: files } = await supabase.storage.from('ad-images').list(`${userId}/${a.id}`, { limit: 100 });
    if (files?.length) await supabase.storage.from('ad-images').remove(files.map((f) => `${userId}/${a.id}/${f.name}`));
  }
  const { data: av } = await supabase.storage.from('avatars').list(userId, { limit: 100 });
  if (av?.length) await supabase.storage.from('avatars').remove(av.map((f) => `${userId}/${f.name}`));
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
}

export default function ManageAccount() {
  const { c } = useTheme();
  const { t } = useI18n();
  const toast = useToast();
  const { email, userId, setNewPassword, signOut } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [confirmWord, setConfirmWord] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t('account.manage')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl }}>
        <Card style={{ padding: space.lg, gap: space.xs }}>
          <T v="small" muted>{t('auth.email')}</T>
          <T v="bodyStrong">{email}</T>
          <Badge label={t('account.emailUnverified')} />
        </Card>
        <Card>
          <Row icon="lock" label={t('account.changePassword')} onPress={() => setPwOpen(true)} testID="change-password" />
          <Divider />
          <Row icon="block" label={t('account.blockedUsers')} onPress={() => router.push('/blocked')} />
          <Divider />
          <Row icon="trash" danger label={t('account.deleteAccount')} onPress={() => setDelOpen(true)} testID="delete-account" />
        </Card>
      </ScrollView>

      <Sheet visible={pwOpen} onClose={() => setPwOpen(false)} title={t('account.changePassword')} scroll={false}
        footer={<Button title={t('common.save')} loading={busy} onPress={async () => {
          if (!passwordOk(pw)) return toast.show(t('auth.weakPassword'), 'error');
          setBusy(true);
          try { await setNewPassword(pw); toast.success('auth.passwordUpdated'); setPw(''); setPwOpen(false); } catch (e) { toast.error(e); } finally { setBusy(false); }
        }} />}>
        <Input label={t('auth.newPassword')} value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint={t('auth.passwordHint')} icon="lock" testID="new-password" />
      </Sheet>

      <Sheet visible={delOpen} onClose={() => setDelOpen(false)} title={t('account.deleteTitle')} scroll={false}
        footer={<Button title={busy ? t('account.deleting') : t('account.deleteAccount')} kind="danger" loading={busy} testID="confirm-delete-account"
          disabled={confirmWord.trim() !== t('account.deleteWord')}
          onPress={async () => {
            if (!userId) return;
            setBusy(true);
            try { await deleteEverything(userId); await signOut(); toast.success('account.deleted'); router.replace('/'); }
            catch (e) { toast.error(e); } finally { setBusy(false); }
          }} />}>
        <View style={{ gap: space.md }}>
          <View style={{ padding: space.md, borderRadius: radius.md, backgroundColor: c.dangerSoft }}><T v="small" color={c.danger}>{t('account.deleteBody')}</T></View>
          <Input label={t('account.deleteTypeConfirm')} value={confirmWord} onChangeText={setConfirmWord} autoCapitalize="characters" testID="delete-word" />
        </View>
      </Sheet>
    </View>
  );
}
