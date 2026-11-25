import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { errorMessage } from "@fazza/shared";
import { Banner, Button, Header, Screen, T, TextField } from "@/components/ui";
import { callFunction, toFzError } from "@/lib/api";
import { useLang } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/providers/QueryProvider";

export default function DeleteAccount() {
  const { t } = useTranslation();
  const lang = useLang();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = () => Alert.alert(t("account.deleteTitle"), t("common.areYouSure"), [
    { text: t("common.cancel"), style: "cancel" },
    { text: t("common.delete"), style: "destructive", onPress: async () => {
      setBusy(true); setError(null);
      try {
        await callFunction("delete-account", { password: pw }, true);
        await supabase.auth.signOut().catch(() => undefined);
        queryClient.clear();
        Alert.alert(t("account.deleted"));
        router.replace("/welcome");
      } catch (e) { setError(errorMessage(toFzError(e).code, lang)); } finally { setBusy(false); }
    } },
  ]);
  return (
    <Screen>
      <Header title={t("account.deleteAccount")} />
      <Banner tone="danger" icon="warning" title={t("account.deleteTitle")} body={t("account.deleteBody")} />
      <TextField label={t("account.deleteConfirm")} value={pw} onChangeText={setPw} password />
      {error ? <T color="danger" w="semibold">{error}</T> : null}
      <Button kind="danger" icon="trash" title={t("account.deleteAccount")} disabled={!pw} loading={busy} onPress={run} />
    </Screen>
  );
}
