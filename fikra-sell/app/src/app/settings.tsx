import { useQuery, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useToast } from '../components/feedback';
import { Card, Header, Segmented, Switch, T } from '../components/ui';
import { useI18n, type Lang } from '../i18n';
import { getMySettings, updateMySettings } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { ProfileSettings } from '../lib/types';
import { useTheme, type ThemeMode } from '../theme/ThemeProvider';
import { space } from '../theme/tokens';

export default function Settings() {
  const { c, mode, setMode } = useTheme();
  const { t, lang, setLang } = useI18n();
  const { userId } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const s = useQuery({ queryKey: ['my-settings', userId], queryFn: getMySettings, enabled: !!userId });
  const prefs = s.data?.notification_prefs;

  const setPref = async (k: keyof ProfileSettings['notification_prefs'], v: boolean) => {
    if (!userId || !prefs) return;
    const next = { ...prefs, [k]: v };
    qc.setQueryData(['my-settings', userId], { ...s.data, notification_prefs: next });
    try { await updateMySettings(userId, { notification_prefs: next }); } catch (e) { toast.error(e); s.refetch(); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t('account.settings')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.xl, paddingBottom: 60 }}>
        <View style={{ gap: space.sm }}>
          <T v="bodyStrong">{t('account.language')}</T>
          <Segmented<Lang> value={lang} onChange={async (l) => { if (userId) updateMySettings(userId, { locale: l }).catch(() => {}); await setLang(l); }}
            options={[{ value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }]} />
        </View>
        <View style={{ gap: space.sm }}>
          <T v="bodyStrong">{t('account.theme')}</T>
          <Segmented<ThemeMode> value={mode} onChange={setMode}
            options={[{ value: 'system', label: t('account.themeSystem') }, { value: 'light', label: t('account.themeLight') }, { value: 'dark', label: t('account.themeDark') }]} />
        </View>
        {userId && prefs && (
          <View style={{ gap: space.sm }}>
            <T v="bodyStrong">{t('account.notificationPrefs')}</T>
            <Card style={{ paddingHorizontal: space.lg }}>
              <Switch label={t('account.prefMessages')} value={prefs.messages} onValueChange={(v) => setPref('messages', v)} />
              <Switch label={t('account.prefAds')} value={prefs.ads} onValueChange={(v) => setPref('ads', v)} />
              <Switch label={t('account.prefSaved')} value={prefs.saved_searches} onValueChange={(v) => setPref('saved_searches', v)} />
              <Switch label={t('account.prefOffers')} value={prefs.offers} onValueChange={(v) => setPref('offers', v)} />
              <Switch label={t('account.prefGeneral')} value={prefs.general} onValueChange={(v) => setPref('general', v)} />
            </Card>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
