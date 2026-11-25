import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DevSettings, I18nManager, Platform } from 'react-native';
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

async function reload() {
  if (Platform.OS === 'web') { window.location.reload(); return; }
  try { await Updates.reloadAsync(); } catch { DevSettings.reload(); }
}

/** Ensures native layout direction matches the language (one reload if not). */
async function applyDirection(lang: Lang): Promise<boolean> {
  const rtl = lang === 'ar';
  if (Platform.OS === 'web') {
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    return false;
  }
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== rtl) {
    I18nManager.forceRTL(rtl);
    I18nManager.swapLeftAndRightInRTL(true);
    return true;
  }
  return false;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang | null>(null);

  useEffect(() => {
    (async () => {
      const saved = ((await AsyncStorage.getItem(KEY).catch(() => null)) as Lang | null) ?? 'ar';
      const needsReload = await applyDirection(saved);
      if (needsReload) { await reload(); return; }
      setLangState(saved);
    })();
  }, []);

  const setLang = useCallback(async (l: Lang) => {
    await AsyncStorage.setItem(KEY, l);
    const needsReload = await applyDirection(l);
    if (needsReload) await reload();
    else setLangState(l);
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

  if (!value) return null; // splash screen stays visible until the language is resolved
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const c = useContext(I18nContext);
  if (!c) throw new Error('useI18n outside I18nProvider');
  return c;
}
