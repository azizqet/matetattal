import { Tabs } from 'expo-router';
import { Icon } from '@/components/ui';
import { colors, fonts } from '@/lib/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#7A879C',
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        tabBarStyle: { borderTopColor: colors.line, backgroundColor: '#fff', height: 64, paddingTop: 6 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'الرئيسية', tabBarIcon: ({ color }) => <Icon name="home-variant" color={color} /> }} />
      <Tabs.Screen name="search" options={{ title: 'البحث', tabBarIcon: ({ color }) => <Icon name="magnify" color={color} /> }} />
      <Tabs.Screen name="requests" options={{ title: 'طلباتي', tabBarIcon: ({ color }) => <Icon name="clipboard-text-clock-outline" color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: 'حسابي', tabBarIcon: ({ color }) => <Icon name="account-circle-outline" color={color} /> }} />
    </Tabs>
  );
}
