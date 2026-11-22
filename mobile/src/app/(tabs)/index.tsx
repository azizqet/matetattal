import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdCard } from '@/components/Ads';
import { AreaPill } from '@/components/AreaPicker';
import { NearbyCard } from '@/components/CompanyCard';
import { Empty, ErrorBox, Icon, PressableScale, Row, Skeleton, Text } from '@/components/ui';
import * as api from '@/lib/api';
import { useCompanies, useServiceNames, useServices } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { colors, fonts, gradients, radius, serviceGradients, serviceIcons, shadow } from '@/lib/theme';
import { searchCompanies } from '@/lib/utils';

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'صباح الخير' : 'مساء الخير';
}

function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <Row style={st.sectionHead}>
      <Text style={st.sectionTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Row gap={2}><Text style={st.sectionAction}>{action}</Text><Icon name="chevron-left" size={18} /></Row>
        </Pressable>
      ) : null}
    </Row>
  );
}

// الرئيسية: واجهة فاخرة — رأس بتدرّج الهوية، بحث بارز، خدمات بأيقونات متدرجة، «قريب منك» كبطاقات أفقية
export default function Home() {
  const insets = useSafeAreaInsets();
  const services = useServices();
  const companies = useCompanies();
  const names = useServiceNames();
  const { session, profile, area, coords } = useSession();
  const ads = useQuery({ queryKey: ['ads', 'public'], queryFn: () => api.getPublicAds(), retry: false });

  const nearby = useMemo(
    () => searchCompanies(companies.data ?? [], { area, origin: coords }, names).slice(0, 10),
    [companies.data, area, coords, names],
  );
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 36 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={colors.white} refreshing={companies.isRefetching} onRefresh={() => { companies.refetch(); services.refetch(); ads.refetch(); }} />}
      >
        {/* الرأس */}
        <LinearGradient colors={gradients.brand} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={[st.hero, { paddingTop: insets.top + 10 }]}>
          <View style={st.glow} />
          <View style={st.inner}>
            <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 6 }}>
              <Text style={st.logo} maxFontSizeMultiplier={1.2} numberOfLines={1} testID="home-logo">ماتعطل<Text style={st.logoDot}>•</Text></Text>
              <AreaPill light />
            </Row>
            <Text style={st.hello}>{greeting()}{session && firstName ? ` يا ${firstName}` : ''} 👋</Text>
            <Text style={st.headline}>وين ما تعطلت…{'\n'}إحنا قريبين منك.</Text>
          </View>
        </LinearGradient>

        <View style={st.inner}>
          {/* البحث */}
          <PressableScale onPress={() => router.push('/search')} style={st.search} accessibilityLabel="ابحث عن خدمة أو شركة" testID="home-search">
            <Row style={{ flex: 1, paddingHorizontal: 16 }} gap={10}>
              <View style={st.searchIcon}><Icon name="magnify" color={colors.white} size={20} /></View>
              <Text style={{ flex: 1, color: colors.muted, fontSize: 15 }}>ابحث عن سطحة، بنشر، مفاتيح…</Text>
              <Icon name="tune-variant" color={colors.muted} size={20} />
            </Row>
          </PressableScale>

          {/* طلب سريع */}
          <PressableScale onPress={() => router.push('/service/tow')} style={st.sos} accessibilityLabel="اطلب سطحة الآن" testID="home-sos">
            <LinearGradient colors={gradients.gold} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={st.sosInner}>
              <View style={st.sosIcon}><Icon name="car-emergency" size={26} color="#5A3D00" /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.sosTitle}>سيارتك تعطلت؟</Text>
                <Text style={st.sosSub}>اطلب سطحة الآن وتواصل مباشرة</Text>
              </View>
              <Icon name="arrow-left" size={22} color="#5A3D00" />
            </LinearGradient>
          </PressableScale>

          {/* الخدمات */}
          <SectionHead title="الخدمات" action="الكل" onAction={() => router.push('/search')} />
          {services.isLoading ? (
            <View style={st.grid}>{Array.from({ length: 8 }).map((_, i) => <View key={i} style={st.tile}><Skeleton width={56} height={56} radius={18} /><Skeleton width={54} height={10} style={{ marginTop: 10 }} /></View>)}</View>
          ) : services.error ? <ErrorBox message={(services.error as Error).message} onRetry={services.refetch} /> : (
            <View style={st.grid}>
              {(services.data ?? []).map((s) => (
                <PressableScale key={s.id} testID={`service-${s.id}`} style={st.tile} onPress={() => router.push(`/service/${s.id}`)} accessibilityLabel={s.name_ar}>
                  <View style={{ alignItems: 'center' }}>
                    <LinearGradient colors={serviceGradients[s.id] ?? serviceGradients.other} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={st.tileIcon}>
                      <Icon name={serviceIcons[s.id] ?? 'car'} size={28} color={colors.white} />
                    </LinearGradient>
                    <Text style={st.tileText} numberOfLines={2}>{s.name_ar}</Text>
                  </View>
                </PressableScale>
              ))}
            </View>
          )}
        </View>

        {/* قريب منك */}
        <View style={st.inner}>
          <SectionHead title={coords ? 'قريب منك' : area ? `في ${area}` : 'مقدمو الخدمات'} action="عرض الكل" onAction={() => router.push('/search')} />
        </View>
        {companies.isLoading ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.hList}>
            {[0, 1].map((i) => (
              <View key={i} style={[st.skelCard]}><Skeleton height={92} radius={0} /><View style={{ padding: 14, gap: 8 }}><Skeleton width={150} /><Skeleton width={90} height={12} /><Skeleton height={40} radius={12} /></View></View>
            ))}
          </ScrollView>
        ) : companies.error ? (
          <View style={st.inner}><ErrorBox message={(companies.error as Error).message} onRetry={companies.refetch} /></View>
        ) : nearby.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.hList} testID="nearby-list">
            {nearby.map((r) => <NearbyCard key={r.company.id} c={r.company} distance={r.distanceKm} serviceName={names[r.company.service_id ?? '']} />)}
          </ScrollView>
        ) : <View style={st.inner}><Empty title="ما فيه مقدمو خدمات هنا حالياً" subtitle="جرّب منطقة ثانية" /></View>}
        {!coords && !companies.isLoading ? (
          <View style={st.inner}>
            <Text variant="small" style={{ marginTop: 8 }}>فعّل موقعك من زر المنطقة بالأعلى لترتيب الخدمات حسب الأقرب لك.</Text>
          </View>
        ) : null}

        {/* أحدث الإعلانات */}
        {ads.data?.length ? (
          <View style={st.inner}>
            <SectionHead title="أحدث الإعلانات" />
            {ads.data.slice(0, 4).map((a) => <AdCard key={a.id} ad={a} serviceName={names[a.service_id]} />)}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { paddingBottom: 46, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, overflow: 'hidden' },
  glow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.07)', top: -90, left: -70 },
  inner: { paddingHorizontal: 16, width: '100%', maxWidth: 640, alignSelf: 'center' },
  // ارتفاع السطر أكبر من حجم الخط حتى لا يُقص أعلى الكلمة على iOS
  logo: { color: '#fff', fontFamily: fonts.heavy, fontSize: 28, lineHeight: 44, paddingTop: 2, includeFontPadding: false },
  logoDot: { color: colors.accent, fontSize: 30, lineHeight: 44 },
  hello: { color: 'rgba(255,255,255,0.8)', fontFamily: fonts.medium, fontSize: 14, marginTop: 14 },
  headline: { color: '#fff', fontFamily: fonts.heavy, fontSize: 26, lineHeight: 40, marginTop: 2 },
  search: { marginTop: -28, height: 58, backgroundColor: colors.elevated, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, justifyContent: 'center', ...shadow },
  searchIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  sos: { marginTop: 14, borderRadius: radius.lg, overflow: 'hidden', ...shadow },
  sosInner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  sosIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  sosTitle: { fontFamily: fonts.heavy, fontSize: 16, color: '#3D2900', lineHeight: 24 },
  sosSub: { fontFamily: fonts.medium, fontSize: 13, color: '#5A3D00', lineHeight: 20 },
  sectionHead: { justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontFamily: fonts.heavy, fontSize: 19, color: colors.heading, lineHeight: 28 },
  sectionAction: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  tile: { width: '25%', alignItems: 'center' },
  tileIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', ...shadow },
  tileText: { fontFamily: fonts.bold, fontSize: 12, textAlign: 'center', color: colors.text, lineHeight: 17, marginTop: 8, paddingHorizontal: 2 },
  hList: { paddingHorizontal: 16, paddingBottom: 6 },
  skelCard: { width: 252, marginEnd: 12, backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
});
