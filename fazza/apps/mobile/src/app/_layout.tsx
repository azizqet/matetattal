import {
  IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold, useFonts,
} from "@expo-google-fonts/ibm-plex-sans-arabic";
import * as Notifications from "expo-notifications";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { loadLanguage } from "@/lib/i18n";
import { useOutboxSync } from "@/lib/hooks";
import { AuthProvider } from "@/providers/AuthProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function NotificationRouter() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data as { order_id?: string; chat?: boolean; ticket_id?: string; type?: string };
      if (data.chat && data.order_id) router.push({ pathname: "/chat/[id]", params: { id: data.order_id } });
      else if (data.type === "new_order" && data.order_id) router.push({ pathname: "/driver/order/[id]", params: { id: data.order_id } });
      else if (data.order_id) router.push({ pathname: "/order/[id]", params: { id: data.order_id } });
      else if (data.ticket_id) router.push({ pathname: "/support/[id]", params: { id: data.ticket_id } });
      else router.push("/notifications");
    });
    return () => sub.remove();
  }, []);
  return null;
}

function Sync() {
  useOutboxSync();
  return null;
}

function RootStack() {
  const { colors } = useTheme();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: "slide_from_right" }}>
      <Stack.Screen name="index" options={{ animation: "fade" }} />
      <Stack.Screen name="(auth)" options={{ animation: "fade" }} />
      <Stack.Screen name="(customer)" options={{ animation: "fade" }} />
      <Stack.Screen name="(driver)" options={{ animation: "fade" }} />
      <Stack.Screen name="pick-location" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ IBMPlexSansArabic_400Regular, IBMPlexSansArabic_500Medium, IBMPlexSansArabic_600SemiBold, IBMPlexSansArabic_700Bold });
  const [langReady, setLangReady] = useState(false);
  useEffect(() => { loadLanguage().finally(() => setLangReady(true)); }, []);
  const ready = fontsLoaded && langReady;
  useEffect(() => { if (ready) SplashScreen.hideAsync().catch(() => undefined); }, [ready]);
  if (!ready) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <QueryProvider>
            <AuthProvider>
              <NotificationRouter />
              <Sync />
              <RootStack />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
