import {
  ReadexPro_300Light, ReadexPro_400Regular, ReadexPro_500Medium, ReadexPro_600SemiBold, ReadexPro_700Bold, useFonts,
} from '@expo-google-fonts/readex-pro';
import { focusManager, QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import * as SplashScreen from 'expo-splash-screen';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, Pressable, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AnimatedSplash } from '../components/AnimatedSplash';
import { OfflineBanner, ToastProvider } from '../components/feedback';
import { I18nProvider } from '../i18n';
import { trackAppOpen } from '../lib/api';
import { AuthProvider, useAuth } from '../lib/auth';
import { listenForNotificationTaps, registerForPush } from '../lib/push';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';

SplashScreen.preventAutoHideAsync().catch(() => {});
// Failsafe: the native splash can never stay up longer than this.
setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); }, 6000);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 30 * 60_000, retry: 2, retryDelay: (n) => Math.min(1000 * 2 ** n, 8000), refetchOnWindowFocus: true },
    mutations: { retry: 0 },
  },
});

onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)));
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) => focusManager.setFocused(s === 'active'));
}

/** Shown instead of a blank screen if anything throws while rendering. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#FFFFFF', gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#111111', textAlign: 'center' }}>حدث خطأ غير متوقع</Text>
      <Text style={{ fontSize: 14, color: '#808080', textAlign: 'center' }}>Something went wrong. {error?.message}</Text>
      <Pressable onPress={retry} accessibilityRole="button" style={{ marginTop: 8, backgroundColor: '#1E305C', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>إعادة المحاولة · Try again</Text>
      </Pressable>
    </View>
  );
}

function Effects() {
  const { userId, ready } = useAuth();
  useEffect(() => { if (ready) trackAppOpen(); }, [ready, userId]);
  useEffect(() => { if (userId) registerForPush().catch(() => {}); }, [userId]);
  useEffect(() => listenForNotificationTaps(), []);
  return null;
}

function Shell() {
  const { c, isDark } = useTheme();
  const { ready } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const onDone = useCallback(() => setSplashDone(true), []);

  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => {}); }, [ready]);
  // The animated splash removes itself when its animation ends; this timer
  // guarantees it also disappears if an animation callback never fires.
  useEffect(() => { if (!ready) return; const id = setTimeout(onDone, 2200); return () => clearTimeout(id); }, [ready, onDone]);
  if (!ready) return null;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Effects />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg }, animation: 'slide_from_right' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="post/new" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="post/[id]" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="auth/sign-in" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="auth/sign-up" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="search" options={{ animation: 'fade' }} />
      </Stack>
      <OfflineBanner />
      {!splashDone && <AnimatedSplash onDone={onDone} />}
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ ReadexPro_300Light, ReadexPro_400Regular, ReadexPro_500Medium, ReadexPro_600SemiBold, ReadexPro_700Bold });
  // Never block on fonts: if they fail to load, render with the system font.
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => { const id = setTimeout(() => setFontTimeout(true), 4000); return () => clearTimeout(id); }, []);
  if (!fontsLoaded && !fontError && !fontTimeout) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <I18nProvider>
              <ToastProvider>
                <AuthProvider>
                  <Shell />
                </AuthProvider>
              </ToastProvider>
            </I18nProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
