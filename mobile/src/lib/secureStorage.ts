// تخزين جلسة الدخول بشكل آمن: Keychain (iOS) / Keystore (Android) عبر expo-secure-store.
// SecureStore يقبل ~2KB للقيمة، وجلسة Supabase أكبر أحياناً → نقسمها إلى أجزاء.
// الجلسات القديمة المحفوظة في AsyncStorage تُنقل تلقائياً ثم تُحذف منه (لا يخرج أحد من حسابه).
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const CHUNK = 1800;
const safeKey = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, '_');

async function removeChunks(key: string) {
  const n = Number(await SecureStore.getItemAsync(`${key}.n`)) || 0;
  for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  await SecureStore.deleteItemAsync(`${key}.n`);
}

export const secureStorage = {
  async getItem(name: string): Promise<string | null> {
    const key = safeKey(name);
    const n = Number(await SecureStore.getItemAsync(`${key}.n`)) || 0;
    if (n > 0) {
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const p = await SecureStore.getItemAsync(`${key}.${i}`);
        if (p == null) return null;
        parts.push(p);
      }
      return parts.join('');
    }
    // ترحيل جلسة قديمة من AsyncStorage
    const legacy = await AsyncStorage.getItem(name);
    if (legacy != null) {
      await secureStorage.setItem(name, legacy);
      await AsyncStorage.removeItem(name);
    }
    return legacy;
  },
  async setItem(name: string, value: string): Promise<void> {
    const key = safeKey(name);
    await removeChunks(key);
    const n = Math.ceil(value.length / CHUNK) || 1;
    for (let i = 0; i < n; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    await SecureStore.setItemAsync(`${key}.n`, String(n));
  },
  async removeItem(name: string): Promise<void> {
    await removeChunks(safeKey(name));
    await AsyncStorage.removeItem(name).catch(() => {});
  },
};
