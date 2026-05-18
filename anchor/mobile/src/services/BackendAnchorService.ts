import { apiClient } from '@/services/ApiClient';
import { useAnchorStore } from '@/stores/anchorStore';
import type { Anchor, ApiResponse } from '@/types';
import { logger } from '@/utils/logger';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCAL_TEMP_ANCHOR_ID_PREFIXES = ['anchor-', 'pending-first-anchor-'] as const;

function normalizeDate(value?: string | Date | null): Date | undefined {
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

function buildAnchorCreatePayload(anchor: Anchor) {
  return {
    intentionText: anchor.intentionText,
    category: anchor.category,
    distilledLetters: anchor.distilledLetters,
    baseSigilSvg: anchor.baseSigilSvg,
    structureVariant: anchor.structureVariant,
    reinforcedSigilSvg: anchor.reinforcedSigilSvg,
    reinforcementMetadata: anchor.reinforcementMetadata,
    enhancedImageUrl: anchor.enhancedImageUrl,
    enhancementMetadata: anchor.enhancementMetadata,
    mantraText: anchor.mantraText,
    mantraPronunciation: anchor.mantraPronunciation,
    mantraAudioUrl: anchor.mantraAudioUrl,
    planetaryTier: anchor.planetaryTier,
    classifierVersion: anchor.classifierVersion,
    classifierMeta: anchor.classifierMeta,
  };
}

export function isBackendAnchorId(anchorId: string | undefined | null): boolean {
  if (typeof anchorId !== 'string' || anchorId.length === 0) {
    return false;
  }

  if (UUID_PATTERN.test(anchorId)) {
    return true;
  }

  return !LOCAL_TEMP_ANCHOR_ID_PREFIXES.some((prefix) => anchorId.startsWith(prefix));
}

function getAnchorFromStore(
  anchorStore: ReturnType<typeof useAnchorStore.getState>,
  referenceId: string
): Anchor | undefined {
  if (typeof anchorStore.getAnchorById === 'function') {
    return anchorStore.getAnchorById(referenceId);
  }

  return anchorStore.anchors?.find(
    (anchor) => anchor.id === referenceId || anchor.localId === referenceId
  );
}

class BackendAnchorService {
  async ensureServerAnchor(referenceId: string): Promise<Anchor | null> {
    const anchorStore = useAnchorStore.getState();
    const localAnchor = getAnchorFromStore(anchorStore, referenceId);

    if (!localAnchor) {
      return null;
    }

    if (isBackendAnchorId(localAnchor.id)) {
      return localAnchor;
    }

    const response = await apiClient.post<ApiResponse<Anchor>>('/api/anchors', buildAnchorCreatePayload(localAnchor));
    const createdAnchor = response.data?.data;

    if (!response.data?.success || !createdAnchor?.id) {
      throw new Error('Backend did not return the created anchor.');
    }

    const normalizedAnchor = normalizeAnchor({
      ...localAnchor,
      ...createdAnchor,
      id: createdAnchor.id,
      localId: localAnchor.localId ?? localAnchor.id,
    } as Anchor);

    if (typeof anchorStore.applySyncedAnchor === 'function') {
      anchorStore.applySyncedAnchor(referenceId, normalizedAnchor);
    }

    logger.info('[BackendAnchorService] Promoted local anchor to backend anchor', {
      localReferenceId: referenceId,
      backendAnchorId: normalizedAnchor.id,
    });

    return getAnchorFromStore(useAnchorStore.getState(), normalizedAnchor.id) ?? normalizedAnchor;
  }
}

export default new BackendAnchorService();
