import { router } from "expo-router";
import { useState } from "react";
import { FlatList, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ACTIVE_STATUSES } from "@fazza/shared";
import { EmptyBoxScene } from "@/components/illustrations/Illustrations";
import { EmptyState, Screen, Segmented, T } from "@/components/ui";
import { OrderCard } from "@/features/OrderCard";
import { useMyOrders } from "@/features/useMyOrders";

type F = "active" | "done" | "cancelled";

export default function Orders() {
  const { t } = useTranslation();
  const [f, setF] = useState<F>("active");
  const { data, refetch, isRefetching } = useMyOrders();
  const list = (data ?? []).filter((o) =>
    f === "active" ? o.status === "open" || ACTIVE_STATUSES.includes(o.status) : f === "done" ? o.status === "completed" : o.status === "cancelled" || o.status === "expired");
  return (
    <Screen scroll={false}>
      <View style={{ gap: 12, marginTop: 8, marginBottom: 12 }}>
        <T v="h1">{t("order.history")}</T>
        <Segmented value={f} onChange={setF} options={[
          { value: "active", label: t("order.filter_active") }, { value: "done", label: t("order.filter_done") }, { value: "cancelled", label: t("order.filter_cancelled") },
        ]} />
      </View>
      <FlatList
        data={list}
        keyExtractor={(o) => o.id}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        ListEmptyComponent={<EmptyState art={<EmptyBoxScene />} title={t("order.empty")} />}
        renderItem={({ item }) => <OrderCard o={item} onPress={() => router.push({ pathname: "/order/[id]", params: { id: item.id } })} />}
      />
    </Screen>
  );
}
