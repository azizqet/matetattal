import { useState } from "react";
import { Alert, View } from "react-native";
import { useTranslation } from "react-i18next";
import { displayKwPhone } from "@fazza/shared";
import { Avatar, Badge, Button, Header, Screen, T, TextField } from "@/components/ui";
import { publicUrl } from "@/lib/api";
import { useErrorAlert } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { chooseImageSource, pickImage, randomId, uploadImage } from "@/lib/upload";
import { useAuth } from "@/providers/AuthProvider";

export default function Profile() {
  const { t } = useTranslation();
  const { profile, refresh } = useAuth();
  const showError = useErrorAlert();
  const [name, setName] = useState(profile?.full_name ?? "");
  const [busy, setBusy] = useState(false);
  const changePhoto = async () => {
    const src = await chooseImageSource();
    if (!src || !profile) return;
    const uri = await pickImage(src);
    if (!uri) return;
    try {
      const path = await uploadImage("avatars", `${profile.id}/${randomId()}.jpg`, uri);
      const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", profile.id);
      if (error) throw error;
      await refresh();
    } catch (e) { showError(e); }
  };
  const save = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", profile.id);
      if (error) throw error;
      await refresh();
      Alert.alert(t("account.saved"));
    } catch (e) { showError(e); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <Header title={t("account.profile")} />
      <View style={{ alignItems: "center", gap: 10 }}>
        <Avatar uri={publicUrl("avatars", profile?.avatar_path)} name={profile?.full_name} size={96} />
        <Button small kind="secondary" icon="camera-outline" title={t("account.changePhoto")} onPress={changePhoto} />
      </View>
      <TextField label={t("auth.fullName")} value={name} onChangeText={setName} maxLength={80} />
      <TextField label={t("auth.phone")} value={`+965 ${displayKwPhone(profile?.phone)}`} editable={false} />
      <Badge tone={profile?.phone_verified ? "success" : "neutral"} label={profile?.phone_verified ? t("auth.phoneVerified") : t("auth.phoneUnverified")} />
      <T v="caption" color="faint">{t("auth.forgotBody")}</T>
      <Button title={t("common.save")} loading={busy} disabled={name.trim().length < 2} onPress={save} />
    </Screen>
  );
}
