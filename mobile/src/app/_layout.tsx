import { Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold, Tajawal_800ExtraBold, useFonts } from '@expo-google-fonts/tajawal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { I18nManager, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ConsentGate } from '@/components/Consent';
import { ToastProvider } from '@/components/ui';
import { SessionProvider } from '@/lib/session';
import { colors, fonts, isDark } from '@/lib/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

// التطبيق عربي بالكامل. في النسخة المبنية يفرض app.json (forcesRTL) الاتجاه،
// لكن Expo Go يتجاهل ذلك ويتبع لغة الجهاز، لذلك نضبط direction: 'rtl' على الجذر أيضاً
// فيظهر التطبيق صحيحاً حتى لو كانت لغة الآيفون إنجليزية.
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
            <View style={{ flex: 1, direction: 'rtl' }}>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: isDark ? colors.card : colors.primary },
                headerShadowVisible: false,
                headerTintColor: colors.white,
                headerTitleStyle: { fontFamily: fonts.bold },
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'ماتعطل' }} />
              <Stack.Screen name="company/[id]" options={{ title: 'تفاصيل الشركة' }} />
              <Stack.Screen name="service/[id]" options={{ title: 'الخدمة' }} />
              <Stack.Screen name="auth" options={{ title: '', headerTransparent: true, headerStyle: { backgroundColor: 'transparent' } }} />
              <Stack.Screen name="auth-callback" options={{ title: 'ماتعطل' }} />
              <Stack.Screen name="admin" options={{ title: 'لوحة الإدارة' }} />
              <Stack.Screen name="notifications" options={{ title: 'الإشعارات' }} />
              <Stack.Screen name="favorites" options={{ title: 'المفضلة' }} />
              <Stack.Screen name="profile" options={{ title: 'بياناتي' }} />
              <Stack.Screen name="my-ads" options={{ title: 'إعلاناتي' }} />
              <Stack.Screen name="ad/[id]" options={{ title: 'الإعلان' }} />
              <Stack.Screen name="support/index" options={{ title: 'الدعم الفني' }} />
              <Stack.Screen name="support/new" options={{ title: 'طلب دعم جديد' }} />
              <Stack.Screen name="support/[id]" options={{ title: 'طلب دعم' }} />
              <Stack.Screen name="contact" options={{ title: 'تواصل معنا' }} />
              <Stack.Screen name="legal/index" options={{ title: 'الشروط والسياسات' }} />
              <Stack.Screen name="legal/[id]" options={{ title: 'الشروط والسياسات' }} />
            </Stack>
            <ConsentGate />
            </View>
          </ToastProvider>
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
