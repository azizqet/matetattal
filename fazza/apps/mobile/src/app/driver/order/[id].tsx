import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Linking, View } from "react-native";
import { useTranslation } from "react-i18next";
import { bpsToPercentString, driverNetFils, formatDistance, formatKwd, nextDriverStatus, parseKwdToFils, errorMessage } from "@fazza/shared";
import { MapView, Marker, PROVIDER_DEFAULT } from "@/components/map/Map";
import { Avatar, Badge, Banner, Button, Card, Header, Loading, PromptModal, Screen, Stars, T, TextField, statusTone } from "@/components/ui";
import { RouteLine } from "@/features/OrderCard";
import { OrderInfo, PhotoStrip, StatusSteps, Timeline } from "@/features/OrderParts";
import { rpc, toFzError } from "@/lib/api";
import { useDriverDashboard, useErrorAlert, useLang, useRealtimeInvalidate, useSettings } from "@/lib/hooks";
import { currentPosition, openNavigation } from "@/lib/location";
import type { OrderDetail } from "@/lib/types";
import { pickImage, randomId, uploadImage } from "@/lib/upload";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/theme/ThemeProvider";

interface Prospect {
  id: string; code: string; status: string; role: "prospect"; category: string; details: string; pickup_address: string;
  pickup_lat: number; pickup_lng: number; dropoff_approx_lat: number; dropoff_approx_lng: number; distance_m: number;
  purchase_estimate_fils: number | null; image_paths: string[]; created_at: string; expires_at: string;
  my_offer: { id: string; price_fils: number; eta_minutes: number } | null;
}

export default function DriverOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const lang = useLang();
  const { colors } = useTheme();
  const { session } = useAuth();
  const qc = useQueryClient();
  const showError = useErrorAlert();
  const settings = useSettings().data;
  const dash = useDriverDashboard();
  const [price, setPrice] = useState("");
  const [eta, setEta] = useState("15");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [stars, setStars] = useState(0);

  const q = useQuery({ queryKey: ["order", id], queryFn: () => rpc<OrderDetail | Prospect>("get_order", { p_order: id }), retry: 0 });
  useRealtimeInvalidate(`dorder-${id}`, "orders", `id=eq.${id}`, [["order", id], ["order-events", id]]);
  useRealtimeInvalidate(`doffer-${id}`, "offers", `order_id=eq.${id}`, [["order", id]]);
  const o = q.data;
  const bps = settings?.commission_bps ?? 1500;
  const fils = parseKwdToFils(price);

  if (q.isLoading) return <Screen scroll={false}><Header title={t("order.code")} /><Loading /></Screen>;
  if (!o) return <Screen><Header title={t("order.code")} /><Banner tone="danger" icon="close-circle" title={errorMessage("FZ_ORDER_NOT_OPEN", lang)} /></Screen>;

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["order", id] }), qc.invalidateQueries({ queryKey: ["driver-active"] }), qc.invalidateQueries({ queryKey: ["open-orders"] })]);
  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try { await fn(); await refresh(); } catch (e) { showError(e); } finally { setBusy(null); }
  };

  // ---------- Prospect (open order): send a price offer ----------
  if (o.role === "prospect") {
    const p = o as Prospect;
    const submit = async () => {
      setFormError(null);
      if (fils === null || fils < (settings?.min_offer_fils ?? 250) || fils > (settings?.max_offer_fils ?? 100000) || fils % 5 !== 0) return setFormError(errorMessage("FZ_INVALID_PRICE", lang));
      const etaN = parseInt(eta, 10);
      if (!(etaN >= 1 && etaN <= 240)) return setFormError(errorMessage("FZ_INVALID_ETA", lang));
      setBusy("offer");
      try {
        const pos = await currentPosition();
        await rpc("submit_offer", { p_order: id, p_price_fils: fils, p_eta_minutes: etaN, p_note: note.trim() || null, p_lat: pos?.latitude ?? null, p_lng: pos?.longitude ?? null });
        Alert.alert(t("driver.offerSent"));
        await refresh();
      } catch (e) { setFormError(errorMessage(toFzError(e).code, lang)); } finally { setBusy(null); }
    };
    return (
      <Screen footer={dash.data?.can_receive ? <Button testID="send-offer" title={p.my_offer ? t("driver.updateOffer") : t("driver.makeOffer")} icon="pricetag" loading={busy === "offer"} onPress={submit} /> : undefined}>
        <Header title={`${t(`category.${p.category}`)} · ${p.code}`} />
        <View style={{ height: 200, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
          <MapView provider={PROVIDER_DEFAULT} style={{ flex: 1 }} initialRegion={{ latitude: p.pickup_lat, longitude: p.pickup_lng, latitudeDelta: 0.12, longitudeDelta: 0.12 }}>
            <Marker coordinate={{ latitude: p.pickup_lat, longitude: p.pickup_lng }} pinColor="#1E46D8" />
            <Marker coordinate={{ latitude: p.dropoff_approx_lat, longitude: p.dropoff_approx_lng }} pinColor="#12B76A" />
          </MapView>
        </View>
        <Card>
          <RouteLine from={p.pickup_address} to={`~ ${formatDistance(p.distance_m, lang)}`} />
          <T>{p.details}</T>
          <PhotoStrip paths={p.image_paths} />
          {p.purchase_estimate_fils ? <T v="small" color="muted">{t("order.purchase")}: {formatKwd(p.purchase_estimate_fils, lang)}</T> : null}
        </Card>
        {p.my_offer ? (
          <Banner tone="success" icon="pricetag" title={t("driver.myOffer", { price: formatKwd(p.my_offer.price_fils, lang) })}
            action={<Button small kind="ghost" title={t("driver.withdraw")} loading={busy === "withdraw"} onPress={() => act("withdraw", () => rpc("withdraw_offer", { p_offer: p.my_offer!.id }))} />} />
        ) : null}
        {dash.data && !dash.data.can_receive ? (
          <Banner tone="warning" icon="alert-circle" title={errorMessage(`FZ_CANNOT_RECEIVE:${dash.data.block_reason}`, lang)} />
        ) : (
          <Card>
            <T v="h3">{t("driver.makeOffer")}</T>
            <TextField testID="offer-price" label={t("driver.yourPrice")} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="1.500" prefix="KWD" />
            {fils ? <T v="small" color="success" w="semibold">{t("driver.youGet", { pct: bpsToPercentString(bps), net: formatKwd(driverNetFils(fils, bps), lang) })}</T> : null}
            <TextField testID="offer-eta" label={t("driver.eta")} value={eta} onChangeText={setEta} keyboardType="number-pad" maxLength={3} />
            <TextField label={`${t("driver.note")} (${t("common.optional")})`} value={note} onChangeText={setNote} maxLength={200} />
            {formError ? <T color="danger" w="semibold">{formError}</T> : null}
          </Card>
        )}
      </Screen>
    );
  }

  // ---------- Assigned order ----------
  const d = o as OrderDetail;
  const next = nextDriverStatus(d.status);
  const isMine = d.driver_id === session?.user.id;
  const advance = async () => {
    if (!next) return;
    let proof: string | null = null;
    if (settings?.require_proof_photos !== false) {
      const uri = await pickImage("camera");
      if (!uri) return;
      setBusy("advance");
      try { proof = await uploadImage("order-files", `proof/${id}/${session!.user.id}/${randomId()}.jpg`, uri); }
      catch (e) { setBusy(null); return showError(e); }
    }
    await act("advance", () => rpc("driver_update_status", { p_order: id, p_status: next, p_proof_path: proof }));
  };
  const dest = d.status === "accepted" ? { latitude: d.pickup_lat, longitude: d.pickup_lng } : { latitude: d.dropoff_lat, longitude: d.dropoff_lng };

  return (
    <Screen>
      <Header title={`${t("order.code")} ${d.code}`} right={<Badge tone={statusTone(d.status)} label={t(`order.status_${d.status}`)} />} />
      <StatusSteps status={d.status} />
      {isMine && (d.status === "accepted" || d.status === "picked_up") ? <Banner icon="locate" title={t("driver.sharingLocation")} /> : null}
      <View style={{ height: 220, borderRadius: 22, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
        <MapView provider={PROVIDER_DEFAULT} style={{ flex: 1 }} showsUserLocation initialRegion={{ ...dest, latitudeDelta: 0.06, longitudeDelta: 0.06 }}>
          <Marker coordinate={{ latitude: d.pickup_lat, longitude: d.pickup_lng }} pinColor="#1E46D8" />
          <Marker coordinate={{ latitude: d.dropoff_lat, longitude: d.dropoff_lng }} pinColor="#12B76A" />
        </MapView>
      </View>
      <Card>
        <RouteLine from={d.pickup_address} to={d.dropoff_address} />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <T v="small" color="muted">{t("order.fee")}</T>
          <T w="bold" color="primary">{formatKwd(d.delivery_fee_fils, lang)}</T>
        </View>
        {d.commission_fils != null ? <T v="caption" color="muted">{t("driver.ledger_commission")}: {formatKwd(d.commission_fils, lang)}</T> : null}
      </Card>
      {d.customer ? (
        <Card>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Avatar name={d.customer.full_name} />
            <View style={{ flex: 1 }}>
              <T v="small" color="muted">{t("order.customer")}</T>
              <T w="bold">{d.customer.full_name}</T>
            </View>
          </View>
          {d.status !== "completed" && d.status !== "cancelled" ? (
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Button style={{ flex: 1 }} small kind="secondary" icon="call" title={t("common.call")} onPress={() => Linking.openURL(`tel:${d.customer!.phone}`)} />
              <Button style={{ flex: 1 }} small kind="secondary" icon="chatbubble-ellipses" title={t("common.chat")} onPress={() => router.push({ pathname: "/chat/[id]", params: { id } })} />
              <Button style={{ flex: 1 }} small kind="secondary" icon="navigate" title={t("driver.navigate")} onPress={() => openNavigation(dest)} />
            </View>
          ) : null}
        </Card>
      ) : null}
      {isMine && next ? (
        <Button testID="advance-status" kind="success" icon="camera" title={next === "picked_up" ? t("driver.markPicked") : t("driver.markDelivered")} loading={busy === "advance"} onPress={advance} />
      ) : null}
      {d.status === "delivered" ? <Banner tone="success" icon="hourglass-outline" title={t("driver.waitingConfirm")} /> : null}
      {d.status === "completed" && !d.my_rating ? (
        <Card>
          <T v="h3">{t("order.rateCustomer")}</T>
          <Stars value={stars} onChange={setStars} size={32} />
          <Button title={t("common.send")} disabled={!stars} loading={busy === "rate"} onPress={() => act("rate", () => rpc("rate_order", { p_order: id, p_stars: stars, p_comment: null }))} />
        </Card>
      ) : null}
      <OrderInfo o={d} showRecipient />
      <Timeline orderId={id} />
      {isMine && d.status === "accepted" ? (
        <>
          <T v="caption" color="faint">{t("driver.cancelPolicy")}</T>
          <Button kind="ghost" icon="close-circle-outline" title={t("order.cancel")} loading={busy === "cancel"} onPress={() => setCancelOpen(true)} />
        </>
      ) : null}
      <Button kind="ghost" small icon="flag-outline" title={t("order.report")}
        onPress={() => router.push({ pathname: "/support/new", params: { kind: "report_user", order: id, target: d.customer_id } })} />
      <PromptModal visible={cancelOpen} danger title={t("order.cancel")} body={t("driver.cancelPolicy")} placeholder={t("order.cancelReasonPh")}
        onCancel={() => setCancelOpen(false)}
        onConfirm={async (reason) => { setCancelOpen(false); await act("cancel", () => rpc("cancel_order", { p_order: id, p_reason: reason })); router.back(); }} />
    </Screen>
  );
}
