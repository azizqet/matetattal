import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { normalizeKwPhone } from "@fazza/shared";
import { FzError, callFunction, rpc } from "@/lib/api";
import { flushOutbox } from "@/lib/outbox";
import { registerForPush, unregisterPush } from "@/lib/push";
import { channelName, supabase } from "@/lib/supabase";
import type { Driver, Profile } from "@/lib/types";
import { queryClient } from "./QueryProvider";

interface AuthCtx {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  driver: Driver | null;
  signIn: (phone: string, password: string) => Promise<void>;
  signUp: (fullName: string, phone: string, password: string, locale: "ar" | "en") => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  setMode: (mode: "customer" | "driver") => Promise<void>;
}

const Ctx = createContext<AuthCtx | null>(null);
interface SessionResp { session: { access_token: string; refresh_token: string } | null }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) { setProfile(null); setDriver(null); return; }
    const [p, d] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("drivers").select("*").eq("user_id", uid).maybeSingle(),
    ]);
    if (p.data) setProfile(p.data as Profile);
    setDriver((d.data as Driver) ?? null);
    if (p.data && (p.data as Profile).status !== "active") {
      await supabase.auth.signOut();
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      try { await loadProfile(data.session?.user.id); } catch { /* offline: keep cached session */ }
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (!s) { setProfile(null); setDriver(null); queryClient.clear(); }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  // Realtime: profile / driver status changes (approval, suspension, balance)
  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) return;
    const ch = supabase.channel(channelName(`me-${uid}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers", filter: `user_id=eq.${uid}` }, (p) => {
        if (p.eventType === "DELETE") setDriver(null); else setDriver(p.new as Driver);
        queryClient.invalidateQueries({ queryKey: ["driver-dashboard"] });
      })
      .subscribe();
    registerForPush().catch(() => undefined);
    flushOutbox(uid).catch(() => undefined);
    return () => { supabase.removeChannel(ch); };
  }, [uid]);

  const applySession = useCallback(async (resp: SessionResp) => {
    if (!resp.session) throw new FzError("FZ_SERVER_ERROR");
    const { data, error } = await supabase.auth.setSession({ access_token: resp.session.access_token, refresh_token: resp.session.refresh_token });
    if (error || !data.session) throw new FzError("FZ_SERVER_ERROR");
    setSession(data.session);
    await loadProfile(data.session.user.id);
  }, [loadProfile]);

  const signIn = useCallback(async (phone: string, password: string) => {
    const p = normalizeKwPhone(phone);
    if (!p) throw new FzError("FZ_INVALID_PHONE");
    await applySession(await callFunction<SessionResp>("auth-login", { phone: p, password }));
  }, [applySession]);

  const signUp = useCallback(async (fullName: string, phone: string, password: string, locale: "ar" | "en") => {
    const p = normalizeKwPhone(phone);
    if (!p) throw new FzError("FZ_INVALID_PHONE");
    await applySession(await callFunction<SessionResp>("auth-signup", { full_name: fullName, phone: p, password, locale, accept_terms: true }));
  }, [applySession]);

  const signOut = useCallback(async () => {
    await unregisterPush();
    await supabase.auth.signOut();
    queryClient.clear();
  }, []);

  const refresh = useCallback(async () => { await loadProfile(session?.user.id); }, [loadProfile, session?.user.id]);

  const setMode = useCallback(async (mode: "customer" | "driver") => {
    await rpc("set_active_mode", { p_mode: mode });
    setProfile((p) => (p ? { ...p, active_mode: mode } : p));
  }, []);

  const value = useMemo(() => ({ ready, session, profile, driver, signIn, signUp, signOut, refresh, setMode }),
    [ready, session, profile, driver, signIn, signUp, signOut, refresh, setMode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
