import { create } from 'zustand';
import { encryptedPersistStorage } from './encryptedPersistStorage';
import { chartApiClient, getChartErrorCode, getConflictCourse, isChartAbortError } from '@/services/ChartApiClient';
import type {
  ChartErrorCode,
  ChartFeatureFlags,
  CourseDetail,
  CourseSummary,
  CreateCourseRequest,
  EditWaypointRequest,
  LinkAnchorRequest,
  ReorderWaypointsRequest,
} from '@/types/chart';
import {
  CHART_CACHE_KEY_PREFIX,
  CHART_LOG_CACHE_KEY_PREFIX,
  CHART_REFLECTION_DRAFTS_KEY_PREFIX,
  CHART_STALE_AFTER_MS,
  DEFAULT_CHART_FEATURE_FLAGS,
  resolveChartFeatureFlags,
} from '@/types/chart';
import { logger } from '@/utils/logger';

type CourseCacheSnapshot = {
  schemaVersion: 1;
  accountId: string;
  courses: CourseSummary[];
  activeCourse: CourseDetail | null;
  lastSyncedAt: number | null;
  flags: ChartFeatureFlags;
};

type CourseStoreState = {
  accountId: string | null;
  initializationStatus: 'idle' | 'hydrating' | 'ready' | 'migrationRequired';
  courses: CourseSummary[];
  activeCourse: CourseDetail | null;
  flags: ChartFeatureFlags;
  loading: boolean;
  refreshing: boolean;
  errorCode: ChartErrorCode | string | null;
  migrationRequired: boolean;
  readOnly: boolean;
  offline: boolean;
  stale: boolean;
  lastSyncedAt: number | null;
  bindAccount: (accountId: string | null) => void;
  setFeatureFlags: (serverFlags?: Partial<ChartFeatureFlags> | null) => void;
  hydrateAndRefresh: (accountId: string) => Promise<void>;
  refresh: (accountId?: string) => Promise<void>;
  fetchCourseDetail: (courseId: string) => Promise<CourseDetail | null>;
  createManualCourse: (request: CreateCourseRequest) => Promise<CourseDetail | null>;
  updateCourse: (
    courseId: string,
    request: { expectedCourseVersion: number; destinationText?: string },
  ) => Promise<CourseDetail | null>;
  publishCourse: (courseId: string, expectedCourseVersion: number) => Promise<CourseDetail | null>;
  archiveCourse: (courseId: string, expectedCourseVersion: number) => Promise<CourseDetail | null>;
  restoreCourse: (courseId: string, expectedCourseVersion: number) => Promise<CourseDetail | null>;
  deleteCourse: (courseId: string, expectedCourseVersion: number) => Promise<boolean>;
  addWaypoint: (
    courseId: string,
    request: {
      idempotencyKey: string;
      expectedCourseVersion: number;
      title: string;
      description?: string;
      afterWaypointId?: string | null;
    },
  ) => Promise<CourseDetail | null>;
  editWaypoint: (
    courseId: string,
    waypointId: string,
    request: EditWaypointRequest,
  ) => Promise<CourseDetail | null>;
  reorderWaypoints: (
    courseId: string,
    request: ReorderWaypointsRequest,
  ) => Promise<CourseDetail | null>;
  linkAnchor: (courseId: string, request: LinkAnchorRequest) => Promise<CourseDetail | null>;
  unlinkAnchor: (
    courseId: string,
    linkId: string,
    expectedCourseVersion: number,
  ) => Promise<CourseDetail | null>;
  clearAccount: (accountId?: string | null) => void;
};

let activeController: AbortController | null = null;
let refreshPromise: Promise<void> | null = null;

export const courseCacheKey = (accountId: string): string => `${CHART_CACHE_KEY_PREFIX}${accountId}`;
export const chartLogCacheKey = (accountId: string, courseId: string): string =>
  `${CHART_LOG_CACHE_KEY_PREFIX}${accountId}:${courseId}`;
export const chartReflectionDraftsKey = (accountId: string): string =>
  `${CHART_REFLECTION_DRAFTS_KEY_PREFIX}${accountId}`;

function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('failed to connect') ||
    message.includes('econnrefused')
  );
}

function isCached(state: Pick<CourseStoreState, 'courses' | 'activeCourse'>): boolean {
  return state.courses.length > 0 || state.activeCourse !== null;
}

function normalizeSnapshot(value: unknown, accountId: string): CourseCacheSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const snapshot = value as Partial<CourseCacheSnapshot>;
  if (snapshot.accountId !== accountId || snapshot.schemaVersion !== 1) return null;
  if (!Array.isArray(snapshot.courses)) return null;
  return {
    schemaVersion: 1,
    accountId,
    courses: snapshot.courses,
    activeCourse: snapshot.activeCourse ?? null,
    lastSyncedAt: typeof snapshot.lastSyncedAt === 'number' ? snapshot.lastSyncedAt : null,
    flags: resolveChartFeatureFlags(snapshot.flags, true),
  };
}

async function readCache(accountId: string): Promise<CourseCacheSnapshot | null> {
  try {
    const raw = await encryptedPersistStorage.getItem(courseCacheKey(accountId));
    return raw ? normalizeSnapshot(JSON.parse(raw), accountId) : null;
  } catch (error) {
    logger.warn('[courseStore] Failed to hydrate Chart cache', error);
    return null;
  }
}

async function writeCache(snapshot: CourseCacheSnapshot): Promise<void> {
  try {
    await encryptedPersistStorage.setItem(courseCacheKey(snapshot.accountId), JSON.stringify(snapshot));
  } catch (error) {
    logger.warn('[courseStore] Failed to persist Chart cache', error);
  }
}

async function purgeCourseCache(accountId: string): Promise<void> {
  await Promise.all([
    encryptedPersistStorage.removeItem(courseCacheKey(accountId)),
    encryptedPersistStorage.removeItem(chartReflectionDraftsKey(accountId)),
  ]);
}

function updateReadOnly(state: CourseStoreState): boolean {
  return (
    !state.flags.chart_write_enabled ||
    state.offline ||
    state.migrationRequired ||
    state.activeCourse?.needsRepair === true
  );
}

function setAuthoritativeCourse(
  set: (updater: Partial<CourseStoreState> | ((state: CourseStoreState) => Partial<CourseStoreState>)) => void,
  accountId: string,
  course: CourseDetail,
): void {
  set((state) => {
    if (state.accountId !== accountId) return {};
    const courses = state.courses.some((item) => item.id === course.id)
      ? state.courses.map((item) => (item.id === course.id ? course : item))
      : [...state.courses, course];
    return {
      courses,
      // The detail slot is also used by editor/sheet routes for DRAFT and
      // historical Courses; server state remains the authority for status.
      activeCourse: course,
      lastSyncedAt: Date.now(),
      stale: false,
      offline: false,
      errorCode: null,
    };
  });
}

async function persistCurrentState(get: () => CourseStoreState): Promise<void> {
  const state = get();
  if (!state.accountId) return;
  await writeCache({
    schemaVersion: 1,
    accountId: state.accountId,
    courses: state.courses,
    activeCourse: state.activeCourse,
    lastSyncedAt: state.lastSyncedAt,
    flags: state.flags,
  });
}

function mutationUnavailable(get: () => CourseStoreState): ChartErrorCode | null {
  const state = get();
  if (!state.flags.chart_write_enabled) return 'FEATURE_DISABLED';
  if (state.offline) return 'OFFLINE';
  if (state.migrationRequired) return 'MIGRATION_REQUIRED';
  if (state.activeCourse?.needsRepair) return 'VALIDATION_ERROR';
  return null;
}

export const useCourseStore = create<CourseStoreState>((set, get) => ({
  accountId: null,
  initializationStatus: 'idle',
  courses: [],
  activeCourse: null,
  flags: DEFAULT_CHART_FEATURE_FLAGS,
  loading: false,
  refreshing: false,
  errorCode: null,
  migrationRequired: false,
  readOnly: true,
  offline: false,
  stale: false,
  lastSyncedAt: null,

  bindAccount: (accountId) => {
    if (get().accountId === accountId) return;
    activeController?.abort();
    activeController = null;
    refreshPromise = null;
    set({
      accountId,
      initializationStatus: accountId ? 'hydrating' : 'idle',
      courses: [],
      activeCourse: null,
      loading: false,
      refreshing: false,
      errorCode: null,
      migrationRequired: false,
      readOnly: true,
      offline: false,
      stale: false,
      lastSyncedAt: null,
    });
  },

  setFeatureFlags: (serverFlags) => {
    set((state) => {
      const flags = resolveChartFeatureFlags(serverFlags);
      return { flags, readOnly: updateReadOnly({ ...state, flags }) };
    });
  },

  hydrateAndRefresh: async (accountId) => {
    if (get().accountId !== accountId) get().bindAccount(accountId);
    const snapshot = await readCache(accountId);
    if (get().accountId !== accountId) return;
    if (snapshot) {
      set((state) => {
        const lastSyncedAt = snapshot.lastSyncedAt;
        return {
          courses: snapshot.courses,
          activeCourse: snapshot.activeCourse,
          lastSyncedAt,
          stale: !lastSyncedAt || Date.now() - lastSyncedAt > CHART_STALE_AFTER_MS,
          flags: state.flags.chart_enabled ? state.flags : snapshot.flags,
          initializationStatus: 'ready',
          readOnly: updateReadOnly({ ...state, activeCourse: snapshot.activeCourse }),
        };
      });
    }
    await get().refresh(accountId);
  },

  refresh: async (requestedAccountId) => {
    const accountId = requestedAccountId ?? get().accountId;
    if (!accountId || !get().flags.chart_enabled) return;
    if (refreshPromise) return refreshPromise;

    const controller = new AbortController();
    activeController?.abort();
    activeController = controller;
    set({ loading: !isCached(get()), refreshing: true });

    refreshPromise = (async () => {
      try {
        const initialized = await chartApiClient.initialize(controller.signal);
        if (get().accountId !== accountId || controller.signal.aborted) return;
        if (initialized.data.chartSchemaVersion !== 1) {
          set({
            initializationStatus: 'migrationRequired',
            migrationRequired: true,
            loading: false,
            refreshing: false,
            readOnly: true,
            errorCode: 'MIGRATION_REQUIRED',
          });
          return;
        }

        const listed = await chartApiClient.listCourses(undefined, controller.signal);
        if (get().accountId !== accountId || controller.signal.aborted) return;
        if (listed.migrationRequired) {
          set({
            initializationStatus: 'migrationRequired',
            migrationRequired: true,
            loading: false,
            refreshing: false,
            readOnly: true,
            errorCode: 'MIGRATION_REQUIRED',
          });
          return;
        }

        const courses = listed.data ?? [];
        set({
          courses,
          initializationStatus: 'ready',
          migrationRequired: false,
          errorCode: null,
          loading: false,
          offline: false,
          stale: false,
          lastSyncedAt: Date.now(),
        });

        const activeSummary = courses.find((course) => course.status === 'ACTIVE');
        if (activeSummary) {
          const detail = await chartApiClient.getCourse(activeSummary.id, controller.signal);
          if (get().accountId !== accountId || controller.signal.aborted) return;
          setAuthoritativeCourse(set, accountId, detail.data);
        } else {
          set({ activeCourse: null });
        }
        await persistCurrentState(get);
      } catch (error) {
        if (isChartAbortError(error) || controller.signal.aborted || get().accountId !== accountId) return;
        const code = getChartErrorCode(error);
        const offline = isNetworkError(error);
        set((state) => {
          const nextError = code === 'FEATURE_DISABLED' ? 'FEATURE_DISABLED' : offline ? 'NETWORK' : code ?? 'NETWORK';
          const nextMigration = code === 'MIGRATION_REQUIRED';
          const flags = code === 'FEATURE_DISABLED'
            ? { ...state.flags, chart_enabled: false, chart_write_enabled: false }
            : state.flags;
          return {
            loading: false,
            refreshing: false,
            offline,
            stale: isCached(state) || state.stale,
            migrationRequired: nextMigration,
            initializationStatus: nextMigration ? 'migrationRequired' : state.initializationStatus,
            flags,
            readOnly: updateReadOnly({ ...state, flags, offline, migrationRequired: nextMigration }),
            errorCode: nextError,
          };
        });
      } finally {
        if (get().accountId === accountId) {
          set({ loading: false, refreshing: false });
        }
        refreshPromise = null;
      }
    })();
    return refreshPromise;
  },

  fetchCourseDetail: async (courseId) => {
    const accountId = get().accountId;
    if (!accountId || !get().flags.chart_enabled) return null;
    const controller = new AbortController();
    activeController?.abort();
    activeController = controller;
    try {
      const result = await chartApiClient.getCourse(courseId, controller.signal);
      if (get().accountId !== accountId || controller.signal.aborted) return null;
      setAuthoritativeCourse(set, accountId, result.data);
      await persistCurrentState(get);
      return result.data;
    } catch (error) {
      if (isChartAbortError(error)) return null;
      const code = getChartErrorCode(error) ?? 'NETWORK';
      if (code === 'COURSE_NOT_FOUND') {
        set((state) => ({ courses: state.courses.filter((course) => course.id !== courseId), errorCode: code }));
      } else {
        set({ errorCode: code });
      }
      return null;
    }
  },

  createManualCourse: async (request) => {
    const unavailable = mutationUnavailable(get);
    if (unavailable) {
      set({ errorCode: unavailable });
      return null;
    }
    const accountId = get().accountId;
    if (!accountId) return null;
    try {
      const result = await chartApiClient.createCourse(request);
      if (get().accountId !== accountId) return null;
      setAuthoritativeCourse(set, accountId, result.data);
      await persistCurrentState(get);
      return result.data;
    } catch (error) {
      const conflict = getConflictCourse(error);
      if (conflict) setAuthoritativeCourse(set, accountId, conflict);
      set({ errorCode: getChartErrorCode(error) ?? 'NETWORK' });
      return null;
    }
  },

  updateCourse: async (courseId, request) => {
    const unavailable = mutationUnavailable(get);
    if (unavailable) {
      set({ errorCode: unavailable });
      return null;
    }
    const accountId = get().accountId;
    if (!accountId) return null;
    try {
      const result = await chartApiClient.updateCourse(courseId, request);
      if (get().accountId !== accountId) return null;
      setAuthoritativeCourse(set, accountId, result.data);
      await persistCurrentState(get);
      return result.data;
    } catch (error) {
      const conflict = getConflictCourse(error);
      if (conflict) setAuthoritativeCourse(set, accountId, conflict);
      set({ errorCode: getChartErrorCode(error) ?? 'NETWORK' });
      return null;
    }
  },

  publishCourse: async (courseId, expectedCourseVersion) => {
    const unavailable = mutationUnavailable(get);
    if (unavailable) {
      set({ errorCode: unavailable });
      return null;
    }
    const accountId = get().accountId;
    if (!accountId) return null;
    try {
      const result = await chartApiClient.publishCourse(courseId, expectedCourseVersion);
      if (get().accountId !== accountId) return null;
      setAuthoritativeCourse(set, accountId, result.data);
      await persistCurrentState(get);
      return result.data;
    } catch (error) {
      const conflict = getConflictCourse(error);
      if (conflict) setAuthoritativeCourse(set, accountId, conflict);
      set({ errorCode: getChartErrorCode(error) ?? 'NETWORK' });
      return null;
    }
  },

  archiveCourse: async (courseId, expectedCourseVersion) => {
    const unavailable = mutationUnavailable(get);
    if (unavailable) {
      set({ errorCode: unavailable });
      return null;
    }
    const accountId = get().accountId;
    if (!accountId) return null;
    try {
      const result = await chartApiClient.archiveCourse(courseId, expectedCourseVersion);
      if (get().accountId !== accountId) return null;
      setAuthoritativeCourse(set, accountId, result.data);
      await persistCurrentState(get);
      return result.data;
    } catch (error) {
      const conflict = getConflictCourse(error);
      if (conflict) setAuthoritativeCourse(set, accountId, conflict);
      set({ errorCode: getChartErrorCode(error) ?? 'NETWORK' });
      return null;
    }
  },

  restoreCourse: async (courseId, expectedCourseVersion) => {
    const unavailable = mutationUnavailable(get);
    if (unavailable) {
      set({ errorCode: unavailable });
      return null;
    }
    const accountId = get().accountId;
    if (!accountId) return null;
    try {
      const result = await chartApiClient.restoreCourse(courseId, expectedCourseVersion);
      if (get().accountId !== accountId) return null;
      setAuthoritativeCourse(set, accountId, result.data);
      await persistCurrentState(get);
      return result.data;
    } catch (error) {
      const conflict = getConflictCourse(error);
      if (conflict) setAuthoritativeCourse(set, accountId, conflict);
      set({ errorCode: getChartErrorCode(error) ?? 'NETWORK' });
      return null;
    }
  },

  deleteCourse: async (courseId, expectedCourseVersion) => {
    const unavailable = mutationUnavailable(get);
    if (unavailable) {
      set({ errorCode: unavailable });
      return false;
    }
    const accountId = get().accountId;
    if (!accountId) return false;
    try {
      await chartApiClient.softDeleteCourse(courseId, expectedCourseVersion);
      if (get().accountId !== accountId) return false;
      set((state) => ({
        courses: state.courses.filter((course) => course.id !== courseId),
        activeCourse: state.activeCourse?.id === courseId ? null : state.activeCourse,
        errorCode: null,
      }));
      await persistCurrentState(get);
      return true;
    } catch (error) {
      const conflict = getConflictCourse(error);
      if (conflict) setAuthoritativeCourse(set, accountId, conflict);
      set({ errorCode: getChartErrorCode(error) ?? 'NETWORK' });
      return false;
    }
  },

  addWaypoint: async (courseId, request) => {
    const unavailable = mutationUnavailable(get);
    if (unavailable) {
      set({ errorCode: unavailable });
      return null;
    }
    const accountId = get().accountId;
    if (!accountId) return null;
    try {
      const result = await chartApiClient.addWaypoint(courseId, request);
      if (get().accountId !== accountId) return null;
      setAuthoritativeCourse(set, accountId, result.data);
      await persistCurrentState(get);
      return result.data;
    } catch (error) {
      const conflict = getConflictCourse(error);
      if (conflict) setAuthoritativeCourse(set, accountId, conflict);
      set({ errorCode: getChartErrorCode(error) ?? 'NETWORK' });
      return null;
    }
  },

  editWaypoint: async (courseId, waypointId, request) => {
    const unavailable = mutationUnavailable(get);
    if (unavailable) {
      set({ errorCode: unavailable });
      return null;
    }
    const accountId = get().accountId;
    if (!accountId) return null;
    try {
      const result = await chartApiClient.editWaypoint(courseId, waypointId, request);
      if (get().accountId !== accountId) return null;
      setAuthoritativeCourse(set, accountId, result.data);
      await persistCurrentState(get);
      return result.data;
    } catch (error) {
      const conflict = getConflictCourse(error);
      if (conflict) setAuthoritativeCourse(set, accountId, conflict);
      set({ errorCode: getChartErrorCode(error) ?? 'NETWORK' });
      return null;
    }
  },

  reorderWaypoints: async (courseId, request) => {
    const unavailable = mutationUnavailable(get);
    if (unavailable) {
      set({ errorCode: unavailable });
      return null;
    }
    const accountId = get().accountId;
    if (!accountId) return null;
    try {
      const result = await chartApiClient.reorderWaypoints(courseId, request);
      if (get().accountId !== accountId) return null;
      setAuthoritativeCourse(set, accountId, result.data);
      await persistCurrentState(get);
      return result.data;
    } catch (error) {
      const conflict = getConflictCourse(error);
      if (conflict) setAuthoritativeCourse(set, accountId, conflict);
      set({ errorCode: getChartErrorCode(error) ?? 'NETWORK' });
      return null;
    }
  },

  linkAnchor: async (courseId, request) => {
    const unavailable = mutationUnavailable(get);
    if (unavailable) {
      set({ errorCode: unavailable });
      return null;
    }
    const accountId = get().accountId;
    if (!accountId) return null;
    try {
      const result = await chartApiClient.linkAnchor(courseId, request);
      if (get().accountId !== accountId) return null;
      setAuthoritativeCourse(set, accountId, result.data);
      await persistCurrentState(get);
      return result.data;
    } catch (error) {
      const conflict = getConflictCourse(error);
      if (conflict) setAuthoritativeCourse(set, accountId, conflict);
      set({ errorCode: getChartErrorCode(error) ?? 'NETWORK' });
      return null;
    }
  },

  unlinkAnchor: async (courseId, linkId, expectedCourseVersion) => {
    const unavailable = mutationUnavailable(get);
    if (unavailable) {
      set({ errorCode: unavailable });
      return null;
    }
    const accountId = get().accountId;
    if (!accountId) return null;
    try {
      const result = await chartApiClient.unlinkAnchor(courseId, linkId, expectedCourseVersion);
      if (get().accountId !== accountId) return null;
      setAuthoritativeCourse(set, accountId, result.data);
      await persistCurrentState(get);
      return result.data;
    } catch (error) {
      const conflict = getConflictCourse(error);
      if (conflict) setAuthoritativeCourse(set, accountId, conflict);
      set({ errorCode: getChartErrorCode(error) ?? 'NETWORK' });
      return null;
    }
  },

  clearAccount: (accountId) => {
    activeController?.abort();
    activeController = null;
    refreshPromise = null;
    if (accountId) void purgeCourseCache(accountId);
    set({
      accountId: null,
      initializationStatus: 'idle',
      courses: [],
      activeCourse: null,
      loading: false,
      refreshing: false,
      errorCode: null,
      migrationRequired: false,
      readOnly: true,
      offline: false,
      stale: false,
      lastSyncedAt: null,
    });
  },
}));

export async function purgeChartCacheForAccount(accountId: string): Promise<void> {
  await purgeCourseCache(accountId);
}

export function isCourseStoreCacheStale(lastSyncedAt: number | null): boolean {
  return !lastSyncedAt || Date.now() - lastSyncedAt > CHART_STALE_AFTER_MS;
}
