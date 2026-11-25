import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { FlatList, Pressable, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { OffersScene, ParcelScene, TrackingScene } from "@/components/illustrations/Illustrations";
import { Button, Screen, T } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { ONBOARDED_KEY } from "../index";

const slides = [
  { key: "s1", Art: ParcelScene },
  { key: "s2", Art: OffersScene },
  { key: "s3", Art: TrackingScene },
] as const;

export default function Onboarding() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList>(null);
  const finish = async () => {
    await AsyncStorage.setItem(ONBOARDED_KEY, "1").catch(() => undefined);
    router.replace("/welcome");
  };
  const onViewable = useCallback(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }, []);
  const last = index === slides.length - 1;
  return (
    <Screen scroll={false} padded={false}>
      <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 20, paddingTop: 8 }}>
        <Pressable onPress={finish} hitSlop={10} accessibilityRole="button"><T w="semibold" color="muted">{t("common.skip")}</T></Pressable>
      </View>
      <FlatList
        ref={list}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.key}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: 28, alignItems: "center", justifyContent: "center", gap: 18 }}>
            <item.Art width={Math.min(width - 40, 340)} />
            <T v="h1" center>{t(`onboarding.${item.key}Title`)}</T>
            <T color="muted" center style={{ maxWidth: 340 }}>{t(`onboarding.${item.key}Body`)}</T>
          </View>
        )}
      />
      <View style={{ flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 18 }}>
        {slides.map((s, i) => (
          <View key={s.key} style={{ height: 8, width: i === index ? 26 : 8, borderRadius: 4, backgroundColor: i === index ? colors.primary : colors.border }} />
        ))}
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        <Button testID="onboarding-next" title={last ? t("onboarding.start") : t("common.next")} icon={last ? "rocket-outline" : undefined}
          onPress={() => (last ? finish() : list.current?.scrollToIndex({ index: index + 1 }))} />
      </View>
    </Screen>
  );
}
