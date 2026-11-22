import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { AreaPill } from './AreaPicker';
import { CompanyCard } from './CompanyCard';
import { Chip, Empty, ErrorBox, Icon, Loading, Row, Text } from './ui';
import { useCompanies, useServiceNames, useServices } from '@/lib/queries';
import { useSession } from '@/lib/session';
import { colors, fonts, radius } from '@/lib/theme';
import { searchCompanies, type SearchFilters } from '@/lib/utils';

/** قائمة الشركات مع البحث والفلاتر (تستخدم في البحث وصفحة الخدمة) */
export function CompanyList({ fixedService, autoFocus }: { fixedService?: string; autoFocus?: boolean }) {
  const companies = useCompanies();
  const services = useServices();
  const names = useServiceNames();
  const { area, coords } = useSession();
  const [q, setQ] = useState('');
  const [svc, setSvc] = useState<string | null>(fixedService ?? null);
  const [only24h, setOnly24h] = useState(false);
  const [sort, setSort] = useState<SearchFilters['sort']>(undefined);

  const results = useMemo(
    () => searchCompanies(companies.data ?? [], { q, serviceId: svc, area, only24h, origin: coords, sort }, names),
    [companies.data, q, svc, area, only24h, coords, sort, names],
  );
  const firstOutside = area ? results.findIndex((r) => !r.inArea) : -1;

  const header = (
    <View>
      <View style={st.searchBox}>
        <Icon name="magnify" color={colors.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder="اسم الشركة أو الخدمة..." placeholderTextColor={colors.placeholder} autoFocus={autoFocus}
          style={st.input} returnKeyType="search" accessibilityLabel="بحث" testID="search-input" />
        {q ? <Pressable onPress={() => setQ('')} hitSlop={8} accessibilityLabel="مسح البحث"><Icon name="close-circle" color={colors.muted} size={20} /></Pressable> : null}
      </View>
      <Row style={{ marginTop: 12, flexWrap: 'wrap' }}>
        <AreaPill />
        <Chip label="24 ساعة" icon="clock-outline" active={only24h} onPress={() => setOnly24h(!only24h)} />
        <Chip label="الأقرب" icon="near-me" active={sort === 'distance' || (!sort && !!coords)} onPress={() => setSort('distance')} />
        <Chip label="الأعلى تقييماً" icon="star-outline" active={sort === 'rating' || (!sort && !coords)} onPress={() => setSort('rating')} />
      </Row>
      {!fixedService ? (
        <Row style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <Chip label="كل الخدمات" active={!svc} onPress={() => setSvc(null)} />
          {(services.data ?? []).map((s) => <Chip key={s.id} label={s.name_ar} active={svc === s.id} onPress={() => setSvc(svc === s.id ? null : s.id)} />)}
        </Row>
      ) : null}
      <Text variant="small" style={{ marginTop: 12, marginBottom: 8 }}>
        {companies.isLoading ? '' : `${results.length} نتيجة${area ? ' · ' + area + ' أولاً' : ''}${coords ? ' · مرتبة حسب المسافة' : ''}`}
      </Text>
    </View>
  );

  if (companies.isLoading) return <View style={st.wrap}>{header}<Loading /></View>;
  if (companies.error) return <View style={st.wrap}>{header}<ErrorBox message={(companies.error as Error).message} onRetry={companies.refetch} /></View>;

  return (
    <FlatList
      data={results}
      keyExtractor={(r) => String(r.company.id)}
      contentContainerStyle={st.wrap}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={companies.isRefetching} onRefresh={() => { companies.refetch(); }} />}
      initialNumToRender={8}
      windowSize={7}
      renderItem={({ item, index }) => (
        <View>
          {index === firstOutside ? <Text variant="title" style={{ marginVertical: 8 }}>شركات تخدم مناطق أخرى</Text> : null}
          <CompanyCard c={item.company} distance={item.distanceKm} serviceName={names[item.company.service_id ?? '']} />
        </View>
      )}
      ListEmptyComponent={<Empty title="ما لقينا نتائج" subtitle="جرب كلمة ثانية أو غيّر الفلاتر" />}
    />
  );
}

const st = StyleSheet.create({
  wrap: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 640, alignSelf: 'center' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 12, height: 50 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text, writingDirection: 'rtl', height: '100%' },
});
