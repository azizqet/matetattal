import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useToast } from '../components/feedback';
import { Avatar, Button, Header, Input, T } from '../components/ui';
import { useI18n } from '../i18n';
import { getMySettings, updateMyProfile, updateMySettings } from '../lib/api';
import { useAuth } from '../lib/auth';
import { isValidKwPhone, normalizePhone } from '../lib/format';
import { pickImages, uploadImage } from '../lib/images';
import { supabase } from '../lib/supabase';
import { useTheme } from '../theme/ThemeProvider';
import { font, space } from '../theme/tokens';

export default function ProfileEdit() {
  const { c } = useTheme();
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const { profile, userId, refreshProfile } = useAuth();
  const s = useQuery({ queryKey: ['my-settings', userId], queryFn: getMySettings, enabled: !!userId });
  const [name, setName] = useState(profile?.full_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [phoneEdit, setPhone] = useState<string | null>(null);
  const phone = phoneEdit ?? s.data?.phone ?? '';
  const [avatar, setAvatar] = useState(profile?.avatar_path ?? null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const changePhoto = async () => {
    const r = await pickImages(1);
    if (r === 'denied') return toast.show(t('errors.permission_photos'), 'error');
    if (!r.length || !userId) return;
    setUploading(true);
    try {
      const path = await uploadImage('avatars', userId, r[0]);
      const old = avatar;
      await updateMyProfile(userId, { avatar_path: path });
      if (old) supabase.storage.from('avatars').remove([old]).catch(() => {});
      setAvatar(path); await refreshProfile();
    } catch (e) { toast.error(e); } finally { setUploading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t('account.editProfile')} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <View style={{ alignItems: 'center', gap: space.sm }}>
          <Avatar path={avatar} name={name} size={96} />
          <Pressable onPress={changePhoto} disabled={uploading} accessibilityRole="button">
            <T color={c.primary} style={{ fontFamily: font.semibold }}>{uploading ? t('common.loading') : t('account.changePhoto')}</T>
          </Pressable>
        </View>
        <Input label={t('auth.name')} value={name} onChangeText={setName} maxLength={60} testID="profile-name" />
        <Input label={t('account.phone')} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="9xxxxxxx" icon="phone" />
        <Input label={t('account.bio')} value={bio} onChangeText={setBio} multiline maxLength={300} hint={`${bio.length}/300`} />
        <Button title={t('common.save')} loading={busy} testID="profile-save" onPress={async () => {
          if (name.trim().length < 2) return toast.show(t('auth.nameRequired'), 'error');
          if (phone && !isValidKwPhone(phone)) return toast.show(t('post.phoneRequired'), 'error');
          if (!userId) return;
          setBusy(true);
          try {
            await updateMyProfile(userId, { full_name: name.trim(), bio: bio.trim() || null });
            await updateMySettings(userId, { phone: phone ? normalizePhone(phone) : null });
            await refreshProfile(); qc.invalidateQueries({ queryKey: ['my-settings'] });
            toast.success('account.profileSaved'); router.back();
          } catch (e) { toast.error(e); } finally { setBusy(false); }
        }} />
      </ScrollView>
    </View>
  );
}
