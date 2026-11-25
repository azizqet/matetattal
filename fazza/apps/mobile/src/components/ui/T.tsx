import { Text, type TextProps, type TextStyle } from "react-native";
import { fonts } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

type Variant = "display" | "h1" | "h2" | "h3" | "body" | "small" | "caption";
type Weight = "regular" | "medium" | "semibold" | "bold";
const sizes: Record<Variant, { fontSize: number; lineHeight: number; weight: Weight }> = {
  display: { fontSize: 32, lineHeight: 44, weight: "bold" },
  h1: { fontSize: 26, lineHeight: 36, weight: "bold" },
  h2: { fontSize: 20, lineHeight: 30, weight: "bold" },
  h3: { fontSize: 17, lineHeight: 26, weight: "semibold" },
  body: { fontSize: 15, lineHeight: 24, weight: "regular" },
  small: { fontSize: 13, lineHeight: 20, weight: "regular" },
  caption: { fontSize: 11.5, lineHeight: 17, weight: "medium" },
};

export interface TProps extends TextProps {
  v?: Variant;
  w?: Weight;
  color?: "text" | "muted" | "faint" | "primary" | "danger" | "success" | "warning" | "white" | string;
  center?: boolean;
}

export function T({ v = "body", w, color = "text", center, style, ...rest }: TProps) {
  const { colors } = useTheme();
  const s = sizes[v];
  const map: Record<string, string> = {
    text: colors.text, muted: colors.textMuted, faint: colors.textFaint, primary: colors.primary,
    danger: colors.danger, success: colors.success, warning: colors.warning, white: "#FFFFFF",
  };
  const st: TextStyle = {
    fontFamily: fonts[w ?? s.weight], fontSize: s.fontSize, lineHeight: s.lineHeight,
    color: map[color] ?? color, textAlign: center ? "center" : undefined, writingDirection: "auto",
  };
  return <Text {...rest} style={[st, style]} maxFontSizeMultiplier={1.4} />;
}
