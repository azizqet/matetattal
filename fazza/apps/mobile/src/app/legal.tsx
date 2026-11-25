import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Header, Loading, Screen, T } from "@/components/ui";
import { useLang, useSettings } from "@/lib/hooks";

export default function Legal() {
  const { doc } = useLocalSearchParams<{ doc: "terms" | "privacy" }>();
  const { t } = useTranslation();
  const lang = useLang();
  const { data, isLoading } = useSettings();
  const key = `${doc === "privacy" ? "privacy" : "terms"}_${lang}` as const;
  const text = data ? (data[key] as string) : "";
  return (
    <Screen>
      <Header title={doc === "privacy" ? t("account.privacy") : t("account.terms")} />
      {isLoading ? <Loading /> : <T selectable style={{ lineHeight: 26 }}>{text || "—"}</T>}
    </Screen>
  );
}
