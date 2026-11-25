import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { I18nManager, Platform, View } from 'react-native';
import ar, { type Dict } from './ar';
import en from './en';

export type Lang = 'ar' | 'en';
const KEY = 'fikra.lang';
const dicts: Record<Lang, Dict> = { ar, en };

type Path<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Path<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Path<Dict>;

function lookup(d: Dict, key: string): string {
  return (key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], d) as string) ?? key;
}

export function format(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

type Ctx = {
  lang: Lang;
  isRTL: boolean;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  /** Picks the Arabic or English variant of a bilingual DB record. */
  pick: (ar?: string | null, en?: string | null) => string;
  setLang: (l: Lang) => Promise<void>;
};

const I18nContext = createContext<Ctx | null>(null);

/**
 * Layout direction is applied with a `direction` style on the root view, so
 * the very first render is correct everywhere (standalone builds, Expo Go and
 * web) without restarting the app. The native RTL flag is also updated so
 * system UI follows on the next cold start. The app never reloads itself.
 */
function applyNativeDirection(lang: Lang) {
  const rtl = lang === 'ar';
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
    return;
  }
  try {
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl);
  } catch {
    // Native direction is best-effort; the root `direction` style is authoritative.
  }
}

async function readSavedLang(): Promise<Lang> {
  const timeout = new Promise<null>((r) => setTimeout(() => r(null), 1500));
  const saved = await Promise.race([AsyncStorage.getItem(KEY).catch(() => null), timeout]);
  return saved === 'en' ? 'en' : 'ar';
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang | null>(null);

  useEffect(() => {
    let alive = true;
    readSavedLang().then((l) => {
      if (!alive) return;
      applyNativeDirection(l);
      setLangState(l);
    });
    return () => { alive = false; };
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    await AsyncStorage.setItem(KEY, l).catch(() => {});
    applyNativeDirection(l);
    setLangState(l);
  }, []);

  const value = useMemo<Ctx | null>(() => {
    if (!lang) return null;
    const d = dicts[lang];
    return {
      lang,
      isRTL: lang === 'ar',
      t: (key, vars) => format(lookup(d, key), vars),
      pick: (a, e) => (lang === 'ar' ? a || e || '' : e || a || ''),
      setLang,
    };
  }, [lang, setLang]);

  if (!value) return null; // resolved within 1.5 s at most; the native splash covers this
  return (
    <I18nContext.Provider value={value}>
      <View style={{ flex: 1, direction: value.isRTL ? 'rtl' : 'ltr' }}>{children}</View>
    </I18nContext.Provider>
  );
}

export function useI18n(): Ctx {
  const c = useContext(I18nContext);
  if (!c) throw new Error('useI18n outside I18nProvider');
  return c;
}
