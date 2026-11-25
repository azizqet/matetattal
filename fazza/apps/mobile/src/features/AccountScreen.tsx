import { router } from "expo-router";
import { Linking, View } from "react-native";
import { Alert } from "@/lib/alert";
import { useTranslation } from "react-i18next";
import { displayKwPhone } from "@fazza/shared";
import { Avatar, Badge, Card, Divider, Row, Screen, Segmented, T } from "@/components/ui";
import { publicUrl } from "@/lib/api";
import { APP_VERSION } from "@/lib/config";
import { useErrorAlert, useLang, useSettings } from "@/lib/hooks";
import { setLanguage } from "@/lib/i18n";
import { useAuth } from "@/providers/AuthProvider";
import { useThemePref } from "@/theme/ThemeProvider";

export function AccountScreen() {
  const { t } = useTranslation();
  const lang = useLang();
  const { profile, driver, signOut, setMode } = useAuth();
  const { pref, setPref } = useThemePref();
  const settings = useSettings().data;
  const showError = useErrorAlert();
  const isDriverMode = profile?.active_mode === "driver";

  const switchMode = async () => {
    try {
      if (isDriverMode) { await setMode("customer"); router.replace("/home"); }
      else if (driver) { await setMode("driver"); router.replace("/dashboard"); }
      else router.push("/driver/apply");
    } catch (e) { showError(e); }
  };

  return (
    <Screen>
      <T v="h1" style={{ marginTop: 8 }}>{t("account.title")}</T>
      <Card onPress={() => router.push("/account/profile")} testID="account-profile">
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Avatar uri={publicUrl("avatars", profile?.avatar_path)} name={profile?.full_name} size={58} />
          <View style={{ flex: 1, gap: 2 }}>
            <T v="h3">{profile?.full_name}</T>
            <T color="muted" style={{ writingDirection: "ltr", textAlign: lang === "ar" ? "right" : "left" }}>+965 {displayKwPhone(profile?.phone)}</T>
            <Badge tone={profile?.phone_verified ? "success" : "neutral"} label={profile?.phone_verified ? t("auth.phoneVerified") : t("auth.phoneUnverified")} />
          </View>
        </View>
      </Card>

      <Card>
        <Row icon={isDriverMode ? "person-outline" : "bicycle-outline"} title={isDriverMode ? t("home.switchToCustomer") : driver ? t("home.switchToDriver") : t("home.becomeDriver")}
          subtitle={!driver ? t("home.becomeDriverSub") : undefined} onPress={switchMode} testID="switch-mode" />
        <Divider />
        {!isDriverMode ? <><Row icon="bookmark-outline" title={t("account.addresses")} onPress={() => router.push("/account/addresses")} /><Divider /></> : null}
        {isDriverMode ? <><Row icon="star-outline" title={t("account.ratings")} onPress={() => router.push("/driver/ratings")} /><Divider /></> : null}
        <Row icon="key-outline" title={t("auth.changePassword")} onPress={() => router.push("/change-password")} />
        <Divider />
        <Row icon="chatbubbles-outline" title={t("account.support")} onPress={() => router.push("/support")} />
      </Card>

      <Card>
        <T w="semibold" color="muted">{t("account.language")}</T>
        <Segmented value={lang} onChange={(l) => setLanguage(l)} options={[{ value: "ar", label: "العربية" }, { value: "en", label: "English" }]} />
        <T w="semibold" color="muted">{t("account.theme")}</T>
        <Segmented value={pref} onChange={setPref} options={[
          { value: "system", label: t("account.theme_system") }, { value: "light", label: t("account.theme_light") }, { value: "dark", label: t("account.theme_dark") },
        ]} />
      </Card>

      <Card>
        <Row icon="document-text-outline" title={t("account.terms")} onPress={() => router.push({ pathname: "/legal", params: { doc: "terms" } })} />
        <Divider />
        <Row icon="shield-checkmark-outline" title={t("account.privacy")} onPress={() => router.push({ pathname: "/legal", params: { doc: "privacy" } })} />
        {settings?.support_whatsapp ? (<><Divider /><Row icon="logo-whatsapp" title={t("support.whatsapp")} onPress={() => Linking.openURL(`https://wa.me/${settings.support_whatsapp.replace(/[^0-9]/g, "")}`)} /></>) : null}
        <Divider />
        <Row icon="log-out-outline" title={t("auth.logout")} testID="logout" onPress={() => Alert.alert(t("auth.logout"), t("common.areYouSure"), [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("auth.logout"), style: "destructive", onPress: async () => { await signOut(); router.replace("/welcome"); } },
        ])} />
        <Divider />
        <Row icon="trash-outline" danger title={t("account.deleteAccount")} onPress={() => router.push("/account/delete")} />
      </Card>
      <T v="caption" color="faint" center>{t("account.version", { v: APP_VERSION })}</T>
    </Screen>
  );
}
