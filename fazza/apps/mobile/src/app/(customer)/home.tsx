import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ACTIVE_STATUSES } from "@fazza/shared";
import { Mascot } from "@/components/illustrations/Illustrations";
import { MapView, Marker, PROVIDER_DEFAULT, type Region } from "@/components/map/Map";
import { Banner, Card, Icon, Screen, T } from "@/components/ui";
import { OrderCard } from "@/features/OrderCard";
import { useMyOrders, useOutbox } from "@/features/useMyOrders";
import { useSettings } from "@/lib/hooks";
import { KUWAIT_CENTER, currentPosition } from "@/lib/location";
import { draftOrder } from "@/state/draftOrder";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/theme/ThemeProvider";
import Svg from "react-native-svg";

export default function Home() {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  const { profile, driver } = useAuth();
  const { data: orders, refetch, isRefetching } = useMyOrders();
  const outbox = useOutbox();
  const settings = useSettings().data;
  const map = useRef<MapView>(null);
  const [region, setRegion] = useState<Region>({ ...KUWAIT_CENTER, latitudeDelta: 0.35, longitudeDelta: 0.35 });
  const active = (orders ?? []).filter((o) => o.status === "open" || ACTIVE_STATUSES.includes(o.status));

  useEffect(() => {
    currentPosition().then((p) => {
      if (!p) return;
      const r = { ...p, latitudeDelta: 0.04, longitudeDelta: 0.04 };
      setRegion(r);
      map.current?.animateToRegion(r, 600);
    });
  }, []);

  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
        <View>
          <T v="small" color="muted">{t("home.greeting", { name: profile?.full_name?.split(" ")[0] ?? "" })}</T>
          <T v="h2">{t("home.where")}</T>
        </View>
        <Pressable onPress={() => router.push("/notifications")} hitSlop={8} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}>
          <Icon name="notifications-outline" />
        </Pressable>
      </View>

      {settings?.maintenance_mode ? <Banner tone="warning" icon="construct-outline" title={t("maintenance.title")} body={(profile?.locale === "en" ? settings.maintenance_message_en : settings.maintenance_message_ar) || undefined} /> : null}

      <View style={{ height: 230, borderRadius: radius.xl, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
        <MapView ref={map} provider={PROVIDER_DEFAULT} style={{ flex: 1 }} initialRegion={region} showsUserLocation showsMyLocationButton={false} toolbarEnabled={false}>
          {active.filter((o) => o.status !== "open").map((o) => (
            <Marker key={o.id} coordinate={{ latitude: o.dropoff_lat, longitude: o.dropoff_lng }} pinColor={colors.primary} />
          ))}
        </MapView>
        <Pressable testID="new-order" onPress={() => { draftOrder.reset(); router.push("/order/new"); }} style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
          <LinearGradient colors={["#3466FF", "#1E46D8", "#1636B3"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ borderRadius: radius.lg, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: "#ffffff26", alignItems: "center", justifyContent: "center" }}>
              <Icon name="add" size={28} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <T w="bold" color="white">{t("home.newOrder")}</T>
              <T v="small" color="#DCE5FF">{t("home.newOrderSub")}</T>
            </View>
            <Icon name="chevron-forward" color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>

      <T v="h3">{t("home.active")}</T>
      {outbox.map((p) => (
        <OrderCard key={p.id} pending o={{ id: p.id, status: "open", category: String(p.payload.category ?? "parcel"),
          pickup_address: String((p.payload.pickup as { address?: string })?.address ?? ""), dropoff_address: String((p.payload.dropoff as { address?: string })?.address ?? ""), created_at: p.createdAt }} />
      ))}
      {active.length === 0 && outbox.length === 0 ? (
        <Card flat><T color="muted" center>{t("home.noActive")}</T></Card>
      ) : active.map((o) => <OrderCard key={o.id} o={o} onPress={() => router.push({ pathname: "/order/[id]", params: { id: o.id } })} />)}

      {!driver ? (
        <Card onPress={() => router.push("/driver/apply")} style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Svg width={70} height={86} viewBox="-80 -80 160 190"><Mascot x={0} y={0} s={1} wave /></Svg>
          <View style={{ flex: 1 }}>
            <T w="bold">{t("home.becomeDriver")}</T>
            <T v="small" color="muted">{t("home.becomeDriverSub")}</T>
          </View>
          <Icon name="chevron-forward" color={colors.textFaint} />
        </Card>
      ) : null}
    </Screen>
  );
}
