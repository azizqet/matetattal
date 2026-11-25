import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon } from "./Icon";
import { T } from "./T";

export function Header({ title, right, back = true, subtitle }: { title: string; right?: ReactNode; back?: boolean; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 6, paddingBottom: 4 }}>
      {back ? (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
          accessibilityRole="button" accessibilityLabel="back" hitSlop={10}
          style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border }}
        >
          <Icon name="chevron-back" size={22} />
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <T v="h2" numberOfLines={1}>{title}</T>
        {subtitle ? <T v="small" color="muted" numberOfLines={1}>{subtitle}</T> : null}
      </View>
      {right}
    </View>
  );
}
