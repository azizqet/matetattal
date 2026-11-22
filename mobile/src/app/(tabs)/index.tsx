import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AdCard } from '@/components/Ads';
import { AreaPill } from '@/components/AreaPicker';
import { CompanyCard } from '@/components/CompanyCard';
import { Empty, ErrorBox, Icon, Loading, Row, SectionTitle, Text, Button } from '@/components/ui';
import * as api from '@/lib/api';
import { useCompanies, useServiceNames, useServices } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { colors, fonts, radius, serviceIcons } from '@/lib/theme';
import { searchCompanies } from '@/lib/utils';

// واجهة بسيطة: شعار + المنطقة، بحث، الخدمات في بطاقات، أحدث الإعلانات، الأقرب لك
export default function Home() {
  const services = useServices();
  const companies = useCompanies();
  const names = useServiceNames();
  const { area, coords } = useSession();
  // الإعلانات المنشورة فقط (RLS). إن لم تُفعّل الخدمة بعد يُخفى القسم بهدوء.
  const ads = useQuery({ queryKey: ['ads', 'public'], queryFn: () => api.getPublicAds(), retry: false });

  const nearby = useMemo(
    () => searchCompanies(companies.data ?? [], { area, origin: coords }, names).slice(0, 6),
    [companies.data, area, coords, names],
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.white }}>
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={companies.isRefetching} onRefresh={() => { companies.refetch(); services.refetch(); ads.refetch(); }} />}
      >
        <View style={st.header}>
          <View style={st.inner}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 6 }}>
              <Text style={st.logo} maxFontSizeMultiplier={1.2} numberOfLines={1} testID="home-logo">ماتعطل<Text style={st.logoDot}>•</Text></Text>
              <AreaPill />
            </Row>
            <Pressable style={st.search} onPress={() => router.push('/search')} accessibilityRole="search" accessibilityLabel="ابحث عن خدمة أو شركة">
              <Icon name="magnify" color={colors.muted} />
              <Text variant="muted">ابحث عن خدمة أو شركة...</Text>
            </Pressable>
          </View>
        </View>

        <View style={st.inner}>
          <SectionTitle title="الخدمات" />
          {services.isLoading ? <Loading /> : services.error ? <ErrorBox message={(services.error as Error).message} onRetry={services.refetch} /> : (
            <View style={st.grid}>
              {(services.data ?? []).map((s) => (
                <Pressable key={s.id} testID={`service-${s.id}`} style={({ pressed }) => [st.tile, pressed && { backgroundColor: colors.primarySoft }]}
                  onPress={() => router.push(`/service/${s.id}`)} accessibilityRole="button" accessibilityLabel={s.name_ar}>
                  <View style={st.tileIcon}><Icon name={serviceIcons[s.id] ?? 'car'} size={26} /></View>
                  <Text style={st.tileText} numberOfLines={3}>{s.name_ar}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {ads.data?.length ? (
            <>
              <SectionTitle title="أحدث الإعلانات" />
              {ads.data.slice(0, 4).map((a) => <AdCard key={a.id} ad={a} serviceName={names[a.service_id]} />)}
            </>
          ) : null}

          <SectionTitle title={coords ? 'الأقرب لك' : area ? `في ${area}` : 'مقدمو الخدمات'}
            action={<Button small kind="ghost" title="عرض الكل" onPress={() => router.push('/search')} />} />
          {companies.isLoading ? <Loading /> : companies.error ? (
            <ErrorBox message={(companies.error as Error).message} onRetry={companies.refetch} />
          ) : nearby.length ? nearby.map((r) => (
            <CompanyCard key={r.company.id} c={r.company} distance={r.distanceKm} serviceName={names[r.company.service_id ?? '']} />
          )) : <Empty title="ما فيه شركات حالياً" subtitle="جرب منطقة ثانية" />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  header: { backgroundColor: colors.white, paddingTop: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  inner: { paddingHorizontal: 16, width: '100%', maxWidth: 640, alignSelf: 'center' },
  // ارتفاع السطر أكبر من حجم الخط حتى لا يُقص أعلى الكلمة على iOS
  logo: { color: colors.primary, fontFamily: fonts.heavy, fontSize: 28, lineHeight: 44, paddingTop: 2, includeFontPadding: false },
  logoDot: { color: colors.accent, fontSize: 30, lineHeight: 44 },
  search: { marginTop: 10, backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 48 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '31%', flexGrow: 1, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', minHeight: 104 },
  tileIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileText: { fontFamily: fonts.bold, fontSize: 13, textAlign: 'center', color: colors.heading, lineHeight: 19 },
});
