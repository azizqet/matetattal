import NetInfo from "@react-native-community/netinfo";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Alert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { ORDER_CATEGORIES, type OrderCategory, errorMessage, formatDistance, normalizeKwPhone, parseKwdToFils } from "@fazza/shared";
import { Button, Card, Chips, Header, Icon, ImageTile, PhoneField, Screen, T, TextField } from "@/components/ui";
import { toFzError } from "@/lib/api";
import { useLang } from "@/lib/hooks";
import { haversineM } from "@/lib/location";
import { enqueueOrder, sendOrder } from "@/lib/outbox";
import { chooseImageSource, pickImage, randomId } from "@/lib/upload";
import { useQueryClient } from "@tanstack/react-query";
import { draftOrder, useDraftOrder, type PlaceDraft } from "@/state/draftOrder";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/theme/ThemeProvider";

const CAT_ICONS: Record<OrderCategory, "cube-outline" | "fast-food-outline" | "cart-outline" | "document-text-outline" | "bag-handle-outline" | "ellipsis-horizontal"> = {
  parcel: "cube-outline", food: "fast-food-outline", groceries: "cart-outline", documents: "document-text-outline", shopping: "bag-handle-outline", other: "ellipsis-horizontal",
};

function PlaceButton({ kind, place, testID }: { kind: "pickup" | "dropoff"; place: PlaceDraft | null; testID: string }) {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  return (
    <Pressable testID={testID} onPress={() => router.push({ pathname: "/pick-location", params: { target: kind } })}
      style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: place ? colors.border : colors.primary, borderStyle: place ? "solid" : "dashed" }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: kind === "pickup" ? colors.primarySoft : colors.successSoft, alignItems: "center", justifyContent: "center" }}>
        <Icon name={kind === "pickup" ? "cube" : "flag"} size={18} color={kind === "pickup" ? colors.primary : colors.success} />
      </View>
      <View style={{ flex: 1 }}>
        <T v="caption" color="muted">{t(kind === "pickup" ? "order.pickup" : "order.dropoff")}</T>
        <T w="semibold" numberOfLines={2}>{place?.address ?? t(kind === "pickup" ? "order.choosePickup" : "order.chooseDropoff")}</T>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

export default function NewOrder() {
  const { t } = useTranslation();
  const lang = useLang();
  const d = useDraftOrder();
  const { session } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const distance = d.pickup && d.dropoff ? haversineM({ latitude: d.pickup.lat, longitude: d.pickup.lng }, { latitude: d.dropoff.lat, longitude: d.dropoff.lng }) : null;

  const addPhoto = async () => {
    if (d.images.length >= 5) return;
    const src = await chooseImageSource();
    if (!src) return;
    const uri = await pickImage(src);
    if (uri) draftOrder.set({ images: [...draftOrder.get().images, uri] });
  };

  const submit = async () => {
    setError(null);
    if (!d.pickup || !d.dropoff) return setError(errorMessage("FZ_INVALID_LOCATION", lang));
    if (d.details.trim().length < 3) return setError(errorMessage("FZ_INVALID_ORDER", lang));
    const rp = d.recipient_phone.trim() ? normalizeKwPhone(d.recipient_phone) : null;
    if (d.recipient_phone.trim() && !rp) return setError(errorMessage("FZ_INVALID_PHONE", lang));
    const purchase = d.purchase.trim() ? parseKwdToFils(d.purchase) : null;
    if (d.purchase.trim() && purchase === null) return setError(errorMessage("FZ_INVALID_AMOUNT", lang));
    const id = randomId();
    const payload = {
      category: d.category, details: d.details.trim(),
      pickup: { lat: d.pickup.lat, lng: d.pickup.lng, address: d.pickup.address, notes: d.pickup.notes ?? null, area_id: d.pickup.area_id ?? null },
      dropoff: { lat: d.dropoff.lat, lng: d.dropoff.lng, address: d.dropoff.address, notes: d.dropoff.notes ?? null, area_id: d.dropoff.area_id ?? null },
      recipient_name: d.recipient_name.trim() || null, recipient_phone: rp, purchase_estimate_fils: purchase,
    };
    const item = { id, userId: session!.user.id, payload, localImages: d.images };
    setBusy(true);
    try {
      const net = await NetInfo.fetch();
      if (net.isConnected === false) {
        await enqueueOrder(item);
        draftOrder.reset();
        Alert.alert(t("order.new"), t("order.sentOffline"));
        return router.replace("/home");
      }
      await sendOrder(item);
      draftOrder.reset();
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      router.replace({ pathname: "/order/[id]", params: { id } });
    } catch (e) {
      const code = toFzError(e).code;
      if (code === "FZ_NETWORK") {
        await enqueueOrder(item);
        draftOrder.reset();
        Alert.alert(t("order.new"), t("order.sentOffline"));
        return router.replace("/home");
      }
      setError(errorMessage(code, lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button testID="submit-order" title={t("order.submit")} icon="paper-plane-outline" loading={busy} onPress={submit} />}>
      <Header title={t("order.new")} />
      <Card>
        <PlaceButton kind="pickup" place={d.pickup} testID="pick-pickup" />
        <PlaceButton kind="dropoff" place={d.dropoff} testID="pick-dropoff" />
        {distance !== null ? <T v="small" color="muted">{t("order.distance")}: {formatDistance(distance, lang)}</T> : null}
      </Card>
      <T w="semibold" color="muted">{t("order.category")}</T>
      <Chips testIDPrefix="cat" value={d.category} onChange={(c) => draftOrder.set({ category: c })}
        options={ORDER_CATEGORIES.map((c) => ({ value: c, label: t(`category.${c}`), icon: CAT_ICONS[c] }))} />
      <TextField testID="order-details" label={t("order.details")} value={d.details} onChangeText={(v) => draftOrder.set({ details: v })} placeholder={t("order.detailsPh")} multiline maxLength={1000} />
      <T w="semibold" color="muted">{t("order.photos")} ({d.images.length}/5)</T>
      <ScrollView horizontal contentContainerStyle={{ gap: 10 }} showsHorizontalScrollIndicator={false}>
        {d.images.map((uri, i) => (
          <ImageTile key={uri} uri={uri} onRemove={() => draftOrder.set({ images: d.images.filter((_, j) => j !== i) })} />
        ))}
        {d.images.length < 5 ? <ImageTile label={t("order.addPhoto")} onPress={addPhoto} /> : null}
      </ScrollView>
      <Card flat>
        <T w="semibold">{t("order.recipient")} <T v="small" color="faint">({t("common.optional")})</T></T>
        <TextField value={d.recipient_name} onChangeText={(v) => draftOrder.set({ recipient_name: v })} placeholder={t("order.recipientName")} icon="person-outline" />
        <PhoneField value={d.recipient_phone} onChangeText={(v) => draftOrder.set({ recipient_phone: v })} placeholder={t("order.recipientPhone")} />
      </Card>
      <TextField label={t("order.purchase")} hint={t("order.purchaseHint")} value={d.purchase} onChangeText={(v) => draftOrder.set({ purchase: v })} keyboardType="decimal-pad" prefix="KWD" />
      {error ? <T color="danger" w="semibold" testID="order-error">{error}</T> : null}
    </Screen>
  );
}
