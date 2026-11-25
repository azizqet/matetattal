import type { ReactNode } from "react";
import { Pressable, View, type ViewStyle } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

export function Card({ children, style, onPress, flat, testID }: { children: ReactNode; style?: ViewStyle | ViewStyle[]; onPress?: () => void; flat?: boolean; testID?: string }) {
  const { colors, radius, dark } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 10,
    borderWidth: dark || flat ? 1 : 0, borderColor: colors.border,
    shadowColor: colors.shadow, shadowOpacity: flat || dark ? 0 : 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
    elevation: flat || dark ? 0 : 3,
  };
  if (onPress) {
    return (
      <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style as ViewStyle]}>
        {children}
      </Pressable>
    );
  }
  return <View testID={testID} style={[base, style as ViewStyle]}>{children}</View>;
}
