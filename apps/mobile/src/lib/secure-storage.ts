import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Keychain/Keystore entries are size-limited, and a Supabase session can be
// larger, so values are split across numbered chunks.
const CHUNK = 1800;

const web = {
  getItem: async (key: string) => globalThis.localStorage?.getItem(key) ?? null,
  setItem: async (key: string, value: string) => globalThis.localStorage?.setItem(key, value),
  removeItem: async (key: string) => globalThis.localStorage?.removeItem(key),
};

const native = {
  async getItem(key: string): Promise<string | null> {
    const count = await SecureStore.getItemAsync(`${key}.n`);
    if (count === null) return null;
    const parts: string[] = [];
    for (let i = 0; i < Number(count); i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await native.removeItem(key);
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    }
    await SecureStore.setItemAsync(`${key}.n`, String(count));
  },

  async removeItem(key: string): Promise<void> {
    const count = await SecureStore.getItemAsync(`${key}.n`);
    if (count === null) return;
    await SecureStore.deleteItemAsync(`${key}.n`);
    for (let i = 0; i < Number(count); i++) {
      await SecureStore.deleteItemAsync(`${key}.${i}`);
    }
  },
};

/** Storage adapter for the Supabase session: Keychain/Keystore on device. */
export const secureStorage = Platform.OS === 'web' ? web : native;

/** Small device-local preferences (e.g. whether Face ID lock is on). */
export const devicePrefs = {
  get: (key: string) => secureStorage.getItem(`pref.${key}`),
  set: (key: string, value: string) => secureStorage.setItem(`pref.${key}`, value),
  remove: (key: string) => secureStorage.removeItem(`pref.${key}`),
};
