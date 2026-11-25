import { useQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { AdForm } from '../../components/AdForm';
import { BulbLoader, EmptyState } from '../../components/feedback';
import { Header } from '../../components/ui';
import { useI18n } from '../../i18n';
import { getAd } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../theme/ThemeProvider';

export default function EditAd() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useAuth();
  const { c } = useTheme();
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['ad', Number(id)], queryFn: () => getAd(Number(id)), enabled: !!userId });
  if (!userId) return <Redirect href="/auth/sign-in" />;
  if (q.isLoading) return <View style={{ flex: 1, backgroundColor: c.bg, justifyContent: 'center' }}><BulbLoader /></View>;
  if (!q.data || q.data.user_id !== userId) return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="" /><EmptyState title={t('ad.notFound')} /></View>;
  if (q.data.status === 'sold') return <View style={{ flex: 1, backgroundColor: c.bg }}><Header title="" /><EmptyState title={t('errors.sold_ad_locked')} /></View>;
  return <AdForm existing={q.data} />;
}
