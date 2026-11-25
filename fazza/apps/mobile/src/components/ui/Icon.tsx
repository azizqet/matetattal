import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/theme/ThemeProvider";

export type IconName = ComponentProps<typeof Ionicons>["name"];
const DIRECTIONAL = new Set<string>(["chevron-forward", "chevron-back", "arrow-forward", "arrow-back", "send", "exit-outline", "log-out-outline"]);

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useTheme();
  const { i18n } = useTranslation();
  const flip = i18n.language === "ar" && DIRECTIONAL.has(name as string);
  return <Ionicons name={name} size={size} color={color ?? colors.text} style={flip ? { transform: [{ scaleX: -1 }] } : undefined} />;
}
