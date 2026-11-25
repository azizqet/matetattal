import { useSyncExternalStore } from "react";

type Lang = "ar" | "en";
let current: Lang = (localStorage.getItem("fazza.admin.lang") as Lang) || "ar";
const listeners = new Set<() => void>();

function apply() {
  document.documentElement.lang = current;
  document.documentElement.dir = current === "ar" ? "rtl" : "ltr";
}
apply();

export const lang = () => current;
export function setLang(l: Lang) {
  current = l;
  localStorage.setItem("fazza.admin.lang", l);
  apply();
  listeners.forEach((f) => f());
}
export function useLang(): Lang {
  return useSyncExternalStore((f) => { listeners.add(f); return () => listeners.delete(f); }, () => current);
}
/** Inline bilingual text: tr("عربي", "English") */
export const tr = (ar: string, en: string) => (current === "ar" ? ar : en);

export function fmtDate(s: string | null | undefined, withTime = true) {
  if (!s) return "—";
  return new Date(s).toLocaleString(current === "ar" ? "ar-KW" : "en-GB", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}
