import * as Haptics from "expo-haptics";
import { useState } from "react";
import { ActivityIndicator, Animated, Platform, Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme/ThemeProvider";
import { Icon, type IconName } from "./Icon";
import { T } from "./T";

type Kind = "primary" | "secondary" | "ghost" | "danger" | "success";

export interface ButtonProps {
  title: string;
  onPress?: () => void | Promise<void>;
  kind?: Kind;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  small?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Button({ title, onPress, kind = "primary", icon, loading, disabled, small, style, testID }: ButtonProps) {
  const { colors, radius } = useTheme();
  const scale = useState(() => new Animated.Value(1))[0];
  const isDisabled = disabled || loading;
  const fg = kind === "primary" || kind === "danger" || kind === "success" ? "#FFFFFF" : kind === "secondary" ? colors.primary : colors.text;
  const bg = kind === "danger" ? colors.danger : kind === "success" ? colors.success : kind === "secondary" ? colors.primarySoft : "transparent";
  const h = small ? 42 : 54;

  const content = (
    <View style={[styles.row, { height: h, paddingHorizontal: small ? 14 : 20 }]}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon ? <Icon name={icon} size={small ? 18 : 20} color={fg} /> : null}
          <T v={small ? "small" : "body"} w="bold" color={fg}>{title}</T>
        </>
      )}
    </View>
  );

  return (
    <Animated.View style={[{ transform: [{ scale }], opacity: isDisabled ? 0.55 : 1 }, style]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
        disabled={isDisabled}
        onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: Platform.OS !== "web", speed: 40 }).start()}
        onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: Platform.OS !== "web", speed: 40 }).start()}
        onPress={() => {
          if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
          onPress?.();
        }}
        style={{ borderRadius: radius.md, overflow: "hidden", backgroundColor: kind === "primary" ? undefined : bg,
          borderWidth: kind === "ghost" ? 1 : 0, borderColor: colors.border }}
      >
        {kind === "primary" ? (
          <LinearGradient colors={["#3466FF", "#1E46D8", "#1636B3"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>{content}</LinearGradient>
        ) : content}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
});
