import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Icon } from '@/components/ui';
import { colors, fonts } from '@/lib/theme';

// شريط تنقل سفلي بسيط: الرئيسية، البحث، أضف إعلان، طلباتي، حسابي
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#7A879C',
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11.5 },
        tabBarStyle: { borderTopColor: colors.line, backgroundColor: '#fff' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'الرئيسية', tabBarIcon: ({ color }) => <Icon name="home-variant-outline" color={String(color)} /> }} />
      <Tabs.Screen name="search" options={{ title: 'البحث', tabBarIcon: ({ color }) => <Icon name="magnify" color={String(color)} /> }} />
      <Tabs.Screen name="add" options={{
        title: 'أضف إعلان',
        tabBarIcon: () => (
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="plus" color="#fff" size={22} />
          </View>
        ),
      }} />
      <Tabs.Screen name="requests" options={{ title: 'طلباتي', tabBarIcon: ({ color }) => <Icon name="clipboard-text-outline" color={String(color)} /> }} />
      <Tabs.Screen name="account" options={{ title: 'حسابي', tabBarIcon: ({ color }) => <Icon name="account-circle-outline" color={String(color)} /> }} />
    </Tabs>
  );
}
