import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { formatDistance, formatKwd } from "@fazza/shared";
import { Badge, Card, Icon, T, statusTone } from "@/components/ui";
import { useLang } from "@/lib/hooks";
import { useTheme } from "@/theme/ThemeProvider";

export interface OrderLike {
  id: string; code?: string; status: string; category: string; pickup_address: string; dropoff_address?: string | null;
  delivery_fee_fils?: number | null; distance_m?: number | null; created_at: string;
}

export function RouteLine({ from, to }: { from: string; to: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <View style={{ alignItems: "center", paddingTop: 6 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary }} />
        <View style={{ width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 3 }} />
        <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: colors.success }} />
      </View>
      <View style={{ flex: 1, gap: 10 }}>
        <T v="small" numberOfLines={1}>{from}</T>
        <T v="small" numberOfLines={1}>{to}</T>
      </View>
    </View>
  );
}

export function OrderCard({ o, onPress, pending }: { o: OrderLike; onPress?: () => void; pending?: boolean }) {
  const { t } = useTranslation();
  const lang = useLang();
  return (
    <Card onPress={onPress} testID={`order-${o.code ?? o.id}`}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Icon name="cube-outline" size={18} />
          <T w="bold">{o.code ?? "…"}</T>
          <T v="small" color="muted">· {t(`category.${o.category}`)}</T>
        </View>
        {pending ? <Badge tone="warning" label={t("home.pendingSync")} /> : <Badge tone={statusTone(o.status)} label={t(`order.status_${o.status}`)} />}
      </View>
      <RouteLine from={o.pickup_address} to={o.dropoff_address ?? "—"} />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <T v="caption" color="muted">{new Date(o.created_at).toLocaleString(lang === "ar" ? "ar-KW" : "en-GB", { dateStyle: "medium", timeStyle: "short" })}</T>
        <T v="small" w="bold" color="primary">{o.delivery_fee_fils ? formatKwd(o.delivery_fee_fils, lang) : formatDistance(o.distance_m ?? null, lang)}</T>
      </View>
    </Card>
  );
}
