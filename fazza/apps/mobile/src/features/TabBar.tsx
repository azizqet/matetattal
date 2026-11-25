import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";
import { Icon, type IconName } from "@/components/ui";
import { fonts } from "@/theme/colors";
import { useTheme } from "@/theme/ThemeProvider";

export function AppTabs({ tabs }: { tabs: { name: string; label: string; icon: IconName; iconActive: IconName; badge?: number }[] }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textFaint,
      tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border, height: Platform.OS === "ios" ? 88 : 66, paddingTop: 6 },
      tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11.5 },
    }}>
      {tabs.map((tb) => (
        <Tabs.Screen key={tb.name} name={tb.name} options={{
          title: t(tb.label),
          tabBarBadge: tb.badge ? tb.badge : undefined,
          tabBarIcon: ({ focused, color }) => <Icon name={focused ? tb.iconActive : tb.icon} size={24} color={color as string} />,
        }} />
      ))}
    </Tabs>
  );
}
