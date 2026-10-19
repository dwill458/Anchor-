import Constants from 'expo-constants';
import { createJSONStorage, type PersistStorage, type StateStorage, type StorageValue } from 'zustand/middleware';
import { isSqlCipherStorageEnabled } from './cohort';

export const sqlCipherEnabled = () => isSqlCipherStorageEnabled(
  Constants.expoConfig?.extra?.sqlCipherLab === true,
  Constants.expoConfig?.extra?.sqlCipherOwnerPilot === true,
  Constants.expoConfig?.extra?.sqlCipherOwnerPilotMigrationEnabled === true,
);
const database = () => (require('./runtime') as typeof import('./runtime')).recordDatabase();
const sceneNamespace = 'anchor-visualization-scenes-v1';
const privateWriteReceipts = new Map<string, Promise<void>>();
function trackWrite(name: string, write: Promise<void>): Promise<void> {
  privateWriteReceipts.set(name, write);
  // Middleware may discard its return value. The receipt still rejects for
  // services that confirm saves, without an unhandled background rejection.
  void write.catch(() => undefined);
  return write;
}
export async function flushPrivateWrite(name: string): Promise<void> {
  await privateWriteReceipts.get(name);
}
export function mergeSceneDocuments<S>(saved: StorageValue<S>, incoming: StorageValue<S>): StorageValue<S> {
  const old = saved.state as Record<string, unknown>;
  const next = incoming.state as Record<string, unknown>;
  if (old.ownerAccountId !== next.ownerAccountId) throw new Error('Scene owner mismatch requires recovery');
  const tombstones = new Set([...(old.tombstonedAnchorIds as string[] ?? []), ...(next.tombstonedAnchorIds as string[] ?? [])]);
  const state = { ...old, ...next, tombstonedAnchorIds: [...tombstones] };
  for (const field of ['scenes', 'suggestions', 'selectedSuggestionIndex', 'batchSource', 'upgradeAttempts']) {
    (state as Record<string, unknown>)[field] = Object.fromEntries(Object.entries({ ...(old[field] as object), ...(next[field] as object) }).filter(([id]) => !tombstones.has(id)));
  }
  return { ...saved, ...incoming, state: state as S };
}
let sceneBindingReset = false;
export function resetSceneViewWithoutPersistence(reset: () => void): void {
  sceneBindingReset = true;
  try { reset(); } finally { sceneBindingReset = false; }
}
const ownerSceneName = (accountId: string | null) => `${sceneNamespace}::owner::${accountId ? `account:${accountId}` : 'recovery'}`;
export async function readPersistedSceneOwner(accountId: string | null): Promise<StorageValue<unknown> | null> {
  return await database().read(ownerSceneName(accountId)) as StorageValue<unknown> | null;
}

/** Native access stays lazy: the old runtime does not require a SQLite module. */
export function privateJsonStorage<S>(legacy: StateStorage): PersistStorage<S> {
  if (!sqlCipherEnabled()) return createJSONStorage<S>(() => legacy)!;
  return {
    getItem: async (name) => {
      const value = await database().read(name) as StorageValue<S> | null;
      if (name === sceneNamespace && value) {
        const owner = (value.state as { ownerAccountId?: string | null }).ownerAccountId;
        // Proven legacy owner only; never adopt the current login.
        if (owner) {
          const scopedName = ownerSceneName(owner);
          await database().mutate(scopedName, (current) => current ? mergeSceneDocuments(value, current as StorageValue<S>) : value);
          return await database().read(scopedName) as StorageValue<S>;
        }
      }
      return value;
    },
    setItem: (name, value) => {
      if (name === sceneNamespace) {
        if (sceneBindingReset) return Promise.resolve();
        const owner = (value.state as { ownerAccountId?: string | null }).ownerAccountId;
        return trackWrite(name, database().mutate(ownerSceneName(owner ?? null), (current) => current ? mergeSceneDocuments(current as StorageValue<S>, value) : value));
      }
      return trackWrite(name, database().write(name, value));
    },
    // Logical removal retains both source bytes and encrypted recovery records.
    removeItem: async (name) => {
      if (name === 'anchor-vault-storage') throw new Error('Vault removal requires an explicit owner operation');
      await database().mutate(name, () => null);
    },
  };
}

export async function readDatabaseValue(name: string): Promise<string | null> {
  const value = await database().read(name);
  return value === null ? null : JSON.stringify(value);
}
export async function writeDatabaseValue(name: string, value: string): Promise<void> {
  await database().write(name, JSON.parse(value));
}
export async function removeDatabaseValue(name: string): Promise<void> {
  if (name === 'anchor-vault-storage') throw new Error('Vault removal requires an explicit owner operation');
  await database().mutate(name, () => null);
}
