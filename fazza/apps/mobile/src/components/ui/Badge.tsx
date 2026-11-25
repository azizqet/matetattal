import { View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { T } from "./T";

export type Tone = "primary" | "success" | "warning" | "danger" | "neutral";

export function Badge({ label, tone = "primary" }: { label: string; tone?: Tone }) {
  const { colors } = useTheme();
  const map = {
    primary: [colors.primarySoft, colors.primary], success: [colors.successSoft, colors.success],
    warning: [colors.warningSoft, colors.warning], danger: [colors.dangerSoft, colors.danger], neutral: [colors.border, colors.textMuted],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" }}>
      <T v="caption" w="bold" color={fg}>{label}</T>
    </View>
  );
}

export function statusTone(s: string): Tone {
  if (s === "completed" || s === "approved") return "success";
  if (s === "cancelled" || s === "expired" || s === "rejected") return "danger";
  if (s === "open" || s === "pending" || s === "delivered") return "warning";
  return "primary";
}
