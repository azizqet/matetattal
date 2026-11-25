import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { env } from './env';
import { authStorage } from './secureStorage';

export const supabase = createClient(env.supabaseUrl || 'https://not-configured.invalid', env.supabaseKey || 'not-configured', {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
    flowType: 'pkce',
  },
  realtime: { params: { eventsPerSecond: 10 } },
  global: { headers: { 'x-client-info': 'fikra-sell-app/1.0' } },
});

// Refresh tokens only while the app is in the foreground (Supabase guidance for RN).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/**
 * Public CDN URL for a stored file. Images are compressed on the device
 * before upload (see lib/images.ts), so no paid server-side resizing is used.
 */
export function publicUrl(bucket: 'ad-images' | 'avatars' | 'banners', path?: string | null): string | undefined {
  if (!path) return undefined;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
