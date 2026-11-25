import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { formatDistance, formatKwd } from "@fazza/shared";
import { MapView, Marker, PROVIDER_DEFAULT } from "@/components/map/Map";
import { Badge, Banner, Card, EmptyState, Icon, Screen, T } from "@/components/ui";
import { EmptyBoxScene } from "@/components/illustrations/Illustrations";
import { rpc } from "@/lib/api";
import { useDriverDashboard, useLang, useRealtimeInvalidate } from "@/lib/hooks";
import { KUWAIT_CENTER, currentPosition, type LatLng } from "@/lib/location";
import type { OpenOrder } from "@/lib/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function Requests() {
  const { t } = useTranslation();
  const lang = useLang();
  const { colors } = useTheme();
  const dash = useDriverDashboard();
  const [pos, setPos] = useState<LatLng | null>(null);
  useEffect(() => { currentPosition().then(setPos); }, []);
  const approved = dash.data?.status === "approved";
  useRealtimeInvalidate("order-feed", "order_feed", undefined, [["open-orders"]], approved);
  const { data, refetch, isRefetching } = useQuery({
    queryKey: ["open-orders", pos?.latitude, pos?.longitude],
    enabled: approved,
    queryFn: () => rpc<OpenOrder[]>("driver_open_orders", { p_lat: pos?.latitude ?? null, p_lng: pos?.longitude ?? null }),
    refetchInterval: 45_000,
  });
  const center = pos ?? KUWAIT_CENTER;

  return (
    <Screen refreshing={isRefetching} onRefresh={() => { refetch(); currentPosition().then(setPos); }}>
      <T v="h1" style={{ marginTop: 8 }}>{t("driver.nearby")}</T>
      {!approved ? <Banner icon="time-outline" title={t("driver.pendingTitle")} body={t("driver.pendingBody")} /> : null}
      {approved && dash.data && !dash.data.can_receive ? <Banner tone="warning" icon="alert-circle" title={t(`driver.${dash.data.block_reason === "debt_limit" ? "debtTitle" : "activationTitle"}`)} /> : null}
      {!pos ? <Banner tone="primary" icon="location-outline" title={t("driver.needLocation")} /> : null}
      <View style={{ height: 220, borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
        <MapView provider={PROVIDER_DEFAULT} style={{ flex: 1 }} showsUserLocation initialRegion={{ ...center, latitudeDelta: 0.25, longitudeDelta: 0.25 }}>
          {(data ?? []).map((o) => (
            <Marker key={o.id} coordinate={{ latitude: o.pickup_lat, longitude: o.pickup_lng }} pinColor="#1E46D8"
              onCalloutPress={() => router.push({ pathname: "/driver/order/[id]", params: { id: o.id } })} title={t(`category.${o.category}`)} description={o.pickup_address} />
          ))}
        </MapView>
      </View>
      {(data ?? []).length === 0 && approved ? <EmptyState art={<EmptyBoxScene />} title={t("driver.noNearby")} /> : null}
      {(data ?? []).map((o) => (
        <Card key={o.id} onPress={() => router.push({ pathname: "/driver/order/[id]", params: { id: o.id } })} testID={`open-${o.code}`}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <Icon name="cube-outline" size={18} />
              <T w="bold">{t(`category.${o.category}`)}</T>
              <T v="small" color="muted">· {o.code}</T>
            </View>
            {o.my_offer_fils ? <Badge tone="success" label={formatKwd(o.my_offer_fils, lang)} /> : <Badge tone="neutral" label={`${o.offers_count} ${t("order.offers")}`} />}
          </View>
          <T v="small" numberOfLines={2}>{o.details}</T>
          <View style={{ flexDirection: "row", gap: 14, flexWrap: "wrap" }}>
            <T v="small" color="muted"><Icon name="navigate-outline" size={14} color={colors.textMuted} /> {formatDistance(o.distance_to_pickup_m, lang)}</T>
            <T v="small" color="muted"><Icon name="swap-horizontal" size={14} color={colors.textMuted} /> {formatDistance(o.distance_m, lang)}</T>
            {o.image_paths.length ? <T v="small" color="muted"><Icon name="images-outline" size={14} color={colors.textMuted} /> {o.image_paths.length}</T> : null}
          </View>
          <T v="caption" color="faint" numberOfLines={1}>{o.pickup_address}</T>
        </Card>
      ))}
    </Screen>
  );
}
