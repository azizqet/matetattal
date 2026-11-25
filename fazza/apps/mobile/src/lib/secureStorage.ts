/**
 * Session storage backed by the device keychain/keystore (expo-secure-store).
 * Values are chunked because some iOS versions reject values above ~2KB.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const CHUNK = 1800;
const safeKey = (k: string) => k.replace(/[^A-Za-z0-9._-]/g, "_");

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") return globalThis.localStorage?.getItem(key) ?? null;
    const k = safeKey(key);
    const countRaw = await SecureStore.getItemAsync(`${k}.n`);
    if (!countRaw) return null;
    const parts: string[] = [];
    for (let i = 0; i < Number(countRaw); i++) {
      const p = await SecureStore.getItemAsync(`${k}.${i}`);
      if (p === null) return null;
      parts.push(p);
    }
    return parts.join("");
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") { globalThis.localStorage?.setItem(key, value); return; }
    const k = safeKey(key);
    await this.removeItem(key);
    const n = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < n; i++) {
      await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
      });
    }
    await SecureStore.setItemAsync(`${k}.n`, String(n));
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") { globalThis.localStorage?.removeItem(key); return; }
    const k = safeKey(key);
    const countRaw = await SecureStore.getItemAsync(`${k}.n`);
    const n = Number(countRaw ?? 0);
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${k}.${i}`);
    await SecureStore.deleteItemAsync(`${k}.n`);
  },
};
