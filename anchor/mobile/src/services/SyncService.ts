/**
 * Anchor App - Sync Service
 *
 * Synchronizes local state with the backend API.
 */

import { get, fetchCompleteProfile } from '@/services/ApiClient';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import type { Anchor, ApiResponse, ProfileData, RedactedAnchor, User } from '@/types';
import { ServiceError } from './ServiceErrors';

export interface SyncMockConfig {
  enabled: boolean;
  anchors: Anchor[];
  profile: ProfileData | null;
}

const DEFAULT_SYNC_MOCK: SyncMockConfig = {
  enabled: false,
  anchors: [],
  profile: null,
};

const normalizeDate = (value?: Date | string): Date | undefined => {
  if (!value) return undefined;
  return value instanceof Date ? value : new Date(value);
};

const normalizeAnchor = (anchor: Anchor): Anchor => ({
  ...anchor,
  createdAt: normalizeDate(anchor.createdAt) ?? new Date(),
  updatedAt: normalizeDate(anchor.updatedAt) ?? new Date(),
  chargedAt: normalizeDate(anchor.chargedAt),
  lastActivatedAt: normalizeDate(anchor.lastActivatedAt),
});

const normalizeUser = (user: User): User => ({
  ...user,
  createdAt: normalizeDate(user.createdAt) ?? new Date(),
  stabilizesTotal: user.stabilizesTotal ?? 0,
  stabilizeStreakDays: user.stabilizeStreakDays ?? 0,
  lastStabilizeAt: normalizeDate(user.lastStabilizeAt),
});

const normalizeRedactedAnchor = (anchor: RedactedAnchor): RedactedAnchor => ({
  ...anchor,
  createdAt: normalizeDate(anchor.createdAt) ?? new Date(),
});

const normalizeProfileData = (profile: ProfileData): ProfileData => ({
  ...profile,
  user: normalizeUser(profile.user),
  activeAnchors: profile.activeAnchors.map(normalizeRedactedAnchor),
});

/**
 * Sync Service
 *
 * Usage:
 * ```typescript
 * import SyncService from '@/services/SyncService';
 *
 * await SyncService.syncAnchors();
 * await SyncService.syncUserProfile();
 * ```
 */
class SyncService {
  private mockConfig: SyncMockConfig = { ...DEFAULT_SYNC_MOCK };

  /**
   * Configure mock data for tests and previews.
   */
  setMockConfig(config: Partial<SyncMockConfig>): void {
    this.mockConfig = { ...this.mockConfig, ...config };
  }

  /**
   * Sync anchors from the backend and merge with local state.
   */
  async syncAnchors(): Promise<void> {
    const anchorStore = useAnchorStore.getState();
    anchorStore.setLoading(true);

    try {
      const remoteAnchors = this.mockConfig.enabled
        ? this.mockConfig.anchors.map(normalizeAnchor)
        : await this.fetchRemoteAnchors();

      const merged = this.mergeAnchors(anchorStore.anchors, remoteAnchors);
      anchorStore.setAnchors(merged);
      anchorStore.markSynced();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to sync anchors.';
      anchorStore.setError(message);
      throw new ServiceError('sync/anchors-failed', message, error);
    } finally {
      anchorStore.setLoading(false);
    }
  }

  /**
   * Sync the user profile data from the backend.
   */
  async syncUserProfile(): Promise<void> {
    const authStore = useAuthStore.getState();
    authStore.setLoading(true);

    try {
      const profileData = this.mockConfig.enabled && this.mockConfig.profile
        ? normalizeProfileData(this.mockConfig.profile)
        : normalizeProfileData(await fetchCompleteProfile());

      authStore.setUser(profileData.user);
      useAuthStore.setState({
        profileData,
        profileLastFetched: Date.now(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to sync user profile.';
      throw new ServiceError('sync/profile-failed', message, error);
    } finally {
      authStore.setLoading(false);
    }
  }

  /**
   * Resolve conflicts between local and remote data.
   */
  handleConflict<T extends { updatedAt?: Date | string; createdAt?: Date | string }>(
    localData: T,
    remoteData: T
  ): T {
    try {
      const localTimestamp = this.toTimestamp(localData.updatedAt ?? localData.createdAt);
      const remoteTimestamp = this.toTimestamp(remoteData.updatedAt ?? remoteData.createdAt);

      if (localTimestamp === null && remoteTimestamp === null) {
        return remoteData;
      }

      if (localTimestamp !== null && remoteTimestamp !== null) {
        return localTimestamp >= remoteTimestamp ? localData : remoteData;
      }

      return localTimestamp !== null ? localData : remoteData;
    } catch (error) {
      throw new ServiceError(
        'sync/conflict-failed',
        'Failed to resolve sync conflict.',
        error
      );
    }
  }

  /**
   * Get the last successful sync time.
   * Returns epoch start if the app has never synced.
   */
  async getLastSyncTime(): Promise<Date> {
    try {
      const lastSyncedAt = useAnchorStore.getState().lastSyncedAt;
      return lastSyncedAt ?? new Date(0);
    } catch (error) {
      throw new ServiceError(
        'sync/last-sync-failed',
        'Failed to read last sync time.',
        error
      );
    }
  }

  private async fetchRemoteAnchors(): Promise<Anchor[]> {
    const response = await get<ApiResponse<Anchor[]>>('/api/anchors');
    if (!response.success || !response.data) {
      throw new ServiceError(
        'sync/anchors-failed',
        response.error?.message || 'Failed to sync anchors.'
      );
    }
    return response.data.map(normalizeAnchor);
  }

  private mergeAnchors(localAnchors: Anchor[], remoteAnchors: Anchor[]): Anchor[] {
    const merged = new Map<string, Anchor>();

    localAnchors.map(normalizeAnchor).forEach((anchor) => {
      merged.set(anchor.id, anchor);
    });

    remoteAnchors.map(normalizeAnchor).forEach((remoteAnchor) => {
      const existing = merged.get(remoteAnchor.id);
      if (!existing) {
        merged.set(remoteAnchor.id, remoteAnchor);
        return;
      }

      const winner = this.handleConflict(existing, remoteAnchor);
      merged.set(remoteAnchor.id, normalizeAnchor(winner));
    });

    return Array.from(merged.values()).sort((a, b) => {
      const aTime = this.toTimestamp(a.updatedAt ?? a.createdAt) ?? 0;
      const bTime = this.toTimestamp(b.updatedAt ?? b.createdAt) ?? 0;
      return bTime - aTime;
    });
  }

  private toTimestamp(value?: Date | string): number | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    const time = date.getTime();
    return Number.isNaN(time) ? null : time;
  }
}

export default new SyncService();
