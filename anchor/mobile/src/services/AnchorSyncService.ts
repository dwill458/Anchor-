import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/config';
import { readSecureValue, writeSecureValue } from '@/stores/encryptedPersistStorage';
import type { Anchor, AnchorCategory, EnhancementMetadata, ReinforcementMetadata } from '@/types';
import { logger } from '@/utils/logger';

const RETRY_QUEUE_KEY = 'anchor-sync-retry-queue';

interface AnchorRetryQueueItem {
  userId: string;
  anchor: Anchor;
}

interface SupabaseAnchorRecord {
  id?: string;
  user_id: string;
  local_id: string;
  intention: string;
  category?: AnchorCategory;
  distilled_letters: string[];
  svg_data: string;
  base_sigil_svg?: string;
  reinforced_sigil_svg?: string | null;
  enhanced_image_url?: string | null;
  style_variant: string;
  structure_variant?: string;
  mantra_text?: string | null;
  mantra_pronunciation?: string | null;
  mantra_audio_url?: string | null;
  is_charged: boolean;
  charge_count?: number | null;
  charged_at?: string | null;
  first_charged_at?: string | null;
  ignited_at?: string | null;
  activation_count: number;
  last_activated_at?: string | null;
  is_released?: boolean | null;
  released_at?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
  reinforcement_metadata?: ReinforcementMetadata | null;
  enhancement_metadata?: EnhancementMetadata | null;
}

const DEFAULT_STRUCTURE_VARIANT = 'balanced';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeDate(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
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

function getLocalReferenceId(anchor: Anchor): string {
  return anchor.localId ?? anchor.id;
}

function toIsoString(value?: Date): string | null {
  return value ? value.toISOString() : null;
}

function isConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

function buildHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Prefer: 'resolution=merge-duplicates,return=representation',
  };
}

function toSupabaseRecord(anchor: Anchor, userId: string): SupabaseAnchorRecord {
  const normalized = normalizeAnchor(anchor);
  const localId = getLocalReferenceId(normalized);
  const remoteId = UUID_PATTERN.test(normalized.id) ? normalized.id : undefined;

  return {
    ...(remoteId ? { id: remoteId } : {}),
    user_id: userId,
    local_id: localId,
    intention: normalized.intentionText,
    category: normalized.category,
    distilled_letters: normalized.distilledLetters,
    svg_data: normalized.reinforcedSigilSvg ?? normalized.baseSigilSvg,
    base_sigil_svg: normalized.baseSigilSvg,
    reinforced_sigil_svg: normalized.reinforcedSigilSvg ?? null,
    enhanced_image_url: normalized.enhancedImageUrl ?? null,
    style_variant: String(normalized.enhancementMetadata?.styleApplied ?? normalized.structureVariant),
    structure_variant: normalized.structureVariant,
    mantra_text: normalized.mantraText ?? null,
    mantra_pronunciation: normalized.mantraPronunciation ?? null,
    mantra_audio_url: normalized.mantraAudioUrl ?? null,
    is_charged: normalized.isCharged,
    charge_count: normalized.chargeCount ?? null,
    charged_at: toIsoString(normalized.chargedAt),
    first_charged_at: toIsoString(normalized.firstChargedAt),
    ignited_at: toIsoString(normalized.ignitedAt),
    activation_count: normalized.activationCount,
    last_activated_at: toIsoString(normalized.lastActivatedAt),
    is_released: normalized.isReleased ?? false,
    released_at: toIsoString(normalized.releasedAt),
    archived_at: toIsoString(normalized.archivedAt),
    created_at: normalized.createdAt.toISOString(),
    updated_at: normalized.updatedAt.toISOString(),
    reinforcement_metadata: normalized.reinforcementMetadata ?? null,
    enhancement_metadata: normalized.enhancementMetadata ?? null,
  };
}

function fromSupabaseRecord(record: SupabaseAnchorRecord, fallback?: Anchor): Anchor {
  return normalizeAnchor({
    id: record.id ?? fallback?.id ?? record.local_id,
    localId: record.local_id || fallback?.localId || fallback?.id,
    userId: record.user_id,
    intentionText: record.intention,
    category: record.category ?? fallback?.category ?? 'custom',
    distilledLetters: record.distilled_letters ?? fallback?.distilledLetters ?? [],
    baseSigilSvg: record.base_sigil_svg ?? fallback?.baseSigilSvg ?? record.svg_data,
    reinforcedSigilSvg: record.reinforced_sigil_svg ?? fallback?.reinforcedSigilSvg,
    enhancedImageUrl: record.enhanced_image_url ?? fallback?.enhancedImageUrl,
    structureVariant:
      (record.structure_variant as Anchor['structureVariant'] | undefined) ??
      fallback?.structureVariant ??
      DEFAULT_STRUCTURE_VARIANT,
    reinforcementMetadata: record.reinforcement_metadata ?? fallback?.reinforcementMetadata,
    enhancementMetadata: record.enhancement_metadata ?? fallback?.enhancementMetadata,
    mantraText: record.mantra_text ?? fallback?.mantraText,
    mantraPronunciation: record.mantra_pronunciation ?? fallback?.mantraPronunciation,
    mantraAudioUrl: record.mantra_audio_url ?? fallback?.mantraAudioUrl,
    isCharged: record.is_charged,
    chargeCount: record.charge_count ?? fallback?.chargeCount,
    chargedAt: normalizeDate(record.charged_at) ?? fallback?.chargedAt,
    firstChargedAt: normalizeDate(record.first_charged_at) ?? fallback?.firstChargedAt,
    ignitedAt: normalizeDate(record.ignited_at) ?? fallback?.ignitedAt,
    activationCount: record.activation_count,
    lastActivatedAt: normalizeDate(record.last_activated_at) ?? fallback?.lastActivatedAt,
    isReleased: record.is_released ?? fallback?.isReleased,
    releasedAt: normalizeDate(record.released_at) ?? fallback?.releasedAt,
    archivedAt: normalizeDate(record.archived_at) ?? fallback?.archivedAt,
    createdAt: normalizeDate(record.created_at) ?? fallback?.createdAt ?? new Date(),
    updatedAt: normalizeDate(record.updated_at) ?? fallback?.updatedAt ?? new Date(),
  });
}

async function readQueue(): Promise<AnchorRetryQueueItem[]> {
  // Retry queue contains full anchor objects (intention text, sigil data) —
  // store in SecureStore so it is encrypted at rest.
  let raw = await readSecureValue(RETRY_QUEUE_KEY);

  if (!raw) {
    // Older app versions stored the queue in plain AsyncStorage. Migrate it
    // to SecureStore on first read so pending retries are not silently lost.
    try {
      const legacyRaw = await AsyncStorage.getItem(RETRY_QUEUE_KEY);
      if (legacyRaw) {
        await writeSecureValue(RETRY_QUEUE_KEY, legacyRaw);
        await AsyncStorage.removeItem(RETRY_QUEUE_KEY);
        raw = legacyRaw;
      }
    } catch (error) {
      logger.warn('[AnchorSyncService] Failed to migrate legacy retry queue from AsyncStorage', error);
    }
  }

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as AnchorRetryQueueItem[];
    return Array.isArray(parsed) ? parsed.map((item) => ({
      userId: item.userId,
      anchor: normalizeAnchor(item.anchor),
    })) : [];
  } catch (error) {
    logger.warn('[AnchorSyncService] Failed to parse retry queue', error);
    return [];
  }
}

async function writeQueue(items: AnchorRetryQueueItem[]): Promise<void> {
  await writeSecureValue(RETRY_QUEUE_KEY, JSON.stringify(items));
}

class AnchorSyncService {
  isConfigured(): boolean {
    return isConfigured();
  }

  async upsertAnchor(anchor: Anchor, userId: string): Promise<Anchor> {
    if (!isConfigured()) {
      throw new Error('Supabase sync is not configured.');
    }

    const normalizedAnchor = normalizeAnchor(anchor);
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/anchors?on_conflict=user_id,local_id&select=*`,
      {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify([toSupabaseRecord(normalizedAnchor, userId)]),
      }
    );

    if (!response.ok) {
      const failureBody = await response.text();
      throw new Error(failureBody || 'Failed to upsert anchor to Supabase.');
    }

    const payload = (await response.json()) as SupabaseAnchorRecord[];
    const record = payload[0];

    if (!record) {
      throw new Error('Supabase did not return the synced anchor.');
    }

    return fromSupabaseRecord(record, normalizedAnchor);
  }

  async migrateAnchors(anchors: Anchor[], userId: string): Promise<Anchor[]> {
    const migrated: Anchor[] = [];

    for (const anchor of anchors) {
      try {
        const syncedAnchor = await this.upsertAnchor(anchor, userId);
        migrated.push(syncedAnchor);
      } catch (error) {
        await this.enqueueRetry(anchor, userId);
        logger.warn('[AnchorSyncService] Failed to migrate anchor, queued for retry', error);
        migrated.push(normalizeAnchor(anchor));
      }
    }

    return migrated;
  }

  async enqueueRetry(anchor: Anchor, userId: string): Promise<void> {
    const queue = await readQueue();
    const localReferenceId = getLocalReferenceId(anchor);
    const deduped = queue.filter(
      (item) => !(item.userId === userId && getLocalReferenceId(item.anchor) === localReferenceId)
    );

    deduped.push({
      userId,
      anchor: normalizeAnchor(anchor),
    });

    await writeQueue(deduped);
  }

  async flushRetryQueue(userId: string): Promise<Anchor[]> {
    const queue = await readQueue();
    if (queue.length === 0) {
      return [];
    }

    const remaining: AnchorRetryQueueItem[] = [];
    const flushedAnchors: Anchor[] = [];

    for (const item of queue) {
      if (item.userId !== userId) {
        remaining.push(item);
        continue;
      }

      try {
        const syncedAnchor = await this.upsertAnchor(item.anchor, userId);
        flushedAnchors.push(syncedAnchor);
      } catch (error) {
        remaining.push(item);
        logger.warn('[AnchorSyncService] Failed to flush retry queue item', error);
      }
    }

    await writeQueue(remaining);
    return flushedAnchors;
  }
}

export default new AnchorSyncService();
