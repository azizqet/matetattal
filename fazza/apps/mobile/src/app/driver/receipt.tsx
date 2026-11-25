import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Alert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { errorMessage, filsToKwdString, formatKwd, parseKwdToFils } from "@fazza/shared";
import { Banner, Button, Chips, Header, ImageTile, Screen, T, TextField } from "@/components/ui";
import { rpc, toFzError } from "@/lib/api";
import { useDriverDashboard, useLang, useSettings } from "@/lib/hooks";
import { chooseImageSource, pickImage, randomId, uploadImage } from "@/lib/upload";
import { useAuth } from "@/providers/AuthProvider";

export default function Receipt() {
  const params = useLocalSearchParams<{ purpose?: "activation_fee" | "commission" }>();
  const { t } = useTranslation();
  const lang = useLang();
  const { session } = useAuth();
  const qc = useQueryClient();
  const d = useDriverDashboard().data;
  const s = useSettings().data;
  const [purpose, setPurpose] = useState<"activation_fee" | "commission">(params.purpose ?? "commission");
  const suggested = purpose === "activation_fee" ? d?.activation_fee_due_fils ?? s?.activation_fee_fils ?? 5000 : Math.max(d?.balance_fils ?? 0, 0);
  const [amount, setAmount] = useState(suggested ? filsToKwdString(suggested) : "");
  const [reference, setReference] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const fils = parseKwdToFils(amount);
    if (!fils) return setError(errorMessage("FZ_INVALID_AMOUNT", lang));
    if (!image) return setError(errorMessage("FZ_INVALID_IMAGE_PATH", lang));
    setBusy(true);
    try {
      const path = await uploadImage("receipts", `${session!.user.id}/${randomId()}.jpg`, image);
      await rpc("submit_receipt", { p_purpose: purpose, p_amount_fils: fils, p_image_path: path, p_reference: reference.trim() || null });
      qc.invalidateQueries({ queryKey: ["receipts"] });
      qc.invalidateQueries({ queryKey: ["driver-dashboard"] });
      Alert.alert(t("driver.receiptSent"));
      router.back();
    } catch (e) { setError(errorMessage(toFzError(e).code, lang)); } finally { setBusy(false); }
  };

  return (
    <Screen footer={<Button testID="submit-receipt" title={t("common.send")} loading={busy} onPress={submit} />}>
      <Header title={t("driver.uploadReceipt")} />
      <Banner icon="information-circle" title={t("driver.receiptNotAuto")} body={(lang === "ar" ? s?.payment_instructions_ar : s?.payment_instructions_en) || undefined} />
      <T w="semibold" color="muted">{t("driver.purpose")}</T>
      <Chips value={purpose} onChange={(p) => { setPurpose(p); }} options={[
        ...(d && !d.activation_paid ? [{ value: "activation_fee" as const, label: t("driver.purpose_activation_fee") }] : []),
        { value: "commission" as const, label: t("driver.purpose_commission") },
      ]} />
      <TextField label={t("driver.amount")} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" prefix="KWD" hint={suggested ? formatKwd(suggested, lang) : undefined} />
      <TextField label={`${t("driver.reference")} (${t("common.optional")})`} value={reference} onChangeText={setReference} maxLength={100} />
      <T w="semibold" color="muted">{t("driver.receiptPhoto")}</T>
      <View><ImageTile size={140} uri={image} label={t("driver.receiptPhoto")} onRemove={() => setImage(null)} onPress={async () => {
        const src = await chooseImageSource();
        if (!src) return;
        const uri = await pickImage(src);
        if (uri) setImage(uri);
      }} /></View>
      {error ? <T color="danger" w="semibold">{error}</T> : null}
    </Screen>
  );
}
