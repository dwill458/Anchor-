import { apiClient, fetchCompleteProfile } from '@/services/ApiClient';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import type { Anchor, ApiResponse, ProfileData, User } from '@/types';

function normalizeDate(value?: Date | string | null): Date | undefined {
  if (!value) return undefined;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function normalizeAnchor(anchor: Anchor): Anchor {
  return {
    ...anchor,
    createdAt: normalizeDate(anchor.createdAt) ?? new Date(),
    updatedAt: normalizeDate(anchor.updatedAt) ?? new Date(),
    chargedAt: normalizeDate(anchor.chargedAt),
    firstChargedAt: normalizeDate(anchor.firstChargedAt),
    ignitedAt: normalizeDate(anchor.ignitedAt),
    lastActivatedAt: normalizeDate(anchor.lastActivatedAt),
    releasedAt: normalizeDate(anchor.releasedAt),
    archivedAt: normalizeDate(anchor.archivedAt),
  };
}

function normalizeUser(user: User): User {
  return {
    ...user,
    isComped: user.isComped === true,
    createdAt: normalizeDate(user.createdAt) ?? new Date(),
    lastStabilizeAt: normalizeDate(user.lastStabilizeAt),
    stabilizesTotal: user.stabilizesTotal ?? 0,
    stabilizeStreakDays: user.stabilizeStreakDays ?? 0,
  };
}

function normalizeProfileData(profileData: ProfileData): ProfileData {
  return {
    ...profileData,
    user: normalizeUser(profileData.user),
    activeAnchors: profileData.activeAnchors.map((anchor) => ({
      ...anchor,
      createdAt: normalizeDate(anchor.createdAt) ?? new Date(),
    })),
  };
}

interface HydrateOptions {
  skipAnchorRefresh?: boolean;
}

class AuthHydrationService {
  async hydrateAuthenticatedData(options: HydrateOptions = {}): Promise<void> {
    const [profileData, anchorsResponse] = await Promise.all([
      fetchCompleteProfile(),
      apiClient.get<ApiResponse<Anchor[]>>('/api/anchors', {
        params: {
          limit: 100,
          orderBy: 'updatedAt',
          order: 'desc',
        },
      }),
    ]);

    const normalizedProfileData = normalizeProfileData(profileData);
    const remoteAnchors = Array.isArray(anchorsResponse.data?.data)
      ? anchorsResponse.data.data.map(normalizeAnchor)
      : [];

    const authStore = useAuthStore.getState();
    authStore.setUser(normalizedProfileData.user);
    useAuthStore.setState({
      profileData: normalizedProfileData,
      profileLastFetched: Date.now(),
      hasCompletedOnboarding: Boolean(normalizedProfileData.user.hasCompletedOnboarding),
      isOfflineMode: false,
    });

    if (!options.skipAnchorRefresh) {
      const anchorStore = useAnchorStore.getState();
      anchorStore.setAnchors(remoteAnchors);
      anchorStore.markSynced();
    }

    useAuthStore.getState().computeStreak();
  }
}

export default new AuthHydrationService();
