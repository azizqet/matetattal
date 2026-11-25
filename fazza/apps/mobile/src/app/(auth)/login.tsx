import { Link, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { errorMessage, normalizeKwPhone } from "@fazza/shared";
import { Button, Header, PhoneField, Screen, T, TextField } from "@/components/ui";
import { toFzError } from "@/lib/api";
import { useLang } from "@/lib/hooks";
import { useAuth } from "@/providers/AuthProvider";

export default function Login() {
  const { t } = useTranslation();
  const lang = useLang();
  const { signIn } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!normalizeKwPhone(phone)) return setError(errorMessage("FZ_INVALID_PHONE", lang));
    setBusy(true);
    try {
      await signIn(phone, password);
      router.replace("/");
    } catch (e) {
      setError(errorMessage(toFzError(e).code, lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={t("auth.login")} />
      <T color="muted">{t("auth.welcomeBody")}</T>
      <PhoneField testID="login-phone" label={t("auth.phone")} value={phone} onChangeText={setPhone} placeholder="5000 0000" />
      <TextField testID="login-password" label={t("auth.password")} value={password} onChangeText={setPassword} password autoComplete="current-password" textContentType="password" onSubmitEditing={submit} />
      {error ? <T testID="login-error" color="danger" w="semibold">{error}</T> : null}
      <Button testID="login-submit" title={t("auth.login")} loading={busy} disabled={!phone || !password} onPress={submit} />
      <Link href="/forgot-password" asChild><T w="semibold" color="primary" center accessibilityRole="link">{t("auth.forgot")}</T></Link>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
        <T color="muted">{t("auth.noAccount")}</T>
        <Link href="/register" replace asChild><T w="bold" color="primary" accessibilityRole="link">{t("auth.register")}</T></Link>
      </View>
    </Screen>
  );
}
