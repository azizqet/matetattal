import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { Alert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { Button, Card, EmptyState, Header, Icon, Screen, T } from "@/components/ui";
import { useErrorAlert } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme/ThemeProvider";

export default function Addresses() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const qc = useQueryClient();
  const showError = useErrorAlert();
  const { data } = useQuery({ queryKey: ["addresses"], queryFn: async () => (await supabase.from("saved_addresses").select("*").order("created_at", { ascending: false })).data ?? [] });
  const remove = (id: string) => Alert.alert(t("common.delete"), t("common.areYouSure"), [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("common.delete"), style: "destructive", onPress: async () => {
      const { error } = await supabase.from("saved_addresses").delete().eq("id", id);
      if (error) showError(error); else qc.invalidateQueries({ queryKey: ["addresses"] });
    } },
  ]);
  return (
    <Screen>
      <Header title={t("account.addresses")} />
      <Button icon="add" title={t("common.add")} onPress={() => router.push({ pathname: "/pick-location", params: { target: "address" } })} />
      {(data ?? []).length === 0 ? <EmptyState title={t("account.noAddresses")} /> : (data ?? []).map((a) => (
        <Card key={a.id}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Icon name="bookmark" color={colors.primary} />
            <View style={{ flex: 1 }}>
              <T w="bold">{a.label}</T>
              <T v="small" color="muted">{a.address_text}{a.notes ? ` · ${a.notes}` : ""}</T>
            </View>
            <Pressable onPress={() => remove(a.id)} hitSlop={8}><Icon name="trash-outline" color={colors.danger} /></Pressable>
          </View>
        </Card>
      ))}
    </Screen>
  );
}
