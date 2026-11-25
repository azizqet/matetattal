import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Linking, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Badge, Button, Card, EmptyState, Header, Screen, T, statusTone } from "@/components/ui";
import { useLang, useSettings } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";

export default function Support() {
  const { t } = useTranslation();
  const lang = useLang();
  const s = useSettings().data;
  const { data, refetch, isRefetching } = useQuery({
    queryKey: ["tickets"],
    queryFn: async () => (await supabase.from("tickets").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  return (
    <Screen refreshing={isRefetching} onRefresh={refetch}>
      <Header title={t("support.title")} />
      <Card>
        <T w="bold">{t("support.contact")}</T>
        {s?.[lang === "ar" ? "support_hours_ar" : "support_hours_en"] ? <T v="small" color="muted">{s[lang === "ar" ? "support_hours_ar" : "support_hours_en"]}</T> : null}
        <View style={{ flexDirection: "row", gap: 10 }}>
          {s?.support_phone ? <Button style={{ flex: 1 }} small kind="secondary" icon="call" title={t("common.call")} onPress={() => Linking.openURL(`tel:${s.support_phone}`)} /> : null}
          {s?.support_whatsapp ? <Button style={{ flex: 1 }} small kind="secondary" icon="logo-whatsapp" title={t("support.whatsapp")} onPress={() => Linking.openURL(`https://wa.me/${s.support_whatsapp.replace(/[^0-9]/g, "")}`)} /> : null}
        </View>
      </Card>
      <Button icon="add-circle-outline" title={t("support.newTicket")} onPress={() => router.push("/support/new")} />
      {(data ?? []).length === 0 ? <EmptyState title={t("support.empty")} /> : (data ?? []).map((tk) => (
        <Card key={tk.id} onPress={() => router.push({ pathname: "/support/[id]", params: { id: tk.id } })}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <T w="bold" style={{ flex: 1 }} numberOfLines={1}>{tk.subject}</T>
            <Badge tone={statusTone(tk.status === "resolved" ? "completed" : tk.status === "rejected" ? "rejected" : "open")} label={t(`support.status_${tk.status}`)} />
          </View>
          <T v="small" color="muted">{t(`support.kind_${tk.kind}`, { defaultValue: tk.kind })} · {new Date(tk.created_at).toLocaleDateString(lang === "ar" ? "ar-KW" : "en-GB")}</T>
        </Card>
      ))}
    </Screen>
  );
}
