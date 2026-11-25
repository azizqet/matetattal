import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon } from "./Icon";
import { T } from "./T";

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false && s.isInternetReachable !== false)), []);
  return online;
}

export function OfflineBanner() {
  const online = useOnline();
  const { colors } = useTheme();
  const { t } = useTranslation();
  if (online) return null;
  return (
    <View accessibilityLiveRegion="polite" style={{ backgroundColor: colors.warningSoft, paddingVertical: 8, paddingHorizontal: 16, flexDirection: "row", gap: 8, alignItems: "center" }}>
      <Icon name="cloud-offline-outline" size={18} color={colors.warning} />
      <T v="small" w="semibold" color={colors.warning} style={{ flex: 1 }}>{t("common.offline")}</T>
    </View>
  );
}
