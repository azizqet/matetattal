export const palette = {
  royal950: "#060F3D",
  royal900: "#0B1E6B",
  royal800: "#102A8C",
  royal700: "#1636B3",
  royal600: "#1E46D8",
  royal500: "#3466FF",
  royal400: "#6C8CF7",
  royal200: "#C7D4FF",
  royal100: "#E7EDFF",
  royal50: "#F3F6FF",
  white: "#FFFFFF",
  success: "#12B76A",
  warning: "#F79009",
  danger: "#F04438",
};

export interface Theme {
  dark: boolean;
  colors: {
    bg: string; surface: string; card: string; elevated: string; border: string;
    text: string; textMuted: string; textFaint: string; primary: string; primaryText: string;
    primarySoft: string; success: string; successSoft: string; warning: string; warningSoft: string;
    danger: string; dangerSoft: string; overlay: string; shadow: string; tabBar: string;
  };
  radius: { sm: number; md: number; lg: number; xl: number; pill: number };
  space: (n: number) => number;
}

const base = { radius: { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 }, space: (n: number) => n * 4 };

export const lightTheme: Theme = {
  ...base,
  dark: false,
  colors: {
    bg: "#F5F7FF", surface: "#FFFFFF", card: "#FFFFFF", elevated: "#FFFFFF", border: "#E3E8F7",
    text: "#0B1640", textMuted: "#4D5A85", textFaint: "#8E98B8", primary: palette.royal600, primaryText: "#FFFFFF",
    primarySoft: palette.royal100, success: palette.success, successSoft: "#E3F8EE", warning: palette.warning,
    warningSoft: "#FFF4E5", danger: palette.danger, dangerSoft: "#FFECEB", overlay: "rgba(6,15,61,0.45)",
    shadow: "#0B1E6B", tabBar: "#FFFFFF",
  },
};

export const darkTheme: Theme = {
  ...base,
  dark: true,
  colors: {
    bg: "#070D24", surface: "#0E1633", card: "#121D42", elevated: "#18255290", border: "#22305E",
    text: "#EEF2FF", textMuted: "#AEB8DA", textFaint: "#6F7BA6", primary: palette.royal500, primaryText: "#FFFFFF",
    primarySoft: "#1A2A66", success: "#32D583", successSoft: "#0F2E22", warning: "#FDB022", warningSoft: "#33240C",
    danger: "#F97066", dangerSoft: "#3A1614", overlay: "rgba(0,0,0,0.6)", shadow: "#000000", tabBar: "#0E1633",
  },
};

export const fonts = {
  regular: "IBMPlexSansArabic_400Regular",
  medium: "IBMPlexSansArabic_500Medium",
  semibold: "IBMPlexSansArabic_600SemiBold",
  bold: "IBMPlexSansArabic_700Bold",
};
