import AsyncStorage from "@react-native-async-storage/async-storage";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next";
import { DevSettings, I18nManager, Platform } from "react-native";
import * as Updates from "expo-updates";
import ar from "../i18n/ar";
import en from "../i18n/en";

export type Lang = "ar" | "en";
const KEY = "fazza.lang";

const i18next = createInstance();
i18next.use(initReactI18next).init({
  resources: { ar: { translation: ar }, en: { translation: en } },
  lng: "ar", // Arabic is the default language
  fallbackLng: "ar",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export async function loadLanguage(): Promise<Lang> {
  let lang: Lang = "ar";
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v === "en" || v === "ar") lang = v;
  } catch { /* default */ }
  await i18next.changeLanguage(lang);
  await applyDirection(lang, false);
  return lang;
}

async function applyDirection(lang: Lang, reload: boolean) {
  const rtl = lang === "ar";
  if (Platform.OS === "web") {
    if (typeof document !== "undefined") {
      document.documentElement.dir = rtl ? "rtl" : "ltr";
      document.documentElement.lang = lang;
    }
    return;
  }
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
    I18nManager.swapLeftAndRightInRTL(true);
    // Layout direction changes require a reload of the JS bundle.
    try { await Updates.reloadAsync(); } catch { if (__DEV__) DevSettings.reload(); }
  } else if (reload) {
    // nothing to do
  }
}

export async function setLanguage(lang: Lang) {
  await AsyncStorage.setItem(KEY, lang);
  await i18next.changeLanguage(lang);
  await applyDirection(lang, true);
}

export function currentLang(): Lang {
  return i18next.language === "en" ? "en" : "ar";
}

export const isRTL = () => currentLang() === "ar";

export default i18next;
