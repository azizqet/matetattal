import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { View } from 'react-native';
import { AdFeed, useFeedLayout } from '../../components/AdFeed';
import { ReportSheet } from '../../components/ReportSheet';
import { Avatar, Badge, Header, IconButton, T } from '../../components/ui';
import { useI18n } from '../../i18n';
import { getProfile } from '../../lib/api';
import { useAuth, useRequireAuth } from '../../lib/auth';
import { shortDate } from '../../lib/format';
import { useTheme } from '../../theme/ThemeProvider';
import { space } from '../../theme/tokens';

export default function Seller() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { c } = useTheme();
  const { t, lang } = useI18n();
  const { userId } = useAuth();
  const guard = useRequireAuth();
  const [layout] = useFeedLayout();
  const [report, setReport] = useState(false);
  const p = useQuery({ queryKey: ['profile', id], queryFn: () => getProfile(id) });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={p.data?.full_name ?? ''} right={userId !== id ? <IconButton name="flag" label={t('common.report')} onPress={() => guard('report', () => setReport(true))} /> : undefined} />
      <AdFeed
        filters={{ seller_id: id, sort: 'newest' }}
        layout={layout}
        emptyTitle={t('seller.noAds')}
        emptyBody=""
        header={p.data ? (
          <View style={{ alignItems: 'center', gap: space.sm, padding: space.xl }}>
            <Avatar path={p.data.avatar_path} name={p.data.full_name} size={84} />
            <T v="h2">{p.data.full_name}</T>
            {p.data.is_merchant && <Badge label={t('account.merchant')} tone="accent" />}
            <T v="small" muted>{t('ad.memberSince', { date: shortDate(p.data.created_at, lang) })} · {t('account.activeAds', { n: p.data.active_ads_count })}</T>
            {p.data.bio && <T center muted>{p.data.bio}</T>}
          </View>
        ) : undefined}
      />
      <ReportSheet visible={report} onClose={() => setReport(false)} targetType="user" targetId={id} />
    </View>
  );
}
