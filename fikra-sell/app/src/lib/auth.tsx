import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getProfile } from './api';
import { supabase } from './supabase';
import type { Profile } from './types';

type AuthCtx = {
  ready: boolean;
  session: Session | null;
  userId: string | null;
  email: string | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signUp: (name: string, email: string, password: string, locale: 'ar' | 'en') => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  setNewPassword: (password: string) => Promise<void>;
  /** Seconds the user must wait before another sign-in attempt (client-side back-off). */
  lockedFor: () => Promise<number>;
};

const Ctx = createContext<AuthCtx | null>(null);
const FAIL_KEY = 'fikra.auth.failures';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const passwordOk = (p: string) => p.length >= 8 && /[A-Za-z؀-ۿ]/.test(p) && /\d/.test(p);

async function failures(): Promise<number[]> {
  try { return JSON.parse((await AsyncStorage.getItem(FAIL_KEY)) ?? '[]'); } catch { return []; }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (uid: string | undefined) => {
    if (!uid) { setProfile(null); return; }
    try { setProfile(await getProfile(uid)); } catch { /* keep previous */ }
  }, []);

  useEffect(() => {
    // Restore the saved session, but never block the UI on it: guests can
    // browse immediately and a slow keychain read must not leave a blank screen.
    let settled = false;
    const done = () => { if (!settled) { settled = true; setReady(true); } };
    const failsafe = setTimeout(done, 3000);
    supabase.auth.getSession()
      .then(async ({ data }) => {
        setSession(data.session);
        if (data.session) loadProfile(data.session.user.id);
      })
      .catch(() => { /* corrupted storage → continue as guest */ })
      .finally(() => { clearTimeout(failsafe); done(); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'SIGNED_OUT') {
        loadProfile(s?.user.id);
        qc.invalidateQueries();
      }
      if (event === 'PASSWORD_RECOVERY') router.push('/auth/reset-password');
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile, qc]);

  const lockedFor = useCallback(async () => {
    const now = Date.now();
    const recent = (await failures()).filter((t) => now - t < 15 * 60_000);
    if (recent.length < 5) return 0;
    const wait = Math.min(15 * 60, 30 * 2 ** (recent.length - 5)); // 30s, 60s, 120s … max 15 min
    return Math.max(0, Math.ceil((recent[recent.length - 1] + wait * 1000 - now) / 1000));
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    ready,
    session,
    userId: session?.user.id ?? null,
    email: session?.user.email ?? null,
    profile,
    refreshProfile: () => loadProfile(session?.user.id),
    async signUp(name, email, password, locale) {
      // Instant sign-up: the "signup" Edge Function creates the account already
      // confirmed (no confirmation e-mail, no OTP); we then sign in right away.
      const addr = email.trim().toLowerCase();
      const { error } = await supabase.functions.invoke('signup', { body: { name: name.trim(), email: addr, password, locale } });
      if (error) {
        let code = 'signup_failed';
        try { const b = await (error as { context?: Response }).context?.json(); if (b?.code) code = b.code; } catch { /* network */ }
        if (code === 'signup_failed' && /fetch|network/i.test(String(error.message))) throw error;
        throw Object.assign(new Error(code), { code, status: code === 'signup_rate_limited' ? 429 : 400 });
      }
      const r = await supabase.auth.signInWithPassword({ email: addr, password });
      if (r.error) throw r.error;
    },
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) {
        if (error.code === 'invalid_credentials' || /invalid login/i.test(error.message)) {
          const list = [...(await failures()), Date.now()].slice(-20);
          await AsyncStorage.setItem(FAIL_KEY, JSON.stringify(list));
        }
        throw error;
      }
      await AsyncStorage.removeItem(FAIL_KEY);
    },
    async signOut() {
      await supabase.auth.signOut();
      qc.clear();
    },
    async sendReset(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: Linking.createURL('/auth/reset-password'),
      });
      if (error) throw error;
    },
    async setNewPassword(password) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    lockedFor,
  }), [ready, session, profile, loadProfile, lockedFor, qc]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}

export type GuardReason = 'post' | 'chat' | 'favorite' | 'report' | 'default';

/** Runs `fn` when signed in; otherwise opens sign-in / instant sign-up explaining why. */
export function useRequireAuth() {
  const { userId } = useAuth();
  return useCallback(
    (reason: GuardReason, fn: () => void) => {
      if (userId) fn();
      else router.push({ pathname: '/auth/sign-up', params: { reason } });
    },
    [userId],
  );
}
