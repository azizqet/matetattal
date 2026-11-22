import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { trackCompany } from '@/lib/api';
import { colors, fonts, radius, serviceGradients, serviceIcons, shadow } from '@/lib/theme';
import { LinearGradient } from 'expo-linear-gradient';
import type { Company } from '@/lib/types';
import { companyAreas, formatKm, telUrl, whatsappUrl } from '@/lib/utils';
import { Badge, Button, Card, Icon, PressableScale, Row, Text } from './ui';
import { AvailableVehiclesBadge } from './Vehicles';

export function Logo({ c, size = 64 }: { c: Pick<Company, 'name' | 'logo_url'>; size?: number }) {
  if (c.logo_url) return <Image source={{ uri: c.logo_url }} style={{ width: size, height: size, borderRadius: size / 4.5, backgroundColor: colors.primarySoft }} contentFit="cover" transition={150} accessibilityLabel={'شعار ' + c.name} />;
  return (
    <View style={[st.logoFallback, { width: size, height: size, borderRadius: size / 4.5 }]}>
      <Text style={{ color: '#fff', fontFamily: fonts.heavy, fontSize: size / 2.6 }}>{c.name.trim()[0] ?? 'م'}</Text>
    </View>
  );
}

export function contact(c: Company, kind: 'call' | 'wa', message?: string) {
  trackCompany(c.id, kind === 'call' ? 'call' : 'wa').catch(() => {});
  const url = kind === 'call' ? telUrl(c.phone || c.whatsapp) : whatsappUrl(c.whatsapp || c.phone, message ?? 'السلام عليكم، تواصلت معكم عن طريق تطبيق ماتعطل وأحتاج خدمة.');
  Linking.openURL(url).catch(() => {});
}

function CompanyCardBase({ c, distance, serviceName }: { c: Company; distance?: number | null; serviceName?: string }) {
  const areas = companyAreas(c);
  return (
    <Card style={{ marginBottom: 12 }} onPress={() => router.push(`/company/${c.id}`)} testID={`company-${c.id}`}>
      <Row gap={12} style={{ alignItems: 'flex-start' }}>
        <Logo c={c} />
        <View style={{ flex: 1 }}>
          <Text variant="title" numberOfLines={2}>{c.name}</Text>
          <Row gap={6} style={{ marginTop: 4, flexWrap: 'wrap' }}>
            {Number(c.rating) > 0 ? (
              <Row gap={2}><Icon name="star" size={15} color={colors.accent} /><Text variant="small" style={{ color: colors.text, fontFamily: fonts.bold }}>{Number(c.rating).toFixed(1)}</Text><Text variant="small">({c.rating_count})</Text></Row>
            ) : <Badge label="جديد" />}
            {c.is_24h ? <Badge label="24 ساعة" tone="green" /> : null}
            <AvailableVehiclesBadge vehicles={c.company_vehicles} />
            {distance != null ? <Row gap={2}><Icon name="map-marker-distance" size={15} color={colors.muted} /><Text variant="small">{formatKm(distance)}</Text></Row> : null}
          </Row>
          <Text variant="small" numberOfLines={1} style={{ marginTop: 4 }}>
            {[serviceName, areas.slice(0, 3).join('، ')].filter(Boolean).join(' · ')}
          </Text>
          {c.price_text ? <Text variant="small" numberOfLines={1} style={{ color: colors.primary, fontFamily: fonts.medium }}>{c.price_text}</Text> : null}
        </View>
      </Row>
      <Row style={{ marginTop: 12 }}>
        <Button small title="اتصال" icon="phone" style={{ flex: 1 }} onPress={() => contact(c, 'call')} />
        <Button small title="واتساب" icon="whatsapp" kind="whatsapp" style={{ flex: 1 }} onPress={() => contact(c, 'wa')} />
      </Row>
    </Card>
  );
}
export const CompanyCard = memo(CompanyCardBase);

const st = StyleSheet.create({
  logoFallback: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  nearby: { width: 252, marginEnd: 12, backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, ...shadow },
  nearbyBand: { height: 92, alignItems: 'center', justifyContent: 'center' },
  nearbyLogo: { position: 'absolute', top: 62, right: 14, borderRadius: 16, borderWidth: 3, borderColor: colors.card, backgroundColor: colors.card },
  distPill: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  distText: { color: '#fff', fontFamily: fonts.bold, fontSize: 12 },
});

/** بطاقة فاخرة لقسم «قريب منك» في الرئيسية: الشعار، الخدمة، المسافة، التقييم (إن وُجد)، واتصال/واتساب مباشر */
function NearbyCardBase({ c, distance, serviceName }: { c: Company; distance?: number | null; serviceName?: string }) {
  const sid = c.service_id ?? 'other';
  const grad = serviceGradients[sid] ?? serviceGradients.other;
  return (
    <PressableScale onPress={() => router.push(`/company/${c.id}`)} style={st.nearby} testID={`nearby-${c.id}`} accessibilityLabel={c.name}>
      <LinearGradient colors={grad} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }} style={st.nearbyBand}>
        <Icon name={serviceIcons[sid] ?? 'car'} size={64} color="rgba(255,255,255,0.18)" />
        {distance != null ? (
          <View style={st.distPill}><Icon name="map-marker-radius" size={14} color={colors.white} /><Text style={st.distText}>{formatKm(distance)}</Text></View>
        ) : null}
        {c.is_24h ? <View style={[st.distPill, { right: undefined, left: 10 }]}><Text style={st.distText}>24/7</Text></View> : null}
      </LinearGradient>
      <View style={st.nearbyLogo}><Logo c={c} size={54} /></View>
      <View style={{ paddingHorizontal: 14, paddingBottom: 14, marginTop: 30 }}>
        <Text variant="title" numberOfLines={1}>{c.name}</Text>
        <Row gap={6} style={{ marginTop: 2 }}>
          <Text variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>{serviceName}</Text>
          {Number(c.rating_count) > 0 ? (
            <Row gap={2}><Icon name="star" size={14} color={colors.accent} /><Text variant="small" style={{ color: colors.text, fontFamily: fonts.bold }}>{Number(c.rating).toFixed(1)}</Text></Row>
          ) : null}
        </Row>
        <Row style={{ marginTop: 12 }}>
          <Button small title="اتصال" icon="phone" style={{ flex: 1 }} onPress={() => contact(c, 'call')} />
          <Button small title="" icon="whatsapp" kind="whatsapp" style={{ width: 48 }} onPress={() => contact(c, 'wa')} />
        </Row>
      </View>
    </PressableScale>
  );
}
export const NearbyCard = memo(NearbyCardBase);
