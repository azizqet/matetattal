import { LinearGradient } from 'expo-linear-gradient';
import { Tabs } from 'expo-router';
import { Platform, View } from 'react-native';
import { Icon } from '@/components/ui';
import { colors, fonts, gradients, isDark } from '@/lib/theme';

// شريط تنقل سفلي عصري: أيقونة ممتلئة للتبويب النشط، وزر «أضف إعلان» بارز بتدرّج الهوية
function TabIcon({ on, off, color, focused }: { on: string; off: string; color: unknown; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Icon name={focused ? on : off} color={String(color)} size={24} />
      <View style={{ width: 5, height: 5, borderRadius: 3, marginTop: 3, backgroundColor: focused ? colors.accent : 'transparent' }} />
    </View>
  );
}
const tabIcon = (on: string, off: string) => {
  const Comp = ({ color, focused }: { color: unknown; focused: boolean }) => <TabIcon on={on} off={off} color={color} focused={focused} />;
  Comp.displayName = `TabIcon(${on})`;
  return Comp;
};

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.tabBar, borderTopColor: colors.line, borderTopWidth: isDark ? 1 : 0,
          shadowColor: colors.shadow, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 12,
          height: Platform.OS === 'ios' ? 88 : 68, paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'الرئيسية', tabBarIcon: tabIcon('home-variant', 'home-variant-outline') }} />
      <Tabs.Screen name="search" options={{ title: 'البحث', tabBarIcon: tabIcon('text-box-search', 'text-box-search-outline') }} />
      <Tabs.Screen name="add" options={{
        title: 'أضف إعلان',
        tabBarIcon: () => (
          <LinearGradient colors={gradients.brand} start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
            style={{ width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: -22,
              borderWidth: 4, borderColor: colors.tabBar, shadowColor: colors.primary, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}>
            <Icon name="plus" color={colors.white} size={26} />
          </LinearGradient>
        ),
      }} />
      <Tabs.Screen name="requests" options={{ title: 'طلباتي', tabBarIcon: tabIcon('clipboard-text', 'clipboard-text-outline') }} />
      <Tabs.Screen name="account" options={{ title: 'حسابي', tabBarIcon: tabIcon('account-circle', 'account-circle-outline') }} />
    </Tabs>
  );
}
