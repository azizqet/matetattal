import { router } from "expo-router";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { Wordmark } from "@/components/illustrations/Logo";
import { ParcelScene } from "@/components/illustrations/Illustrations";
import { Button, Screen, Segmented, T } from "@/components/ui";
import { useLang } from "@/lib/hooks";
import { setLanguage } from "@/lib/i18n";

export default function Welcome() {
  const { t } = useTranslation();
  const lang = useLang();
  return (
    <Screen style={{ paddingTop: 12, flexGrow: 1, justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Wordmark size={46} />
        <View style={{ width: 120 }}>
          <Segmented value={lang} onChange={(l) => setLanguage(l)} options={[{ value: "ar", label: "عربي" }, { value: "en", label: "EN" }]} />
        </View>
      </View>
      <View style={{ alignItems: "center", gap: 10 }}>
        <ParcelScene width={320} />
        <T v="h1" center>{t("auth.welcome")}</T>
        <T color="muted" center>{t("auth.welcomeBody")}</T>
      </View>
      <View style={{ gap: 12 }}>
        <Button testID="go-register" title={t("auth.register")} icon="person-add-outline" onPress={() => router.push("/register")} />
        <Button testID="go-login" title={t("auth.login")} kind="secondary" icon="log-in-outline" onPress={() => router.push("/login")} />
      </View>
    </Screen>
  );
}
