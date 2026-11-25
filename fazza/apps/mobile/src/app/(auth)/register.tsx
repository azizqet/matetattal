import { Link, router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import { errorMessage, normalizeKwPhone, passwordIsStrong } from "@fazza/shared";
import { Button, Header, Icon, PhoneField, Screen, T, TextField } from "@/components/ui";
import { toFzError } from "@/lib/api";
import { useLang } from "@/lib/hooks";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/theme/ThemeProvider";

export default function Register() {
  const { t } = useTranslation();
  const lang = useLang();
  const { colors } = useTheme();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    const e: Record<string, string> = {};
    if (name.trim().length < 2) e.name = errorMessage("FZ_INVALID_NAME", lang);
    if (!normalizeKwPhone(phone)) e.phone = errorMessage("FZ_INVALID_PHONE", lang);
    if (!passwordIsStrong(pw)) e.pw = errorMessage("FZ_WEAK_PASSWORD", lang);
    if (pw !== pw2) e.pw2 = t("auth.mismatch");
    if (!accept) e.terms = errorMessage("FZ_TERMS_REQUIRED", lang);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await signUp(name.trim(), phone, pw, lang);
      router.replace("/");
    } catch (err) {
      const code = toFzError(err).code;
      setErrors(code === "FZ_PHONE_TAKEN" || code === "FZ_INVALID_PHONE" ? { phone: errorMessage(code, lang) } : { form: errorMessage(code, lang) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={t("auth.register")} />
      <TextField testID="reg-name" label={t("auth.fullName")} value={name} onChangeText={setName} autoComplete="name" textContentType="name" error={errors.name} icon="person-outline" />
      <PhoneField testID="reg-phone" label={t("auth.phone")} value={phone} onChangeText={setPhone} placeholder="5000 0000" error={errors.phone} />
      <TextField testID="reg-password" label={t("auth.password")} value={pw} onChangeText={setPw} password hint={t("auth.passwordHint")} error={errors.pw} autoComplete="new-password" textContentType="newPassword" />
      <TextField testID="reg-password2" label={t("auth.confirmPassword")} value={pw2} onChangeText={setPw2} password error={errors.pw2} autoComplete="new-password" />
      <Pressable testID="reg-terms" onPress={() => setAccept((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: accept }}
        style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: accept ? colors.primary : colors.border, backgroundColor: accept ? colors.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
          {accept ? <Icon name="checkmark" size={16} color="#fff" /> : null}
        </View>
        <T style={{ flex: 1 }}>
          {t("auth.acceptTerms")}{" "}
          <Link href={{ pathname: "/legal", params: { doc: "terms" } }}><T w="bold" color="primary">{t("auth.terms")}</T></Link>
          {" "}{t("auth.and")}{" "}
          <Link href={{ pathname: "/legal", params: { doc: "privacy" } }}><T w="bold" color="primary">{t("auth.privacy")}</T></Link>
        </T>
      </Pressable>
      {errors.terms ? <T v="caption" color="danger">{errors.terms}</T> : null}
      {errors.form ? <T color="danger" w="semibold">{errors.form}</T> : null}
      <Button testID="reg-submit" title={t("auth.register")} loading={busy} onPress={submit} />
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
        <T color="muted">{t("auth.haveAccount")}</T>
        <Link href="/login" replace asChild><T w="bold" color="primary" accessibilityRole="link">{t("auth.login")}</T></Link>
      </View>
    </Screen>
  );
}
