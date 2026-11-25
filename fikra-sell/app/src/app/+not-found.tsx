import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { EmptyState } from '../components/feedback';
import { Header } from '../components/ui';
import { useI18n } from '../i18n';
import { useTheme } from '../theme/ThemeProvider';

export default function NotFound() {
  const { c } = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title="" />
      <EmptyState title={t('errors.not_found')} action={t('tabs.home')} onAction={() => router.replace('/')} />
    </View>
  );
}
