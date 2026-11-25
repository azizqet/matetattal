import Constants from 'expo-constants';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lockup } from '../../components/Brand';
import { Avatar, Badge, Button, Card, Divider, Row, T } from '../../components/ui';
import { useCounters } from '../../hooks/data';
import { useI18n } from '../../i18n';
import { useAuth, useRequireAuth } from '../../lib/auth';
import { useTheme } from '../../theme/ThemeProvider';
import { radius, space } from '../../theme/tokens';

export default function Account() {
  const { c } = useTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const { profile, userId } = useAuth();
  const guard = useRequireAuth();
  const counters = useCounters();
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 140, gap: space.xl }}>
      <T v="h1" style={{ paddingHorizontal: space.lg }}>{t('account.title')}</T>

      {userId && profile ? (
        <View style={{ marginHorizontal: space.lg, padding: space.lg, gap: space.md, backgroundColor: c.surface,
          borderRadius: radius.lg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <Avatar path={profile.avatar_path} name={profile.full_name} size={64} />
            <View style={{ flex: 1, gap: 2 }}>
              <T v="h3" numberOfLines={1} testID="account-name">{profile.full_name}</T>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                <Badge label={t('account.activeAds', { n: profile.active_ads_count })} tone="primary" />
                {profile.is_merchant && <Badge label={t('account.merchant')} tone="accent" />}
              </View>
            </View>
          </View>
          <Button small kind="secondary" title={t('account.editProfile')} icon="edit" onPress={() => router.push('/profile-edit')} testID="edit-profile" />
        </View>
      ) : (
        <View style={{ marginHorizontal: space.lg, padding: space.xl, gap: space.md, alignItems: 'center', backgroundColor: c.primarySoft, borderRadius: radius.lg }}>
          <Lockup height={30} />
          <T v="h3" center>{t('account.guestTitle')}</T>
          <T muted center>{t('account.guestBody')}</T>
          <Button title={t('tabs.post')} icon="plus" style={{ alignSelf: 'stretch' }} onPress={() => guard('post', () => router.push('/post/new'))} testID="account-post" />
        </View>
      )}

      {userId && (
        <Card style={{ marginHorizontal: space.lg }}>
          <Row icon="list" label={t('account.myAds')} onPress={() => router.push('/my-ads')} testID="row-my-ads" />
          <Divider />
          <Row icon="heart" label={t('account.favorites')} onPress={() => router.push('/favorites')} badge={undefined} testID="row-favorites" />
          <Divider />
          <Row icon="chat" label={t('tabs.chats')} onPress={() => router.navigate('/chats')} badge={counters.data?.unread_messages || undefined} />
          <Divider />
          <Row icon="bookmark" label={t('account.savedSearches')} onPress={() => router.push('/saved-searches')} testID="row-saved" />
          <Divider />
          <Row icon="bell" label={t('account.notifications')} onPress={() => router.push('/notifications')} badge={counters.data?.unread_notifications || undefined} />
          <Divider />
          <Row icon="package" label={t('account.packages')} onPress={() => router.push('/packages')} />
        </Card>
      )}

      <Card style={{ marginHorizontal: space.lg }}>
        <Row icon="settings" label={t('account.settings')} onPress={() => router.push('/settings')} testID="row-settings" />
        {userId && <><Divider /><Row icon="shield" label={t('account.manage')} onPress={() => router.push('/manage-account')} testID="row-manage" /></>}
        <Divider />
        <Row icon="help" label={t('account.support')} onPress={() => guard('default', () => router.push('/support'))} />
        <Divider />
        <Row icon="doc" label={t('account.guidelines')} onPress={() => router.push('/page/guidelines')} />
        <Divider />
        <Row icon="doc" label={t('account.terms')} onPress={() => router.push('/page/terms')} />
        <Divider />
        <Row icon="lock" label={t('account.privacy')} onPress={() => router.push('/page/privacy')} />
      </Card>

      <T v="caption" faint center>{`${t('app.name')} · ${t('account.version', { v: version })}`}</T>
    </ScrollView>
  );
}
