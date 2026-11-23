import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getMyProfile } from './api';
import { supabase } from './supabase';
import type { Profile } from './types';
import { nearestArea } from './utils';

interface SessionState {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  // الموقع والمنطقة
  area: string | null;
  setArea: (a: string | null) => void;
  coords: { lat: number; lng: number } | null;
  locating: boolean;
  locate: () => Promise<{ ok: boolean; message?: string }>;
}

const Ctx = createContext<SessionState | null>(null);
const AREA_KEY = 'matetattal.area';
const POS_KEY = 'matetattal.pos';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [area, setAreaState] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) { setProfile(null); return; }
    try { setProfile(await getMyProfile(s.user.id)); } catch { setProfile(null); }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [a, p] = await Promise.all([AsyncStorage.getItem(AREA_KEY), AsyncStorage.getItem(POS_KEY)]);
        if (a) setAreaState(a);
        if (p) { const [lat, lng] = p.split(',').map(Number); if (isFinite(lat) && isFinite(lng)) setCoords({ lat, lng }); }
      } catch { /* التخزين غير متاح */ }
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      setSession(data.session);
      await loadProfile(data.session);
      setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      // تأجيل استدعاء قاعدة البيانات خارج callback المصادقة (توصية supabase-js)
      setTimeout(() => loadProfile(s), 0);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, [loadProfile]);

  const setArea = useCallback((a: string | null) => {
    setAreaState(a);
    AsyncStorage.setItem(AREA_KEY, a ?? '').catch(() => {});
  }, []);

  const locate = useCallback(async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return { ok: false, message: 'فعّل صلاحية الموقع أو اختر منطقتك يدوياً' };
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(c);
      AsyncStorage.setItem(POS_KEY, `${c.lat},${c.lng}`).catch(() => {});
      const a = nearestArea(c.lat, c.lng);
      setArea(a);
      return { ok: true, message: 'أقرب منطقة لك: ' + a };
    } catch {
      return { ok: false, message: 'ما قدرنا نحدد موقعك. اختر منطقتك يدوياً' };
    } finally {
      setLocating(false);
    }
  }, [setArea]);

  const value = useMemo<SessionState>(() => ({
    ready, session, profile,
    refreshProfile: () => loadProfile(session),
    signOut: async () => { await supabase.auth.signOut(); setProfile(null); },
    area, setArea, coords, locating, locate,
  }), [ready, session, profile, loadProfile, area, setArea, coords, locating, locate]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}

export const isAdmin = (p: Profile | null) => p?.role === 'admin';
export const isStaff = (p: Profile | null) => p?.role === 'admin' || p?.role === 'staff';
