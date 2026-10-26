import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * When the user last saved a verified backup file outside Anchor. Only a timestamp is kept (never
 * the key or archive) so Settings can say "Not backed up" or "Last backup: <date>".
 */
export const LAST_BACKUP_STORAGE_KEY = 'anchor-last-backup-at';

type Listener = (at: string | null) => void;
const listeners = new Set<Listener>();

export async function readLastBackupAt(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(LAST_BACKUP_STORAGE_KEY);
    return raw && !Number.isNaN(new Date(raw).getTime()) ? raw : null;
  } catch {
    return null;
  }
}

export async function recordBackupSaved(at: Date = new Date()): Promise<void> {
  const iso = at.toISOString();
  try {
    await AsyncStorage.setItem(LAST_BACKUP_STORAGE_KEY, iso);
  } catch {
    // The backup itself succeeded; failing to remember when only leaves the status line stale.
  }
  listeners.forEach((listener) => listener(iso));
}

export function formatLastBackup(at: string | null): string {
  if (!at) return 'Never. Back up now to protect your data.';
  const date = new Date(at);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function useLastBackupAt(): string | null {
  const [at, setAt] = useState<string | null>(null);
  const load = useCallback(() => {
    void readLastBackupAt().then(setAt);
  }, []);
  useEffect(() => {
    load();
    listeners.add(setAt);
    return () => {
      listeners.delete(setAt);
    };
  }, [load]);
  return at;
}
