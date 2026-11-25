import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "@/theme/ThemeProvider";
import { OfflineBanner } from "./OfflineBanner";

export function Screen({ children, scroll = true, edges = ["top"], padded = true, refreshing, onRefresh, footer, style, bg }: {
  children: ReactNode; scroll?: boolean; edges?: Edge[]; padded?: boolean; refreshing?: boolean; onRefresh?: () => void;
  footer?: ReactNode; style?: ViewStyle; bg?: string;
}) {
  const { colors, dark } = useTheme();
  const pad = padded ? { paddingHorizontal: 20 } : null;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: bg ?? colors.bg }}>
      <StatusBar style={dark ? "light" : "dark"} />
      <OfflineBanner />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[{ paddingBottom: 32, gap: 16 }, pad, style]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, pad, style]}>{children}</View>
        )}
        {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 18, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border }}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
