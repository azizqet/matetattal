import NetInfo from "@react-native-community/netinfo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "react-native";
import { errorMessage } from "@fazza/shared";
import { useAuth } from "@/providers/AuthProvider";
import { rpc, toFzError } from "./api";
import { flushOutbox } from "./outbox";
import { supabase } from "./supabase";
import type { AppSettings, Area, DriverDashboard, Governorate } from "./types";
import { signedUrl } from "./upload";

export function useLang(): "ar" | "en" {
  const { i18n } = useTranslation();
  return i18n.language === "en" ? "en" : "ar";
}

/** Shows a localized error alert for any thrown error. */
export function useErrorAlert() {
  const { t } = useTranslation();
  const lang = useLang();
  return (e: unknown) => {
    const err = toFzError(e);
    Alert.alert(t("common.error"), errorMessage(err.code, lang));
  };
}

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*").single();
      if (error) throw error;
      return data as AppSettings;
    },
    staleTime: 5 * 60_000,
  });
}

export function useAreas() {
  return useQuery({
    queryKey: ["areas"],
    queryFn: async () => {
      const [a, g] = await Promise.all([
        supabase.from("areas").select("id,governorate_id,name_ar,name_en,lat,lng").order("name_ar"),
        supabase.from("governorates").select("*").order("sort"),
      ]);
      if (a.error) throw a.error;
      return { areas: (a.data ?? []) as Area[], governorates: (g.data ?? []) as Governorate[] };
    },
    staleTime: 60 * 60_000,
  });
}

export function useDriverDashboard(enabled = true) {
  return useQuery({ queryKey: ["driver-dashboard"], queryFn: () => rpc<DriverDashboard>("driver_dashboard"), enabled, refetchInterval: 60_000 });
}

export function useSignedUrl(bucket: string, path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed", bucket, path],
    queryFn: () => signedUrl(bucket, path!),
    enabled: !!path,
    staleTime: 50 * 60_000,
  });
}

/** Re-sends queued offline orders whenever connectivity returns. */
export function useOutboxSync() {
  const { session } = useAuth();
  const qc = useQueryClient();
  useEffect(() => {
    const uid = session?.user.id;
    if (!uid) return;
    return NetInfo.addEventListener((s) => {
      if (s.isConnected) flushOutbox(uid).then(() => qc.invalidateQueries({ queryKey: ["my-orders"] })).catch(() => undefined);
    });
  }, [session?.user.id, qc]);
}

/** Subscribes to realtime changes and invalidates the given query keys. */
export function useRealtimeInvalidate(channel: string, table: string, filter: string | undefined, keys: unknown[][], enabled = true) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled) return;
    const ch = supabase.channel(channel)
      .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, () => {
        keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, table, filter, enabled]);
}
