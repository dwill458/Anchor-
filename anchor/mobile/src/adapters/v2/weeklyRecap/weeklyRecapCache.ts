import AsyncStorage from '@react-native-async-storage/async-storage';
import { isWeeklyRecap, type WeeklyRecapEnvelope } from './types';

/**
 * Offline copy of recaps the person has opened. A FINAL recap is immutable, so its cached copy is exactly the server's.
 * A DRAFT copy is kept for offline reading but stays labelled provisional. All access is best-effort.
 */
const key = (weekKey: string) => `anchor.weeklyRecap.v2.${weekKey}`;
const LATEST = 'anchor.weeklyRecap.v2.latest';

export async function readCachedRecap(weekKey: 'latest' | string): Promise<WeeklyRecapEnvelope | null> {
  try {
    let target = weekKey;
    if (weekKey === 'latest') target = (await AsyncStorage.getItem(LATEST)) ?? '';
    if (!target) return null;
    const raw = await AsyncStorage.getItem(key(target));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return isWeeklyRecap(parsed?.recap) ? (parsed as WeeklyRecapEnvelope) : null;
  } catch { return null; }
}

export async function writeCachedRecap(entry: WeeklyRecapEnvelope, isLatest: boolean): Promise<void> {
  try {
    const existing = await readCachedRecap(entry.recap.weekKey);
    if (existing?.recap.status === 'FINAL' && entry.recap.status !== 'FINAL') return; // never regress a final copy
    await AsyncStorage.setItem(key(entry.recap.weekKey), JSON.stringify(entry));
    if (isLatest) await AsyncStorage.setItem(LATEST, entry.recap.weekKey);
  } catch { /* storage is a convenience */ }
}
