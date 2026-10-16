import type { Anchor } from '@/types';
import type { StoredProfile } from '@/stores/profileStore';
import { readSecureValue, writeSecureValue } from '@/stores/encryptedPersistStorage';
import { sqlCipherEnabled } from '@/storage/sqlcipher/persistence';
const database = () => (require('@/storage/sqlcipher/runtime') as typeof import('@/storage/sqlcipher/runtime')).recordDatabase();
import { logger } from '@/utils/logger';
import type { SessionAudioConfiguration } from '@/types/sessionAudio';
import type { PracticeSessionRecord } from '@/types/practice';
import type { SessionType } from '@/stores/sessionStore';
import type { PrimingSessionType } from '@/utils/primingAnalytics';

export interface SessionSnapshot {
  lastSession: {
    id: string;
    anchorId: string;
    type: SessionType;
    durationSeconds: number;
    mode: 'silent' | 'mantra' | 'ambient';
    audioConfiguration?: SessionAudioConfiguration;
    reflectionWord?: string;
    completedAt: string;
  } | null;
  todayPractice: {
    date: string;
    sessionsCount: number;
    totalSeconds: number;
  };
  weeklyPractice: {
    weekKey: string;
    sessionsCount: number;
    totalSeconds: number;
  };
  lastGraceDayUsedAt: string | null;
  sessionLog: Array<{
    id: string;
    anchorId: string;
    type: SessionType;
    durationSeconds: number;
    mode: 'silent' | 'mantra' | 'ambient';
    audioConfiguration?: SessionAudioConfiguration;
    reflectionWord?: string;
    completedAt: string;
  }>;
  threadStrength: number | null;
  totalSessionsCount: number;
  lastPrimedAt: string | null;
  weekHistory: boolean[];
  weekHistoryKey: string;
  primingHistory: Array<{
    id: string;
    anchorId: string;
    type: PrimingSessionType;
    completedAt: string;
    localDate: string;
    weekKey: string;
    weekStart: string;
    weekdayIndex: number;
    hourOfDay: number;
    timeOfDay: string;
  }>;
  practiceHistory?: PracticeSessionRecord[];
  journeyWeekStart: string | null;
  lastDecayDate: string | null;
}

export interface AnchorSnapshot {
  anchors: Anchor[];
  currentAnchorId?: string;
}

const profileSnapshotKey = (userId: string) => `anchor:profile-snapshot:${userId}`;
const sessionSnapshotKey = (userId: string) => `anchor:session-snapshot:${userId}`;
const anchorSnapshotKey = (userId: string) => `anchor:anchor-snapshot:${userId}`;

export async function saveProfileSnapshot(
  userId: string,
  snapshot: StoredProfile
): Promise<void> {
  if (sqlCipherEnabled()) return database().write(profileSnapshotKey(userId), snapshot);
  await writeSecureValue(profileSnapshotKey(userId), JSON.stringify(snapshot));
}

export async function loadProfileSnapshot(userId: string): Promise<StoredProfile | null> {
  const rawSnapshot = await readSecureValue(profileSnapshotKey(userId));
  if (!rawSnapshot) {
    return null;
  }

  try {
    return JSON.parse(rawSnapshot) as StoredProfile;
  } catch (error) {
    logger.warn('[UserLocalStateService] Failed to load profile snapshot', error);
    return null;
  }
}

export async function saveSessionSnapshot(
  userId: string,
  snapshot: SessionSnapshot
): Promise<void> {
  if (sqlCipherEnabled()) return database().write(sessionSnapshotKey(userId), snapshot);
  await writeSecureValue(sessionSnapshotKey(userId), JSON.stringify(snapshot));
}

export async function loadSessionSnapshot(userId: string): Promise<SessionSnapshot | null> {
  if (sqlCipherEnabled()) {
    const snapshot = await database().read(sessionSnapshotKey(userId)) as SessionSnapshot | null;
    const history = await database().read(`anchor:practice-history:${userId}`) as PracticeSessionRecord[] | null;
    if (!snapshot && !history?.length) return null;
    const base = snapshot ?? (require('@/stores/sessionStore') as typeof import('@/stores/sessionStore')).createInitialSessionState();
    const existing = base.practiceHistory ?? [];
    const byId = new Map((history ?? []).map((event) => [event.id, event]));
    // A server acknowledgement/projection can carry newer fields than the
    // immutable completion event. Preserve those fields for the same identity.
    for (const event of existing) byId.set(event.id, event);
    return { ...base, practiceHistory: [...byId.values()].filter((event) => event.accountId === userId) };
  }
  const rawSnapshot = await readSecureValue(sessionSnapshotKey(userId));
  if (!rawSnapshot) {
    return null;
  }

  try {
    return JSON.parse(rawSnapshot) as SessionSnapshot;
  } catch (error) {
    logger.warn('[UserLocalStateService] Failed to load session snapshot', error);
    return null;
  }
}

export async function saveAnchorSnapshot(
  userId: string,
  snapshot: AnchorSnapshot
): Promise<void> {
  if (sqlCipherEnabled()) return database().write(anchorSnapshotKey(userId), snapshot);
  await writeSecureValue(anchorSnapshotKey(userId), JSON.stringify(snapshot));
}

export async function loadAnchorSnapshot(userId: string): Promise<AnchorSnapshot | null> {
  const rawSnapshot = await readSecureValue(anchorSnapshotKey(userId));
  if (!rawSnapshot) {
    return null;
  }

  try {
    return JSON.parse(rawSnapshot) as AnchorSnapshot;
  } catch (error) {
    logger.warn('[UserLocalStateService] Failed to load anchor snapshot', error);
    return null;
  }
}
