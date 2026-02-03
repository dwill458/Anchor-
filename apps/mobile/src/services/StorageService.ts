/**
 * Anchor App - Storage Service
 *
 * Handles local data persistence using AsyncStorage.
 * (Remote media storage is handled by the backend via Cloudflare R2.)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Anchor, Activation, UserSettings } from '@/types';

const STORAGE_PREFIX = 'anchor';

const storageKey = (suffix: string) => `${STORAGE_PREFIX}:${suffix}`;
const anchorsKey = (userId?: string) => storageKey(`anchors:${userId || 'default'}`);
const activationsKey = (userId?: string) => storageKey(`activations:${userId || 'default'}`);
const settingsKey = (userId: string) => storageKey(`settings:${userId}`);

const serializeAnchor = (anchor: Anchor): Anchor => ({
  ...anchor,
  createdAt: anchor.createdAt instanceof Date ? anchor.createdAt : new Date(anchor.createdAt),
  updatedAt: anchor.updatedAt instanceof Date ? anchor.updatedAt : new Date(anchor.updatedAt),
  chargedAt: anchor.chargedAt ? new Date(anchor.chargedAt) : undefined,
  lastActivatedAt: anchor.lastActivatedAt ? new Date(anchor.lastActivatedAt) : undefined,
});

const serializeActivation = (activation: Activation): Activation => ({
  ...activation,
  activatedAt: activation.activatedAt instanceof Date ? activation.activatedAt : new Date(activation.activatedAt),
});

const serializeSettings = (settings: UserSettings): UserSettings => ({
  ...settings,
  updatedAt: settings.updatedAt instanceof Date ? settings.updatedAt : new Date(settings.updatedAt),
});

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn('[Storage] Failed to read key', { key, error });
    return fallback;
  }
};

const writeJson = async (key: string, value: unknown): Promise<void> => {
  await AsyncStorage.setItem(key, JSON.stringify(value));
};

export class StorageService {
  /**
   * Save or update an anchor locally
   */
  async saveAnchor(anchor: Anchor): Promise<void> {
    const key = anchorsKey(anchor.userId);
    const existing = await readJson<Anchor[]>(key, []);
    const updated = [...existing.filter((item) => item.id !== anchor.id), anchor].map(serializeAnchor);
    await writeJson(key, updated);
  }

  /**
   * Fetch anchors for a user
   */
  async getAnchors(userId?: string): Promise<Anchor[]> {
    const key = anchorsKey(userId);
    const anchors = await readJson<Anchor[]>(key, []);
    return anchors.map(serializeAnchor);
  }

  /**
   * Save an activation record
   */
  async saveActivation(activation: Activation): Promise<void> {
    const key = activationsKey(activation.userId);
    const existing = await readJson<Activation[]>(key, []);
    const updated = [...existing, activation].map(serializeActivation);
    await writeJson(key, updated);
  }

  /**
   * Fetch user settings
   */
  async getUserSettings(userId: string): Promise<UserSettings | null> {
    const key = settingsKey(userId);
    const settings = await readJson<UserSettings | null>(key, null);
    return settings ? serializeSettings(settings) : null;
  }

  /**
   * Save user settings
   */
  async saveUserSettings(settings: UserSettings): Promise<void> {
    const key = settingsKey(settings.userId);
    await writeJson(key, serializeSettings(settings));
  }

  /**
   * Clear cached data (logout)
   */
  async clearCache(): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const anchorKeys = keys.filter((key) => key.startsWith(`${STORAGE_PREFIX}:`));
    if (anchorKeys.length > 0) {
      await AsyncStorage.multiRemove(anchorKeys);
    }
  }
}
