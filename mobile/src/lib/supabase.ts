import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import { secureStorage } from './secureStorage';

// المفتاح العام (publishable) فقط. مفتاح service_role لا يوضع في التطبيق أبداً.
const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string; supabasePublishableKey?: string };
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? extra.supabasePublishableKey ?? '';

const isServer = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // الجوال: تخزين مشفّر (Keychain/Keystore). الويب: التخزين الافتراضي للمتصفح.
    storage: isServer ? undefined : Platform.OS === 'web' ? AsyncStorage : secureStorage,
    autoRefreshToken: true,
    persistSession: !isServer,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'implicit',
  },
});

// تحديث الجلسة فقط عندما يكون التطبيق في الواجهة (توصية Supabase لـ React Native)
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (s) => {
    if (s === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
