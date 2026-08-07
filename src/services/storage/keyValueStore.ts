import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Narrow persistence port. Stores and services depend on this rather than on
 * AsyncStorage directly, so swapping in MMKV (or an in-memory fake for tests)
 * touches exactly one file.
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const asyncStorageStore: KeyValueStore = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
};

/** In-memory implementation used by tests and by the web preview fallback. */
export function createMemoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: async (key) => map.get(key) ?? null,
    setItem: async (key, value) => void map.set(key, value),
    removeItem: async (key) => void map.delete(key),
  };
}

/** Typed JSON helper so callers never hand-roll parse/stringify + try/catch. */
export async function readJson<T>(store: KeyValueStore, key: string, fallback: T): Promise<T> {
  try {
    const raw = await store.getItem(key);
    return raw ? ({ ...fallback, ...(JSON.parse(raw) as Partial<T>) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function writeJson<T>(store: KeyValueStore, key: string, value: T): Promise<void> {
  try {
    await store.setItem(key, JSON.stringify(value));
  } catch {
    // Persistence is best-effort; a failed write must never break gameplay.
  }
}
