import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { darkTheme, lightTheme, type Theme } from "./colors";

export type ThemePref = "system" | "light" | "dark";
const KEY = "fazza.theme";

const Ctx = createContext<{ theme: Theme; pref: ThemePref; setPref: (p: ThemePref) => void }>({
  theme: lightTheme, pref: "system", setPref: () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>("system");
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v === "light" || v === "dark" || v === "system") setPrefState(v); }).catch(() => undefined);
  }, []);
  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(KEY, p).catch(() => undefined);
  }, []);
  const theme = useMemo(() => {
    const dark = pref === "dark" || (pref === "system" && system === "dark");
    return dark ? darkTheme : lightTheme;
  }, [pref, system]);
  const value = useMemo(() => ({ theme, pref, setPref }), [theme, pref, setPref]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx).theme;
}
export function useThemePref() {
  const { pref, setPref } = useContext(Ctx);
  return { pref, setPref };
}
