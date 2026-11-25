import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Animated, Linking, Platform, Pressable, ScrollView, View } from "react-native";
import { useTranslation } from "react-i18next";
import { STATUS_STEPS, type OrderStatus, formatKwd } from "@fazza/shared";
import { Card, Icon, T } from "@/components/ui";
import { useLang, useSignedUrl } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import type { Order } from "@/lib/types";
import { useTheme } from "@/theme/ThemeProvider";

export function useOrderEvents(orderId: string) {
  return useQuery({
    queryKey: ["order-events", orderId],
    queryFn: async () => (await supabase.from("order_events").select("to_status,created_at,note").eq("order_id", orderId).order("id")).data ?? [],
  });
}

export function StatusSteps({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const idx = STATUS_STEPS.indexOf(status);
  if (idx < 0) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {STATUS_STEPS.map((s, i) => (
        <View key={s} style={{ flex: 1, gap: 4 }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: i <= idx ? colors.primary : colors.border }} />
          {i === idx ? <T v="caption" color="primary" w="bold" numberOfLines={1}>{t(`order.status_${s}`)}</T> : <View style={{ height: 17 }} />}
        </View>
      ))}
    </View>
  );
}

export function Pulse({ children }: { children: React.ReactNode }) {
  const v = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 900, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(v, { toValue: 0, duration: 900, useNativeDriver: Platform.OS !== "web" }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] }}>{children}</Animated.View>;
}

function Photo({ path, bucket = "order-files" }: { path: string; bucket?: string }) {
  const { data } = useSignedUrl(bucket, path);
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => data && (Platform.OS === "web" ? setOpen(!open) : Linking.openURL(data))}>
      <View style={{ width: 92, height: 92, borderRadius: 14, overflow: "hidden", backgroundColor: colors.primarySoft }}>
        {data ? <Image source={{ uri: data }} style={{ width: 92, height: 92 }} contentFit="cover" /> : null}
      </View>
    </Pressable>
  );
}

export function PhotoStrip({ paths }: { paths: (string | null | undefined)[] }) {
  const list = paths.filter(Boolean) as string[];
  if (!list.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {list.map((p) => <Photo key={p} path={p} />)}
    </ScrollView>
  );
}

export function OrderInfo({ o, showRecipient }: { o: Order; showRecipient: boolean }) {
  const { t } = useTranslation();
  const lang = useLang();
  return (
    <Card>
      <T w="bold">{t("order.details")} · {t(`category.${o.category}`)}</T>
      <T>{o.details}</T>
      <PhotoStrip paths={o.image_paths} />
      {o.pickup_notes ? <T v="small" color="muted">{t("order.pickup")}: {o.pickup_notes}</T> : null}
      {o.dropoff_notes ? <T v="small" color="muted">{t("order.dropoff")}: {o.dropoff_notes}</T> : null}
      {showRecipient && (o.recipient_name || o.recipient_phone) ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="person-outline" size={18} />
          <T v="small">{[o.recipient_name, o.recipient_phone].filter(Boolean).join(" · ")}</T>
          {o.recipient_phone ? <Pressable onPress={() => Linking.openURL(`tel:${o.recipient_phone}`)}><Icon name="call" size={18} /></Pressable> : null}
        </View>
      ) : null}
      {o.purchase_estimate_fils ? <T v="small" color="muted">{t("order.purchase")}: {formatKwd(o.purchase_estimate_fils, lang)}</T> : null}
    </Card>
  );
}

export function Timeline({ orderId }: { orderId: string }) {
  const { t } = useTranslation();
  const lang = useLang();
  const { colors } = useTheme();
  const { data } = useOrderEvents(orderId);
  if (!data?.length) return null;
  return (
    <Card>
      <T w="bold">{t("order.timeline")}</T>
      {data.map((e, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: i === data.length - 1 ? colors.primary : colors.border }} />
          <T v="small" style={{ flex: 1 }}>{t(`order.status_${e.to_status}`)}</T>
          <T v="caption" color="faint">{new Date(e.created_at).toLocaleTimeString(lang === "ar" ? "ar-KW" : "en-GB", { hour: "2-digit", minute: "2-digit" })}</T>
        </View>
      ))}
    </Card>
  );
}
