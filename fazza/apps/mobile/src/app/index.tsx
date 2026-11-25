// Animated splash + routing decision.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Animated, Easing, Platform, View } from "react-native";
import { useTranslation } from "react-i18next";
import { LogoMark } from "@/components/illustrations/Logo";
import { T } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";

export const ONBOARDED_KEY = "fazza.onboarded";

export default function Splash() {
  const { ready, session, profile } = useAuth();
  const { t } = useTranslation();
  const scale = useState(() => new Animated.Value(0.6))[0];
  const fade = useState(() => new Animated.Value(0))[0];
  const lift = useState(() => new Animated.Value(16))[0];
  const [animDone, setAnimDone] = useState(false);
  const native = Platform.OS !== "web";

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: native }),
        Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: native }),
      ]),
      Animated.timing(lift, { toValue: 0, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
    ]).start(() => setTimeout(() => setAnimDone(true), 350));
  }, [scale, fade, lift, native]);

  useEffect(() => {
    if (!ready || !animDone) return;
    (async () => {
      const onboarded = await AsyncStorage.getItem(ONBOARDED_KEY).catch(() => null);
      if (!session) return router.replace(onboarded ? "/welcome" : "/onboarding");
      if (profile?.must_change_password) return router.replace("/change-password");
      if (profile?.active_mode === "driver") return router.replace("/dashboard");
      router.replace("/home");
    })();
  }, [ready, animDone, session, profile]);

  return (
    <LinearGradient colors={["#3466FF", "#1E46D8", "#0F2A99"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ transform: [{ scale }], opacity: fade }}>
        <View style={{ shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: 16 } }}>
          <LogoMark size={132} />
        </View>
      </Animated.View>
      <Animated.View style={{ opacity: fade, transform: [{ translateY: lift }], alignItems: "center", marginTop: 22 }}>
        <T v="display" color="white">فزّاع</T>
        <T w="bold" color="#DCE5FF" style={{ letterSpacing: 6 }}>FAZZA</T>
        <T v="small" color="#C7D4FF" style={{ marginTop: 8 }}>{t("app.tagline")}</T>
      </Animated.View>
    </LinearGradient>
  );
}
