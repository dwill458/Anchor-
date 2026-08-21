import { create } from 'zustand';

import {
  encryptedPersistStorage,
  readSecureValue,
  writeSecureValue,
} from './encryptedPersistStorage';
import { hash32FNV1a } from '@/utils/hash';

export const CHART_JOURNEY_KEY_PREFIX = 'anchor:chart:journey:';
export const CHART_JOURNEY_MILESTONE_KEY_PREFIX = 'anchor:chart:journey-milestone:';
const JOURNEY_SCHEMA_VERSION = 1 as const;
const ANCHOR_HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;

export type ChartSetupWaypointDraft = {
  title: string;
  description: string;
};

export type ChartSetupDraft = {
  destinationText: string;
  currentReality: string;
  waypoints: ChartSetupWaypointDraft[];
  fromProposalId: string | null;
  seedAnchorId: string | null;
  updatedAt: string;
};

export type ChartAnchorCreationHandoff = {
  courseId: string;
  waypointId: string;
  /** Stable canonical Anchor POST intent, retained across restart/retry. */
  anchorCreateIdempotencyKey: string;
  anchorCreateIntentSignature: string | null;
  linkIdempotencyKey: string;
  originatingCourseVersion: number | null;
  observedAnchorLinkId: string | null;
  observedAnchorId: string | null;
  startedAt: string;
  anchorId: string | null;
  linkedCourseVersion: number | null;
};

type NewUserIntroStage = 'not_eligible' | 'awaiting_practice' | 'ready' | 'resolved';

type ChartJourneySnapshot = {
  schemaVersion: typeof JOURNEY_SCHEMA_VERSION;
  accountId: string;
  setupDraft: ChartSetupDraft | null;
  firstAnchorId: string | null;
  newUserIntroStage: NewUserIntroStage;
  existingUserIntroResolved: boolean;
  anchorCreationHandoff: ChartAnchorCreationHandoff | null;
};

type ChartJourneyMilestoneSnapshot = Pick<
  ChartJourneySnapshot,
  'schemaVersion' | 'accountId' | 'firstAnchorId' | 'newUserIntroStage' | 'existingUserIntroResolved'
>;

type ChartJourneyState = Omit<ChartJourneySnapshot, 'schemaVersion' | 'accountId'> & {
  accountId: string | null;
  hydrated: boolean;
  bindAccount: (accountId: string | null) => Promise<void>;
  clearAccount: (accountId?: string | null) => void;
  updateSetupDraft: (updates: Partial<Omit<ChartSetupDraft, 'updatedAt'>>) => void;
  replaceSetupDraft: (draft: Omit<ChartSetupDraft, 'updatedAt'>) => void;
  clearSetupDraft: () => void;
  markFirstAnchorCreated: (anchorId: string) => Promise<void>;
  markFirstPracticeCompleted: (anchorId: string) => Promise<void>;
  resolveNewUserIntro: () => Promise<void>;
  resolveExistingUserIntro: () => Promise<void>;
  beginAnchorCreation: (
    courseId: string,
    waypointId: string,
    courseVersion?: number,
    observedAnchorLinkId?: string | null,
    observedAnchorId?: string | null,
  ) => ChartAnchorCreationHandoff | null;
  claimAnchorCreateIntent: (serializedIntent: string) => Promise<ChartAnchorCreationHandoff | null>;
  markAnchorLinked: (anchorId: string, linkedCourseVersion: number) => void;
  clearAnchorCreation: () => void;
};

const emptyAccountState = {
  setupDraft: null,
  firstAnchorId: null,
  newUserIntroStage: 'not_eligible' as NewUserIntroStage,
  existingUserIntroResolved: false,
  anchorCreationHandoff: null,
};

const journeyKey = (accountId: string): string => `${CHART_JOURNEY_KEY_PREFIX}${accountId}`;
const milestoneKey = (accountId: string): string => `${CHART_JOURNEY_MILESTONE_KEY_PREFIX}${accountId}`;

function requestKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isFreshHandoff(value: ChartAnchorCreationHandoff | null): value is ChartAnchorCreationHandoff {
  if (!value) return false;
  const startedAt = new Date(value.startedAt).getTime();
  return Number.isFinite(startedAt) && Date.now() - startedAt <= ANCHOR_HANDOFF_TTL_MS;
}

function normalizeSnapshot(raw: string | null, accountId: string): ChartJourneySnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ChartJourneySnapshot>;
    if (value.schemaVersion !== JOURNEY_SCHEMA_VERSION || value.accountId !== accountId) return null;
    const setupDraft = value.setupDraft && typeof value.setupDraft.destinationText === 'string'
      ? {
          destinationText: value.setupDraft.destinationText.slice(0, 140),
          currentReality: typeof value.setupDraft.currentReality === 'string'
            ? value.setupDraft.currentReality.slice(0, 500)
            : '',
          waypoints: Array.isArray(value.setupDraft.waypoints)
            ? value.setupDraft.waypoints.slice(0, 7).map((waypoint) => ({
                title: typeof waypoint?.title === 'string' ? waypoint.title.slice(0, 60) : '',
                description: typeof waypoint?.description === 'string' ? waypoint.description.slice(0, 400) : '',
              }))
            : [],
          fromProposalId: typeof value.setupDraft.fromProposalId === 'string' ? value.setupDraft.fromProposalId : null,
          seedAnchorId: typeof value.setupDraft.seedAnchorId === 'string' ? value.setupDraft.seedAnchorId : null,
          updatedAt: typeof value.setupDraft.updatedAt === 'string' ? value.setupDraft.updatedAt : new Date().toISOString(),
        }
      : null;
    const introStage: NewUserIntroStage =
      value.newUserIntroStage === 'awaiting_practice' ||
      value.newUserIntroStage === 'ready' ||
      value.newUserIntroStage === 'resolved'
        ? value.newUserIntroStage
        : 'not_eligible';
    return {
      schemaVersion: JOURNEY_SCHEMA_VERSION,
      accountId,
      setupDraft,
      firstAnchorId: typeof value.firstAnchorId === 'string' ? value.firstAnchorId : null,
      newUserIntroStage: introStage,
      existingUserIntroResolved: value.existingUserIntroResolved === true || introStage !== 'not_eligible',
      anchorCreationHandoff: isFreshHandoff(value.anchorCreationHandoff ?? null)
        ? {
            ...value.anchorCreationHandoff!,
            anchorCreateIdempotencyKey:
              typeof value.anchorCreationHandoff?.anchorCreateIdempotencyKey === 'string'
                ? value.anchorCreationHandoff.anchorCreateIdempotencyKey
                : requestKey('chart-waypoint-anchor-create'),
            anchorCreateIntentSignature:
              typeof value.anchorCreationHandoff?.anchorCreateIntentSignature === 'string'
                ? value.anchorCreationHandoff.anchorCreateIntentSignature
                : null,
            originatingCourseVersion:
              typeof value.anchorCreationHandoff?.originatingCourseVersion === 'number'
                ? value.anchorCreationHandoff.originatingCourseVersion
                : null,
            observedAnchorLinkId:
              typeof value.anchorCreationHandoff?.observedAnchorLinkId === 'string'
                ? value.anchorCreationHandoff.observedAnchorLinkId
                : null,
            observedAnchorId:
              typeof value.anchorCreationHandoff?.observedAnchorId === 'string'
                ? value.anchorCreationHandoff.observedAnchorId
                : null,
          }
        : null,
    };
  } catch {
    return null;
  }
}

function normalizeMilestones(raw: string | null, accountId: string): ChartJourneyMilestoneSnapshot | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ChartJourneyMilestoneSnapshot>;
    if (value.schemaVersion !== JOURNEY_SCHEMA_VERSION || value.accountId !== accountId) return null;
    const stage: NewUserIntroStage =
      value.newUserIntroStage === 'awaiting_practice' ||
      value.newUserIntroStage === 'ready' ||
      value.newUserIntroStage === 'resolved'
        ? value.newUserIntroStage
        : 'not_eligible';
    return {
      schemaVersion: JOURNEY_SCHEMA_VERSION,
      accountId,
      firstAnchorId: typeof value.firstAnchorId === 'string' ? value.firstAnchorId : null,
      newUserIntroStage: stage,
      existingUserIntroResolved: value.existingUserIntroResolved === true || stage !== 'not_eligible',
    };
  } catch {
    return null;
  }
}

async function persistCurrent(get: () => ChartJourneyState): Promise<void> {
  const state = get();
  if (!state.accountId) return;
  const snapshot: ChartJourneySnapshot = {
    schemaVersion: JOURNEY_SCHEMA_VERSION,
    accountId: state.accountId,
    setupDraft: state.setupDraft,
    firstAnchorId: state.firstAnchorId,
    newUserIntroStage: state.newUserIntroStage,
    existingUserIntroResolved: state.existingUserIntroResolved,
    anchorCreationHandoff: isFreshHandoff(state.anchorCreationHandoff) ? state.anchorCreationHandoff : null,
  };
  await encryptedPersistStorage.setItem(journeyKey(state.accountId), JSON.stringify(snapshot));
}

async function persistMilestones(get: () => ChartJourneyState): Promise<void> {
  const state = get();
  if (!state.accountId) return;
  const snapshot: ChartJourneyMilestoneSnapshot = {
    schemaVersion: JOURNEY_SCHEMA_VERSION,
    accountId: state.accountId,
    firstAnchorId: state.firstAnchorId,
    newUserIntroStage: state.newUserIntroStage,
    existingUserIntroResolved: state.existingUserIntroResolved,
  };
  // Milestones are tiny, contain no user-authored text, and must survive an
  // immediate process exit or sign-out without waiting for the 400ms cache
  // debounce used by private Course projections.
  await writeSecureValue(milestoneKey(state.accountId), JSON.stringify(snapshot));
}

let hydrationGeneration = 0;

export const useChartJourneyStore = create<ChartJourneyState>((set, get) => ({
  accountId: null,
  hydrated: false,
  ...emptyAccountState,

  bindAccount: async (accountId) => {
    const generation = ++hydrationGeneration;
    if (!accountId) {
      set({ accountId: null, hydrated: true, ...emptyAccountState });
      return;
    }
    if (get().accountId === accountId && get().hydrated) return;
    // Clear synchronously before an asynchronous secure read so one account's
    // private setup or handoff can never flash for the next account.
    set({ accountId, hydrated: false, ...emptyAccountState });
    const [rawSnapshot, rawMilestones] = await Promise.all([
      encryptedPersistStorage.getItem(journeyKey(accountId)),
      readSecureValue(milestoneKey(accountId)).catch(() => null),
    ]);
    const snapshot = normalizeSnapshot(rawSnapshot, accountId);
    const milestones = normalizeMilestones(rawMilestones, accountId);
    if (generation !== hydrationGeneration || get().accountId !== accountId) return;
    set({
      ...(snapshot ?? emptyAccountState),
      ...(milestones ? {
        firstAnchorId: milestones.firstAnchorId,
        newUserIntroStage: milestones.newUserIntroStage,
        existingUserIntroResolved: milestones.existingUserIntroResolved,
      } : {}),
      accountId,
      hydrated: true,
    });
  },

  clearAccount: (accountId) => {
    const target = accountId ?? get().accountId;
    hydrationGeneration += 1;
    if (!accountId || get().accountId === accountId) {
      set({ accountId: null, hydrated: true, ...emptyAccountState });
    }
    if (target) {
      void Promise.resolve(encryptedPersistStorage.removeItem(journeyKey(target)))
        .catch(() => { /* best-effort private cache purge */ });
    }
  },

  updateSetupDraft: (updates) => {
    if (!get().accountId) return;
    const current = get().setupDraft ?? {
      destinationText: '',
      currentReality: '',
      waypoints: [],
      fromProposalId: null,
      seedAnchorId: null,
      updatedAt: new Date().toISOString(),
    };
    set({ setupDraft: { ...current, ...updates, updatedAt: new Date().toISOString() } });
    void persistCurrent(get).catch(() => { /* journey remains available in memory */ });
  },

  replaceSetupDraft: (draft) => {
    if (!get().accountId) return;
    set({ setupDraft: { ...draft, updatedAt: new Date().toISOString() } });
    void persistCurrent(get).catch(() => { /* journey remains available in memory */ });
  },

  clearSetupDraft: () => {
    set({ setupDraft: null });
    void persistCurrent(get).catch(() => { /* journey remains available in memory */ });
  },

  markFirstAnchorCreated: async (anchorId) => {
    if (!get().accountId || !anchorId) return;
    set({
      firstAnchorId: anchorId,
      newUserIntroStage: 'awaiting_practice',
      // New users must never replay the separate existing-user introduction.
      existingUserIntroResolved: true,
    });
    void persistCurrent(get).catch(() => { /* journey remains available in memory */ });
    // The canonical Anchor has already been committed by the time this
    // projection runs. A transient SecureStore failure must not strand that
    // creation flow; the in-memory milestone remains valid and a later journey
    // mutation can persist it again.
    await persistMilestones(get).catch(() => { /* best-effort milestone durability */ });
  },

  markFirstPracticeCompleted: async (anchorId) => {
    const state = get();
    if (!state.accountId || state.firstAnchorId !== anchorId || state.newUserIntroStage !== 'awaiting_practice') return;
    set({ newUserIntroStage: 'ready' });
    void persistCurrent(get).catch(() => { /* journey remains available in memory */ });
    await persistMilestones(get).catch(() => { /* best-effort milestone durability */ });
  },

  resolveNewUserIntro: async () => {
    if (get().newUserIntroStage === 'not_eligible') return;
    set({ newUserIntroStage: 'resolved', existingUserIntroResolved: true });
    void persistCurrent(get).catch(() => { /* journey remains available in memory */ });
    await persistMilestones(get).catch(() => { /* best-effort milestone durability */ });
  },

  resolveExistingUserIntro: async () => {
    set({ existingUserIntroResolved: true });
    void persistCurrent(get).catch(() => { /* journey remains available in memory */ });
    await persistMilestones(get).catch(() => { /* best-effort milestone durability */ });
  },

  beginAnchorCreation: (
    courseId,
    waypointId,
    courseVersion = 0,
    observedAnchorLinkId = null,
    observedAnchorId = null,
  ) => {
    if (!get().accountId || !courseId || !waypointId) return null;
    const existing = get().anchorCreationHandoff;
    if (
      isFreshHandoff(existing) &&
      existing.courseId === courseId &&
      existing.waypointId === waypointId &&
      existing.observedAnchorLinkId === observedAnchorLinkId &&
      existing.observedAnchorId === observedAnchorId
    ) {
      return existing;
    }
    const handoff: ChartAnchorCreationHandoff = {
      courseId,
      waypointId,
      anchorCreateIdempotencyKey: requestKey('chart-waypoint-anchor-create'),
      anchorCreateIntentSignature: null,
      linkIdempotencyKey: requestKey('chart-waypoint-anchor-link'),
      originatingCourseVersion: Number.isFinite(courseVersion) ? courseVersion : null,
      observedAnchorLinkId,
      observedAnchorId,
      startedAt: new Date().toISOString(),
      anchorId: null,
      linkedCourseVersion: null,
    };
    set({ anchorCreationHandoff: handoff });
    void persistCurrent(get).catch(() => { /* journey remains available in memory */ });
    return handoff;
  },

  claimAnchorCreateIntent: async (serializedIntent) => {
    const current = get().anchorCreationHandoff;
    if (!current || !isFreshHandoff(current)) return null;
    const signature = `${serializedIntent.length}:${hash32FNV1a(serializedIntent)}:${hash32FNV1a(`chart:${serializedIntent}`)}`;
    const next = current.anchorCreateIntentSignature && current.anchorCreateIntentSignature !== signature
      ? {
          ...current,
          anchorCreateIdempotencyKey: requestKey('chart-waypoint-anchor-create'),
          anchorCreateIntentSignature: signature,
          linkIdempotencyKey: requestKey('chart-waypoint-anchor-link'),
          anchorId: null,
          linkedCourseVersion: null,
          startedAt: new Date().toISOString(),
        }
      : { ...current, anchorCreateIntentSignature: signature };
    set({ anchorCreationHandoff: next });
    // This write is awaited before the canonical Anchor POST. A committed
    // request can therefore reuse its key only for the exact same payload.
    await persistCurrent(get);
    return next;
  },

  markAnchorLinked: (anchorId, linkedCourseVersion) => {
    const handoff = get().anchorCreationHandoff;
    if (!handoff || !isFreshHandoff(handoff)) return;
    set({ anchorCreationHandoff: { ...handoff, anchorId, linkedCourseVersion } });
    void persistCurrent(get).catch(() => { /* journey remains available in memory */ });
  },

  clearAnchorCreation: () => {
    set({ anchorCreationHandoff: null });
    void persistCurrent(get).catch(() => { /* journey remains available in memory */ });
  },
}));

export function getFreshChartAnchorHandoff(accountId: string): ChartAnchorCreationHandoff | null {
  const state = useChartJourneyStore.getState();
  if (state.accountId !== accountId || !isFreshHandoff(state.anchorCreationHandoff)) return null;
  return state.anchorCreationHandoff;
}

export async function purgeChartJourneyForAccount(accountId: string): Promise<void> {
  useChartJourneyStore.getState().clearAccount(accountId);
  await encryptedPersistStorage.removeItem(journeyKey(accountId));
}
