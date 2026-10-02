import AsyncStorage from '@react-native-async-storage/async-storage';

export type CourseEventRecord = {
  id: string;
  courseId: string;
  type: 'MOVE_COMPLETED' | 'PROGRESS_UPDATED';
  timestamp: string;
  payload: {
    moveTitle?: string;
    from?: number;
    to?: number;
    unit?: string;
    delta?: number;
  };
};

const STORAGE_PREFIX = 'anchor:chart_events:';

/**
 * In-memory cache for fast synchronous access during render, backed by AsyncStorage.
 */
const eventCache = new Map<string, CourseEventRecord[]>();
const loadingPromises = new Map<string, Promise<CourseEventRecord[]>>();

async function loadEventsFromStorage(courseId: string): Promise<CourseEventRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${courseId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getRecordedCourseEvents(courseId: string): Promise<CourseEventRecord[]> {
  if (!courseId) return [];
  if (eventCache.has(courseId)) {
    return eventCache.get(courseId) ?? [];
  }
  if (loadingPromises.has(courseId)) {
    return loadingPromises.get(courseId)!;
  }
  const promise = loadEventsFromStorage(courseId).then((events) => {
    eventCache.set(courseId, events);
    loadingPromises.delete(courseId);
    return events;
  });
  loadingPromises.set(courseId, promise);
  return promise;
}

export function getCachedCourseEvents(courseId: string): CourseEventRecord[] {
  if (!courseId) return [];
  return eventCache.get(courseId) ?? [];
}

export async function recordCourseEvent(
  courseId: string,
  event: Omit<CourseEventRecord, 'id'>
): Promise<CourseEventRecord> {
  const newRecord: CourseEventRecord = {
    ...event,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };

  const existing = await getRecordedCourseEvents(courseId);
  const updated = [newRecord, ...existing];
  eventCache.set(courseId, updated);

  try {
    await AsyncStorage.setItem(`${STORAGE_PREFIX}${courseId}`, JSON.stringify(updated));
  } catch (err) {
    // Non-fatal if storage fails
  }

  return newRecord;
}
