import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Session storage for Supabase Auth backed by the iOS Keychain / Android
 * Keystore. SecureStore values are limited in size, so long values (the
 * session JSON) are split into chunks.
 */
const CHUNK = 1800;
const opts: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };
const safeKey = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_');

async function getItem(key: string): Promise<string | null> {
  const k = safeKey(key);
  const count = await SecureStore.getItemAsync(`${k}.n`, opts);
  if (!count) return SecureStore.getItemAsync(k, opts);
  const parts: string[] = [];
  for (let i = 0; i < Number(count); i++) {
    const p = await SecureStore.getItemAsync(`${k}.${i}`, opts);
    if (p == null) return null;
    parts.push(p);
  }
  return parts.join('');
}

async function removeItem(key: string): Promise<void> {
  const k = safeKey(key);
  const count = Number((await SecureStore.getItemAsync(`${k}.n`, opts)) ?? 0);
  for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${k}.${i}`, opts);
  await SecureStore.deleteItemAsync(`${k}.n`, opts);
  await SecureStore.deleteItemAsync(k, opts);
}

async function setItem(key: string, value: string): Promise<void> {
  await removeItem(key);
  const k = safeKey(key);
  if (value.length <= CHUNK) return SecureStore.setItemAsync(k, value, opts);
  const n = Math.ceil(value.length / CHUNK);
  for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), opts);
  await SecureStore.setItemAsync(`${k}.n`, String(n), opts);
}

const webStorage = {
  getItem: async (k: string) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(k)),
  setItem: async (k: string, v: string) => { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); },
  removeItem: async (k: string) => { if (typeof localStorage !== 'undefined') localStorage.removeItem(k); },
};

export const authStorage = Platform.OS === 'web' ? webStorage : { getItem, setItem, removeItem };
