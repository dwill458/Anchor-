/**
 * Anchor App - Storage Service
 *
 * Abstraction over AsyncStorage with JSON serialization and test-friendly mocks.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { ServiceError } from './ServiceErrors';

export type StorageKeyValuePair<T = unknown> = [string, T];

type SerializedPayload = {
  value: unknown;
};

/**
 * Storage Service
 *
 * Usage:
 * ```typescript
 * await StorageService.setItem('anchor:settings', { theme: 'zen_architect' });
 * const settings = await StorageService.getItem<{ theme: string }>('anchor:settings');
 * ```
 */
export class StorageService {
  private static mockEnabled = false;
  private static mockStore = new Map<string, string>();

  /**
   * Enable mock storage for tests and previews.
   */
  static setMockEnabled(enabled: boolean, initialValues?: Record<string, unknown>): void {
    StorageService.mockEnabled = enabled;
    StorageService.mockStore.clear();

    if (enabled && initialValues) {
      Object.entries(initialValues).forEach(([key, value]) => {
        StorageService.mockStore.set(key, StorageService.serializeValue(value));
      });
    }
  }

  /**
   * Persist a value by key.
   */
  static async setItem<T>(key: string, value: T): Promise<void> {
    try {
      StorageService.assertValidKey(key);
      const serialized = StorageService.serializeValue(value);
      if (StorageService.mockEnabled) {
        StorageService.mockStore.set(key, serialized);
        return;
      }

      await AsyncStorage.setItem(key, serialized);
    } catch (error) {
      throw new ServiceError('storage/set-failed', `Failed to set value for "${key}".`, error);
    }
  }

  /**
   * Read a value by key.
   */
  static async getItem<T>(key: string): Promise<T | null> {
    try {
      StorageService.assertValidKey(key);
      const raw = StorageService.mockEnabled
        ? StorageService.mockStore.get(key) ?? null
        : await AsyncStorage.getItem(key);
      if (raw === null) return null;
      return StorageService.deserializeValue<T>(raw);
    } catch (error) {
      throw new ServiceError('storage/get-failed', `Failed to read value for "${key}".`, error);
    }
  }

  /**
   * Remove a value by key.
   */
  static async removeItem(key: string): Promise<void> {
    try {
      StorageService.assertValidKey(key);
      if (StorageService.mockEnabled) {
        StorageService.mockStore.delete(key);
        return;
      }

      await AsyncStorage.removeItem(key);
    } catch (error) {
      throw new ServiceError(
        'storage/remove-failed',
        `Failed to remove value for "${key}".`,
        error
      );
    }
  }

  /**
   * Clear all stored values.
   */
  static async clear(): Promise<void> {
    try {
      if (StorageService.mockEnabled) {
        StorageService.mockStore.clear();
        return;
      }

      await AsyncStorage.clear();
    } catch (error) {
      throw new ServiceError('storage/clear-failed', 'Failed to clear storage.', error);
    }
  }

  /**
   * Get all stored keys.
   */
  static async getAllKeys(): Promise<string[]> {
    try {
      if (StorageService.mockEnabled) {
        return Array.from(StorageService.mockStore.keys());
      }

      return await AsyncStorage.getAllKeys();
    } catch (error) {
      throw new ServiceError('storage/keys-failed', 'Failed to get storage keys.', error);
    }
  }

  /**
   * Fetch multiple values by key.
   */
  static async multiGet<T>(keys: string[]): Promise<Array<[string, T | null]>> {
    try {
      keys.forEach(StorageService.assertValidKey);
      if (StorageService.mockEnabled) {
        return keys.map((key) => {
          const raw = StorageService.mockStore.get(key);
          return [key, raw ? StorageService.deserializeValue<T>(raw) : null];
        });
      }

      const values = await AsyncStorage.multiGet(keys);
      return values.map(([key, raw]) => [key, raw ? StorageService.deserializeValue<T>(raw) : null]);
    } catch (error) {
      throw new ServiceError('storage/multi-get-failed', 'Failed to read multiple keys.', error);
    }
  }

  /**
   * Persist multiple key/value pairs.
   */
  static async multiSet(keyValuePairs: StorageKeyValuePair[]): Promise<void> {
    try {
      const pairs = keyValuePairs.map(([key, value]) => {
        StorageService.assertValidKey(key);
        return [key, StorageService.serializeValue(value)] as [string, string];
      });

      if (StorageService.mockEnabled) {
        pairs.forEach(([key, value]) => {
          StorageService.mockStore.set(key, value);
        });
        return;
      }

      await AsyncStorage.multiSet(pairs);
    } catch (error) {
      throw new ServiceError('storage/multi-set-failed', 'Failed to write multiple keys.', error);
    }
  }

  private static assertValidKey(key: string): void {
    if (!key || key.trim().length === 0) {
      throw new ServiceError('storage/set-failed', 'Storage key must be a non-empty string.');
    }
  }

  private static serializeValue(value: unknown): string {
    if (value === undefined) {
      throw new ServiceError('storage/set-failed', 'StorageService cannot store undefined values.');
    }

    const payload: SerializedPayload = { value };
    return JSON.stringify(payload);
  }

  private static deserializeValue<T>(raw: string): T {
    try {
      const parsed = JSON.parse(raw) as SerializedPayload | T;
      if (parsed && typeof parsed === 'object' && 'value' in parsed) {
        return (parsed as SerializedPayload).value as T;
      }
      return parsed as T;
    } catch {
      return raw as unknown as T;
    }
  }
}
