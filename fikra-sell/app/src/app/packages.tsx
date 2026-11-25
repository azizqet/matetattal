import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { ErrorState, Skeleton } from '../components/feedback';
import { Icon, type IconName } from '../components/Icon';
import { Badge, Header, T } from '../components/ui';
import { useCatalog } from '../hooks/data';
import { useI18n } from '../i18n';
import { packages } from '../lib/api';
import { formatKwd } from '../lib/format';
import { useTheme } from '../theme/ThemeProvider';
import { radius, space } from '../theme/tokens';

const KIND_ICON: Record<string, IconName> = { feature: 'star', pin: 'pin', bump: 'bump', merchant: 'store', subscription: 'crown' };

/**
 * Plans & subscriptions. Posting is free at launch; paid services stay
 * disabled until a payment method compliant with App Store / Google Play
 * rules is connected (see docs/SECURITY.md). Prices come from the admin panel.
 */
export default function Packages() {
  const { c } = useTheme();
  const { t, lang, pick } = useI18n();
  const catalog = useCatalog();
  const paymentsOn = catalog.setting('payments_enabled', false);
  const q = useQuery({ queryKey: ['packages'], queryFn: packages, staleTime: 10 * 60_000 });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Header title={t('packages.title')} />
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: 60 }}>
        <View style={{ padding: space.xl, gap: space.sm, alignItems: 'center', backgroundColor: c.primarySoft, borderRadius: radius.lg }}>
          <Icon name="star" size={36} color={c.primary} />
          <T v="h3" center>{t('packages.freeNow')}</T>
          <T muted center>{t('packages.freeBody')}</T>
        </View>
        {q.isLoading ? <Skeleton h={90} r={radius.lg} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (q.data ?? []).map((p) => {
          const promo = p.promo_price_kwd !== null && (!p.promo_ends_at || new Date(p.promo_ends_at) > new Date());
          return (
            <View key={p.id} style={{ flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, alignItems: 'center' }}>
              <View style={{ width: 46, height: 46, borderRadius: 16, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={KIND_ICON[p.kind] ?? 'package'} size={22} color={c.primary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="bodyStrong">{pick(p.name_ar, p.name_en)}</T>
                <T v="small" muted>{pick(p.description_ar, p.description_en)}</T>
                <T v="caption" faint>{t('packages.days', { n: p.duration_days })}</T>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <T v="bodyStrong" color={c.primary}>{formatKwd(promo ? p.promo_price_kwd : p.price_kwd, lang)}</T>
                {!paymentsOn && <Badge label={t('packages.soon')} />}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
