import { Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold, useFonts } from '@expo-google-fonts/tajawal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { I18nManager, Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ToastProvider } from '@/components/ui';
import { SessionProvider } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// التطبيق عربي بالكامل: نضمن اتجاه RTL (الإعداد الأساسي في app.json عبر forcesRTL)
if (Platform.OS !== 'web' && !I18nManager.isRTL) {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
}
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.setAttribute('dir', 'rtl');
  document.documentElement.setAttribute('lang', 'ar');
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, refetchOnWindowFocus: false } },
});

export default function RootLayout() {
  const [loaded, error] = useFonts({ Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync().catch(() => {});
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ToastProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.primary },
                headerTintColor: '#fff',
                headerTitleStyle: { fontFamily: fonts.bold },
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'ماتعطل' }} />
              <Stack.Screen name="company/[id]" options={{ title: 'تفاصيل الشركة' }} />
              <Stack.Screen name="service/[id]" options={{ title: 'الخدمة' }} />
              <Stack.Screen name="auth" options={{ title: 'تسجيل الدخول', presentation: 'modal' }} />
              <Stack.Screen name="join" options={{ title: 'انضم كمقدم خدمة' }} />
              <Stack.Screen name="business" options={{ title: 'لوحة شركتي' }} />
              <Stack.Screen name="admin" options={{ title: 'لوحة الإدارة' }} />
              <Stack.Screen name="notifications" options={{ title: 'الإشعارات' }} />
              <Stack.Screen name="favorites" options={{ title: 'المفضلة' }} />
              <Stack.Screen name="profile" options={{ title: 'بياناتي' }} />
              <Stack.Screen name="complaint" options={{ title: 'شكوى أو اقتراح' }} />
            </Stack>
          </ToastProvider>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
