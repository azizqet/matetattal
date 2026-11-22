import { LinearGradientFallback } from '@/components/Hero';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AreaPill } from '@/components/AreaPicker';
import { CompanyCard } from '@/components/CompanyCard';
import { Button, Empty, ErrorBox, Icon, Loading, Row, SectionTitle, Text } from '@/components/ui';
import { useCompanies, useServiceNames, useServices } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { colors, fonts, radius, serviceIcons, shadow } from '@/lib/theme';
import { searchCompanies } from '@/lib/utils';

export default function Home() {
  const services = useServices();
  const companies = useCompanies();
  const names = useServiceNames();
  const { area, coords } = useSession();

  const nearby = useMemo(
    () => searchCompanies(companies.data ?? [], { area, origin: coords }, names).slice(0, 6),
    [companies.data, area, coords, names],
  );
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of companies.data ?? []) if (c.service_id) m[c.service_id] = (m[c.service_id] ?? 0) + 1;
    return m;
  }, [companies.data]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.primaryDark }}>
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={companies.isRefetching} onRefresh={() => { companies.refetch(); services.refetch(); }} />}
      >
        <LinearGradientFallback>
          <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 6 }}>
            <Text style={st.logo} maxFontSizeMultiplier={1.2} numberOfLines={1} testID="home-logo">ماتعطل<Text style={st.logoDot}>•</Text></Text>
            <AreaPill light />
          </Row>
          <Text style={st.eyebrow}>خدمات السيارات في الكويت</Text>
          <Text style={st.heroTitle}>سيارتك تعطلت؟ ماتعطل.</Text>
          <Text style={st.heroSub}>ونشات، بنشر متنقل، غسيل، مفاتيح وحماية — تواصل مع الشركة مباشرة.</Text>
          <Pressable style={st.search} onPress={() => router.push('/search')} accessibilityRole="search" accessibilityLabel="ابحث عن خدمة أو شركة">
            <Icon name="magnify" color={colors.muted} />
            <Text variant="muted">ابحث عن خدمة أو شركة...</Text>
          </Pressable>
        </LinearGradientFallback>

        <View style={st.body}>
          <SectionTitle title="اختر الخدمة" />
          {services.isLoading ? <Loading /> : services.error ? <ErrorBox message={(services.error as Error).message} onRetry={services.refetch} /> : (
            <View style={st.grid}>
              {(services.data ?? []).map((s) => (
                <Pressable key={s.id} testID={`service-${s.id}`} style={({ pressed }) => [st.tile, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push(`/service/${s.id}`)} accessibilityRole="button" accessibilityLabel={s.name_ar}>
                  <View style={st.tileIcon}><Icon name={serviceIcons[s.id] ?? 'car'} size={28} /></View>
                  <Text style={st.tileText} numberOfLines={2}>{s.name_ar}</Text>
                  {counts[s.id] ? <Text variant="small">{counts[s.id]} مزود</Text> : null}
                </Pressable>
              ))}
            </View>
          )}

          <SectionTitle title={coords ? 'الأقرب لك' : area ? `في ${area}` : 'مقدمو خدمات مميزون'}
            action={<Button small kind="ghost" title="عرض الكل" onPress={() => router.push('/search')} />} />
          {companies.isLoading ? <Loading /> : companies.error ? (
            <ErrorBox message={(companies.error as Error).message} onRetry={companies.refetch} />
          ) : nearby.length ? nearby.map((r) => (
            <CompanyCard key={r.company.id} c={r.company} distance={r.distanceKm} serviceName={names[r.company.service_id ?? '']} />
          )) : <Empty title="ما فيه شركات حالياً" subtitle="جرب منطقة ثانية أو تابعنا قريباً" />}

          <View style={st.join}>
            <Icon name="store-plus-outline" size={30} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text variant="title">عندك شركة خدمات سيارات؟</Text>
              <Text variant="muted">سجّل شركتك ووصل لآلاف العملاء في الكويت.</Text>
            </View>
          </View>
          <Button title="انضم الآن" icon="arrow-left" onPress={() => router.push('/join')} style={{ marginTop: 10 }} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  // ارتفاع السطر لازم يكون أكبر من حجم الخط: كان النص يرث lineHeight: 24 (أصغر من 28) فيُقص أعلى الكلمة على iOS
  logo: { color: '#fff', fontFamily: fonts.heavy, fontSize: 28, lineHeight: 44, paddingTop: 2, includeFontPadding: false },
  logoDot: { color: colors.accent, fontSize: 30, lineHeight: 44 },
  eyebrow: { color: colors.accent, fontFamily: fonts.bold, fontSize: 13, marginTop: 18 },
  heroTitle: { color: '#fff', fontFamily: fonts.heavy, fontSize: 27, lineHeight: 40, marginTop: 4 },
  heroSub: { color: '#DCE7FF', fontSize: 14, lineHeight: 22 },
  search: { marginTop: 16, backgroundColor: '#fff', borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 50, ...shadow },
  body: { paddingHorizontal: 16, width: '100%', maxWidth: 640, alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '31.5%', flexGrow: 1, backgroundColor: '#fff', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 12, alignItems: 'center', minHeight: 116, ...shadow },
  tileIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileText: { fontFamily: fonts.bold, fontSize: 13, textAlign: 'center', color: colors.heading, lineHeight: 19 },
  join: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 26, backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: 16 },
});
