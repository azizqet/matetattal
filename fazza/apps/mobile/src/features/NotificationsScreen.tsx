import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { EmptyBoxScene } from "@/components/illustrations/Illustrations";
import { Button, EmptyState, Icon, Screen, T } from "@/components/ui";
import { rpc } from "@/lib/api";
import { useLang } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import type { NotificationRow } from "@/lib/types";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/theme/ThemeProvider";

const ICONS: Record<string, "pricetag" | "checkmark-done" | "chatbubble" | "bicycle" | "cash" | "alert-circle" | "megaphone" | "notifications"> = {
  new_offer: "pricetag", offer_accepted: "checkmark-done", message: "chatbubble", new_order: "bicycle", receipt_approved: "cash",
  debt_limit: "alert-circle", broadcast: "megaphone",
};

export function NotificationsScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { data, refetch, isRefetching } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data: rows, error } = await supabase.from("notifications").select("*").order("id", { ascending: false }).limit(100);
      if (error) throw error;
      return rows as NotificationRow[];
    },
  });
  const open = async (n: NotificationRow) => {
    if (!n.read_at) {
      rpc("mark_notifications_read", { p_ids: [n.id] }).then(() => qc.invalidateQueries({ queryKey: ["unread"] })).catch(() => undefined);
    }
    const d = n.data as { order_id?: string; chat?: boolean; ticket_id?: string };
    if (d.chat && d.order_id) router.push({ pathname: "/chat/[id]", params: { id: d.order_id } });
    else if (d.order_id) router.push({ pathname: profile?.active_mode === "driver" ? "/driver/order/[id]" : "/order/[id]", params: { id: d.order_id } });
    else if (d.ticket_id) router.push({ pathname: "/support/[id]", params: { id: d.ticket_id } });
  };
  return (
    <Screen scroll={false}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 8 }}>
        <T v="h1">{t("notifications.title")}</T>
        <Button small kind="ghost" title={t("notifications.markAll")} onPress={async () => {
          await rpc("mark_notifications_read", { p_ids: null });
          qc.invalidateQueries({ queryKey: ["notifications"] });
          qc.invalidateQueries({ queryKey: ["unread"] });
        }} />
      </View>
      <FlatList
        data={data ?? []}
        keyExtractor={(n) => String(n.id)}
        onRefresh={refetch}
        refreshing={isRefetching}
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        ListEmptyComponent={<EmptyState art={<EmptyBoxScene />} title={t("notifications.empty")} />}
        renderItem={({ item: n }) => (
          <Pressable onPress={() => open(n)} style={{ flexDirection: "row", gap: 12, padding: 14, borderRadius: 18, backgroundColor: n.read_at ? colors.card : colors.primarySoft, borderWidth: 1, borderColor: colors.border }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
              <Icon name={ICONS[n.type] ?? "notifications"} size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T w="bold">{lang === "ar" ? n.title_ar : n.title_en}</T>
              {(lang === "ar" ? n.body_ar : n.body_en) ? <T v="small" color="muted">{lang === "ar" ? n.body_ar : n.body_en}</T> : null}
              <T v="caption" color="faint">{new Date(n.created_at).toLocaleString(lang === "ar" ? "ar-KW" : "en-GB")}</T>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}
