import { router } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { errorMessage, passwordIsStrong } from "@fazza/shared";
import { Banner, Button, Header, Screen, T, TextField } from "@/components/ui";
import { callFunction, rpc, toFzError } from "@/lib/api";
import { useLang } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

export default function ChangePassword() {
  const { t } = useTranslation();
  const lang = useLang();
  const { profile, refresh } = useAuth();
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!passwordIsStrong(pw)) return setError(errorMessage("FZ_WEAK_PASSWORD", lang));
    if (pw !== pw2) return setError(t("auth.mismatch"));
    setBusy(true);
    try {
      // Re-verify the current password before changing it.
      await callFunction("auth-login", { phone: profile?.phone, password: current });
      const { error: e } = await supabase.auth.updateUser({ password: pw });
      if (e) throw e;
      await rpc("clear_must_change_password");
      await refresh();
      Alert.alert(t("auth.passwordChanged"));
      router.replace("/");
    } catch (e) {
      setError(errorMessage(toFzError(e).code, lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={t("auth.changePassword")} back={!profile?.must_change_password} />
      {profile?.must_change_password ? <Banner tone="warning" icon="key-outline" title={t("auth.mustChange")} /> : null}
      <TextField label={t("auth.currentPassword")} value={current} onChangeText={setCurrent} password />
      <TextField label={t("auth.newPassword")} value={pw} onChangeText={setPw} password hint={t("auth.passwordHint")} />
      <TextField label={t("auth.confirmPassword")} value={pw2} onChangeText={setPw2} password />
      {error ? <T color="danger" w="semibold">{error}</T> : null}
      <Button title={t("common.save")} loading={busy} disabled={!current || !pw} onPress={submit} />
    </Screen>
  );
}
