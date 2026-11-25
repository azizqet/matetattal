import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { dark, light, type Palette } from './tokens';

export type ThemeMode = 'system' | 'light' | 'dark';
const KEY = 'fikra.theme';

type Ctx = { c: Palette; mode: ThemeMode; setMode: (m: ThemeMode) => void; isDark: boolean };
const ThemeContext = createContext<Ctx>({ c: light, mode: 'system', setMode: () => {}, isDark: false });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v === 'light' || v === 'dark' || v === 'system') setModeState(v); }).catch(() => {});
  }, []);

  // Clean white design (the logo is drawn on white): dark mode is disabled.
  void system;
  const isDark = false;
  const c = isDark ? dark : light;

  useEffect(() => { SystemUI.setBackgroundColorAsync(c.bg).catch(() => {}); }, [c.bg]);

  const value = useMemo<Ctx>(() => ({
    c, mode, isDark,
    setMode: (m) => { setModeState(m); AsyncStorage.setItem(KEY, m).catch(() => {}); },
  }), [c, mode, isDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
