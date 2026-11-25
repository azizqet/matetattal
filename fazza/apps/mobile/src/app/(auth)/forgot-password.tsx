import { useState } from "react";
import { Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { errorMessage, normalizeKwPhone } from "@fazza/shared";
import { ShieldScene } from "@/components/illustrations/Illustrations";
import { Banner, Button, Header, PhoneField, Screen, T, TextField } from "@/components/ui";
import { callFunction, toFzError } from "@/lib/api";
import { useLang, useSettings } from "@/lib/hooks";

export default function ForgotPassword() {
  const { t } = useTranslation();
  const lang = useLang();
  const settings = useSettings().data;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const p = normalizeKwPhone(phone);
    if (!p) return setError(errorMessage("FZ_INVALID_PHONE", lang));
    if (name.trim().length < 2) return setError(errorMessage("FZ_INVALID_NAME", lang));
    setBusy(true);
    try {
      await callFunction("public-request", { kind: "password_reset", phone: p, full_name: name.trim(), note });
      setSent(true);
    } catch (e) {
      setError(errorMessage(toFzError(e).code, lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Header title={t("auth.forgotTitle")} />
      <ShieldScene width={200} />
      <T color="muted">{t("auth.forgotBody")}</T>
      {sent ? <Banner tone="success" icon="checkmark-circle" title={t("auth.forgotSent")} /> : (
        <>
          <TextField label={t("auth.fullName")} value={name} onChangeText={setName} icon="person-outline" />
          <PhoneField label={t("auth.phone")} value={phone} onChangeText={setPhone} placeholder="5000 0000" />
          <TextField label={`${t("auth.note")} (${t("common.optional")})`} value={note} onChangeText={setNote} multiline maxLength={1000} />
          {error ? <T color="danger" w="semibold">{error}</T> : null}
          <Button title={t("common.send")} loading={busy} onPress={submit} />
        </>
      )}
      {settings?.support_whatsapp ? (
        <Button kind="ghost" icon="logo-whatsapp" title={t("auth.contactSupport")}
          onPress={() => Linking.openURL(`https://wa.me/${settings.support_whatsapp.replace(/[^0-9]/g, "")}`)} />
      ) : null}
    </Screen>
  );
}
