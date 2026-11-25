import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { Alert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { type SortKey, formatDistance, formatKwd, sortOffers } from "@fazza/shared";
import { OffersScene } from "@/components/illustrations/Illustrations";
import { MapView, Marker, PROVIDER_DEFAULT } from "@/components/map/Map";
import { Avatar, Badge, Banner, Button, Card, Header, Icon, Loading, PromptModal, Screen, Segmented, Stars, T, TextField, statusTone } from "@/components/ui";
import { OrderInfo, PhotoStrip, Pulse, StatusSteps, Timeline } from "@/features/OrderParts";
import { RouteLine } from "@/features/OrderCard";
import { publicUrl, rpc } from "@/lib/api";
import { useErrorAlert, useLang, useRealtimeInvalidate } from "@/lib/hooks";
import { etaMinutes, haversineM } from "@/lib/location";
import { channelName, supabase } from "@/lib/supabase";
import type { OfferCard, OrderDetail } from "@/lib/types";
import { useTheme } from "@/theme/ThemeProvider";

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const h = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(h);
  }, [intervalMs]);
  return now;
}

function useDriverLocation(driverId: string | null | undefined, enabled: boolean) {
  const [loc, setLoc] = useState<{ lat: number; lng: number; updated_at: string } | null>(null);
  useEffect(() => {
    if (!driverId || !enabled) return;
    supabase.from("driver_locations").select("lat,lng,updated_at").eq("driver_id", driverId).maybeSingle().then(({ data }) => data && setLoc(data));
    const ch = supabase.channel(channelName(`loc-${driverId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations", filter: `driver_id=eq.${driverId}` },
        (p) => p.new && "lat" in p.new && setLoc(p.new as { lat: number; lng: number; updated_at: string }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [driverId, enabled]);
  return loc;
}

export default function CustomerOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const lang = useLang();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const showError = useErrorAlert();
  const [sort, setSort] = useState<SortKey>("price");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const map = useRef<MapView>(null);
  const now = useNow();

  const order = useQuery({ queryKey: ["order", id], queryFn: () => rpc<OrderDetail>("get_order", { p_order: id }) });
  const o = order.data;
  const offers = useQuery({
    queryKey: ["offers", id], enabled: o?.status === "open",
    queryFn: () => rpc<OfferCard[]>("get_order_offers", { p_order: id }), refetchInterval: 30_000,
  });
  useRealtimeInvalidate(`order-${id}`, "orders", `id=eq.${id}`, [["order", id], ["order-events", id], ["my-orders"]]);
  useRealtimeInvalidate(`offers-${id}`, "offers", `order_id=eq.${id}`, [["offers", id]], o?.status === "open");
  const tracking = o?.status === "accepted" || o?.status === "picked_up";
  const loc = useDriverLocation(o?.driver_id, tracking);

  const sorted = useMemo(() => sortOffers((offers.data ?? []).filter((x) => x.status === "pending"), sort), [offers.data, sort]);
  const target = o ? (o.status === "accepted" ? { latitude: o.pickup_lat, longitude: o.pickup_lng } : { latitude: o.dropoff_lat, longitude: o.dropoff_lng }) : null;
  const eta = loc && target ? etaMinutes(haversineM({ latitude: loc.lat, longitude: loc.lng }, target)) : null;

  useEffect(() => {
    if (!o) return;
    const pts = [{ latitude: o.pickup_lat, longitude: o.pickup_lng }, { latitude: o.dropoff_lat, longitude: o.dropoff_lng }];
    if (loc) pts.push({ latitude: loc.lat, longitude: loc.lng });
    setTimeout(() => map.current?.fitToCoordinates(pts, { edgePadding: { top: 50, bottom: 50, left: 50, right: 50 }, animated: true }), 300);
  }, [o, loc]);

  if (order.isLoading || !o) return <Screen scroll={false}><Header title={t("order.code")} /><Loading /></Screen>;

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try { await fn(); await qc.invalidateQueries({ queryKey: ["order", id] }); qc.invalidateQueries({ queryKey: ["offers", id] }); }
    catch (e) { showError(e); }
    finally { setBusy(null); }
  };

  const accept = (x: OfferCard) => Alert.alert(t("order.accept"), t("order.acceptConfirm", { price: formatKwd(x.price_fils, lang) }), [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("order.accept"), onPress: () => act(`acc-${x.offer_id}`, () => rpc("accept_offer", { p_offer: x.offer_id })) },
  ]);

  const cancel = () => {
    if (o.status === "open") {
      Alert.alert(t("order.cancel"), t("order.cancelOpenConfirm"), [
        { text: t("common.no"), style: "cancel" },
        { text: t("order.cancel"), style: "destructive", onPress: () => act("cancel", () => rpc("cancel_order", { p_order: id, p_reason: null })) },
      ]);
    } else setCancelOpen(true);
  };

  return (
    <Screen>
      <Header title={`${t("order.code")} ${o.code}`} subtitle={new Date(o.created_at).toLocaleString(lang === "ar" ? "ar-KW" : "en-GB")}
        right={<Badge tone={statusTone(o.status)} label={t(`order.status_${o.status}`)} />} />
      <StatusSteps status={o.status} />

      {o.status === "open" ? (
        <>
          <Card style={{ alignItems: "center" }}>
            <Pulse><OffersScene width={180} /></Pulse>
            <T v="h3" center>{t("order.waitingOffers")}</T>
            <T v="small" color="muted" center>{t("order.waitingOffersSub")} · {t("order.expiresIn", { min: Math.max(0, Math.round((new Date(o.expires_at).getTime() - now) / 60000)) })}</T>
          </Card>
          {sorted.length ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <T v="h3">{t("order.offers")} ({sorted.length})</T>
              </View>
              <Segmented value={sort} onChange={setSort} options={(["price", "rating", "eta", "distance"] as SortKey[]).map((k) => ({ value: k, label: t(`order.sort_${k}`) }))} />
              {sorted.map((x, i) => (
                <Card key={x.offer_id} testID={`offer-${i}`} style={i === 0 && sort === "price" ? { borderWidth: 2, borderColor: colors.primary } : undefined}>
                  <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                    <Avatar uri={publicUrl("avatars", x.avatar_path)} name={x.driver_name} size={52} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <T w="bold">{x.driver_name}</T>
                      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                        <Icon name="star" size={14} color="#F5B400" />
                        <T v="small" w="semibold">{x.rating_avg ? x.rating_avg.toFixed(1) : t("order.noRating")}</T>
                        <T v="small" color="muted">({x.rating_count}) · {t("order.trips", { n: x.completed_count })} · {t(`vehicle.${x.vehicle_type}`)}</T>
                      </View>
                    </View>
                    <T v="h2" color="primary" style={{ writingDirection: "ltr" }}>{formatKwd(x.price_fils, lang)}</T>
                  </View>
                  <View style={{ flexDirection: "row", gap: 14 }}>
                    <T v="small" color="muted"><Icon name="time-outline" size={14} color={colors.textMuted} /> {t("order.eta", { min: x.eta_minutes })}</T>
                    {x.distance_to_pickup_m != null ? <T v="small" color="muted"><Icon name="navigate-outline" size={14} color={colors.textMuted} /> {t("order.away", { d: formatDistance(x.distance_to_pickup_m, lang) })}</T> : null}
                  </View>
                  {x.note ? <T v="small">“{x.note}”</T> : null}
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Button style={{ flex: 1 }} small kind="ghost" title={t("order.reject")} loading={busy === `rej-${x.offer_id}`}
                      onPress={() => act(`rej-${x.offer_id}`, () => rpc("reject_offer", { p_offer: x.offer_id }))} />
                    <Button testID={`accept-${i}`} style={{ flex: 2 }} small title={t("order.accept")} icon="checkmark" loading={busy === `acc-${x.offer_id}`} onPress={() => accept(x)} />
                  </View>
                </Card>
              ))}
            </>
          ) : null}
        </>
      ) : null}

      {o.driver && o.status !== "cancelled" ? (
        <Card>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Avatar uri={publicUrl("avatars", o.driver.avatar_path)} name={o.driver.full_name} size={54} />
            <View style={{ flex: 1 }}>
              <T v="small" color="muted">{t("order.driver")}</T>
              <T w="bold">{o.driver.full_name}</T>
              <T v="small" color="muted">{t(`vehicle.${o.driver.vehicle_type}`)} {o.driver.vehicle_model ?? ""} · {o.driver.plate_number}</T>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <T v="h3" color="primary" style={{ writingDirection: "ltr" }}>{formatKwd(o.delivery_fee_fils, lang)}</T>
              <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}><Icon name="star" size={13} color="#F5B400" /><T v="small">{o.driver.rating_avg?.toFixed(1) ?? t("order.noRating")}</T></View>
            </View>
          </View>
          {o.status !== "completed" ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button style={{ flex: 1 }} small kind="secondary" icon="call" title={t("common.call")} onPress={() => Linking.openURL(`tel:${o.driver!.phone}`)} />
              <Button testID="open-chat" style={{ flex: 1 }} small kind="secondary" icon="chatbubble-ellipses" title={t("common.chat")} onPress={() => router.push({ pathname: "/chat/[id]", params: { id } })} />
            </View>
          ) : null}
          <T v="caption" color="faint">{t("order.payCash")}</T>
        </Card>
      ) : null}

      {o.status !== "open" && o.status !== "cancelled" && o.status !== "expired" ? (
        <View style={{ height: 240, borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
          <MapView ref={map} provider={PROVIDER_DEFAULT} style={{ flex: 1 }} initialRegion={{ latitude: o.pickup_lat, longitude: o.pickup_lng, latitudeDelta: 0.08, longitudeDelta: 0.08 }}>
            <Marker coordinate={{ latitude: o.pickup_lat, longitude: o.pickup_lng }} pinColor="#1E46D8" />
            <Marker coordinate={{ latitude: o.dropoff_lat, longitude: o.dropoff_lng }} pinColor="#12B76A" />
            {loc && tracking ? (
              <Marker coordinate={{ latitude: loc.lat, longitude: loc.lng }} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={{ backgroundColor: colors.primary, borderRadius: 18, padding: 6, borderWidth: 3, borderColor: "#fff" }}><Icon name="bicycle" size={18} color="#fff" /></View>
              </Marker>
            ) : null}
          </MapView>
          {tracking ? (
            <View style={{ position: "absolute", top: 10, start: 10, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, flexDirection: "row", gap: 6, alignItems: "center" }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
              <T v="small" w="bold">{eta ? t("order.driverEta", { min: eta }) : t("order.trackLive")}</T>
            </View>
          ) : null}
        </View>
      ) : null}

      {o.status === "delivered" ? (
        <Banner tone="success" icon="checkmark-done-circle" title={t("order.status_delivered")}
          action={<Button testID="confirm-received" title={t("order.confirmReceived")} kind="success" loading={busy === "confirm"}
            onPress={() => Alert.alert(t("order.confirmReceived"), t("order.confirmReceivedQ"), [
              { text: t("common.no"), style: "cancel" },
              { text: t("common.yes"), onPress: () => act("confirm", () => rpc("confirm_delivery", { p_order: id })) },
            ])} />} />
      ) : null}

      {o.status === "completed" && !o.my_rating && o.driver ? (
        <Card>
          <T v="h3">{t("order.rate")}</T>
          <Stars value={stars} onChange={setStars} size={34} />
          <TextField value={comment} onChangeText={setComment} placeholder={t("order.rateComment")} maxLength={500} />
          <Button title={t("common.send")} disabled={!stars} loading={busy === "rate"}
            onPress={() => act("rate", () => rpc("rate_order", { p_order: id, p_stars: stars, p_comment: comment || null }))} />
        </Card>
      ) : o.my_rating ? <Banner tone="success" icon="star" title={t("order.thanksRating")} /> : null}

      <Card>
        <RouteLine from={o.pickup_address} to={o.dropoff_address} />
        <T v="small" color="muted">{t("order.distance")}: {formatDistance(o.distance_m, lang)}</T>
      </Card>
      <OrderInfo o={o} showRecipient />
      {o.pickup_proof_path || o.delivery_proof_path ? (
        <Card><T w="bold">{t("order.proofPickup")} / {t("order.proofDelivery")}</T><PhotoStrip paths={[o.pickup_proof_path, o.delivery_proof_path]} /></Card>
      ) : null}
      <Timeline orderId={id} />
      {o.cancel_reason ? <Banner tone="danger" icon="close-circle" title={t("order.status_cancelled")} body={o.cancel_reason} /> : null}

      {o.status === "open" || o.status === "accepted" ? (
        <>
          <T v="caption" color="faint">{t("order.cancelPolicy")}</T>
          <Button testID="cancel-order" kind="ghost" icon="close-circle-outline" title={t("order.cancel")} loading={busy === "cancel"} onPress={cancel} />
        </>
      ) : null}
      {o.driver_id ? (
        <Button kind="ghost" small icon="flag-outline" title={t("order.report")}
          onPress={() => router.push({ pathname: "/support/new", params: { kind: "report_user", order: id, target: o.driver_id! } })} />
      ) : null}

      <PromptModal visible={cancelOpen} danger title={t("order.cancel")} body={t("order.cancelPolicy")} placeholder={t("order.cancelReasonPh")}
        onCancel={() => setCancelOpen(false)}
        onConfirm={async (reason) => { setCancelOpen(false); await act("cancel", () => rpc("cancel_order", { p_order: id, p_reason: reason })); }} />
    </Screen>
  );
}
