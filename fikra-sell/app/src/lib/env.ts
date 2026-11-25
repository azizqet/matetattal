import Constants from 'expo-constants';

/**
 * Public runtime configuration. Only PUBLIC values belong here: the
 * Supabase URL and the publishable (anon) key are designed to ship in the
 * app; every permission is enforced by Row Level Security on the server.
 * Never put a service-role key in the app.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? extra.supabaseUrl ?? '',
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_KEY ?? extra.supabaseKey ?? '',
  easProjectId: (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId,
  appScheme: 'fikrasell',
  webBase: process.env.EXPO_PUBLIC_WEB_BASE ?? extra.webBase ?? '',
};

export const isConfigured = env.supabaseUrl.startsWith('http') && env.supabaseKey.length > 20;
