import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { VEHICLE_TYPES, type VehicleType, errorMessage } from "@fazza/shared";
import { Banner, Button, Chips, Header, ImageTile, Screen, T, TextField } from "@/components/ui";
import { rpc, toFzError } from "@/lib/api";
import { useLang } from "@/lib/hooks";
import { randomId, chooseImageSource, pickImage, uploadImage } from "@/lib/upload";
import { useAuth } from "@/providers/AuthProvider";

const REQUIRED = ["photo", "civil_id_front", "civil_id_back", "driving_license", "vehicle_registration"] as const;
const OPTIONAL = ["permit", "other"] as const;
type Kind = (typeof REQUIRED)[number] | (typeof OPTIONAL)[number];

export default function Apply() {
  const { t } = useTranslation();
  const lang = useLang();
  const { session, driver, refresh } = useAuth();
  const [vehicle, setVehicle] = useState<VehicleType>(driver?.vehicle_type ?? "motorcycle");
  const [model, setModel] = useState(driver?.vehicle_model ?? "");
  const [plate, setPlate] = useState(driver?.plate_number ?? "");
  const [docs, setDocs] = useState<Partial<Record<Kind, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (driver && driver.status !== "rejected") {
    return (
      <Screen>
        <Header title={t("driver.apply")} />
        <Banner tone="primary" icon="time-outline" title={t("driver.pendingTitle")} body={t("driver.pendingBody")} />
        <Button title={t("common.close")} onPress={() => router.replace("/dashboard")} />
      </Screen>
    );
  }

  const pick = async (k: Kind) => {
    const src = await chooseImageSource();
    if (!src) return;
    const uri = await pickImage(src);
    if (uri) setDocs((d) => ({ ...d, [k]: uri }));
  };

  const submit = async () => {
    setError(null);
    if (REQUIRED.some((k) => !docs[k])) return setError(errorMessage("FZ_MISSING_DOCUMENTS", lang));
    if (plate.trim().length < 2) return setError(errorMessage("FZ_INVALID_PLATE", lang));
    setBusy(true);
    try {
      const uid = session!.user.id;
      const uploaded = [];
      for (const [kind, uri] of Object.entries(docs)) {
        if (!uri) continue;
        // Identity documents go to a PRIVATE bucket readable only by the owner and FAZZA staff.
        const path = await uploadImage("driver-docs", `${uid}/${kind}-${randomId()}.jpg`, uri);
        uploaded.push({ kind, path });
      }
      if (docs.photo) {
        const avatar = await uploadImage("avatars", `${uid}/${randomId()}.jpg`, docs.photo);
        await import("@/lib/supabase").then(({ supabase }) => supabase.from("profiles").update({ avatar_path: avatar }).eq("id", uid));
      }
      await rpc("register_driver", { p_vehicle_type: vehicle, p_vehicle_model: model.trim(), p_plate: plate.trim(), p_documents: uploaded });
      await refresh();
      router.replace("/dashboard");
    } catch (e) {
      setError(errorMessage(toFzError(e).code, lang));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen footer={<Button testID="submit-application" title={t("driver.submitApplication")} loading={busy} onPress={submit} />}>
      <Header title={t("driver.apply")} />
      {driver?.status === "rejected" ? <Banner tone="danger" icon="close-circle" title={t("driver.rejectedTitle")} body={driver.status_reason ?? undefined} /> : null}
      <T color="muted">{t("driver.applyIntro")}</T>
      <T w="semibold" color="muted">{t("driver.vehicleType")}</T>
      <Chips value={vehicle} onChange={setVehicle} options={VEHICLE_TYPES.map((v) => ({ value: v, label: t(`vehicle.${v}`) }))} />
      <TextField label={`${t("driver.vehicleModel")} (${t("common.optional")})`} value={model} onChangeText={setModel} maxLength={60} />
      <TextField testID="plate" label={t("driver.plate")} value={plate} onChangeText={setPlate} maxLength={20} autoCapitalize="characters" />
      <T w="semibold" color="muted">{t("driver.docs")}</T>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {[...REQUIRED, ...OPTIONAL].map((k) => (
          <ImageTile key={k} size={104} uri={docs[k]} label={`${t(`driver.doc_${k}`)}${(OPTIONAL as readonly string[]).includes(k) ? ` (${t("common.optional")})` : ""}`}
            onPress={() => pick(k)} onRemove={() => setDocs((d) => ({ ...d, [k]: undefined }))} />
        ))}
      </View>
      {error ? <T color="danger" w="semibold">{error}</T> : null}
    </Screen>
  );
}
