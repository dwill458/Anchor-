import type { Anchor } from '@/types';
import type { StoredProfile } from '@/stores/profileStore';
import { readSecureValue, writeSecureValue } from '@/stores/encryptedPersistStorage';
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
  threadStrength: number;
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
  await writeSecureValue(sessionSnapshotKey(userId), JSON.stringify(snapshot));
}

export async function loadSessionSnapshot(userId: string): Promise<SessionSnapshot | null> {
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
