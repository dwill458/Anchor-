import type { Anchor } from '@/types';
import type { CourseLogEntry } from '@/types/chart';
import type { SessionLogEntry } from '@/stores/sessionStore';
import { threadQualitativeLabel } from '@/adapters/v2/home';
import type {
  CanonicalThreadEventType,
  ThreadEventSignificance,
  V2PracticeModeBreakdown,
  V2ProgressModel,
  V2ThreadEventItem,
} from './types';

export function resolveEvolutionStage(
  threadStrength: number,
): 'Forming' | 'Grounded' | 'Rooted' | 'Embedded' | 'Sovereign' {
  if (threadStrength >= 90) return 'Sovereign';
  if (threadStrength >= 75) return 'Embedded';
  if (threadStrength >= 50) return 'Rooted';
  if (threadStrength >= 25) return 'Grounded';
  return 'Forming';
}

function toIsoString(val: Date | string | undefined | null): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function formatDate(val: Date | string | undefined | null): string {
  if (!val) return 'Recent';
  try {
    const d = val instanceof Date ? val : new Date(val);
    return isNaN(d.getTime()) ? 'Recent' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recent';
  }
}

function formatTime(val: Date | string | undefined | null): string {
  if (!val) return '';
  try {
    const d = val instanceof Date ? val : new Date(val);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * Aggregates practice sessions for a specific Anchor into a mode breakdown.
 */
export function aggregatePracticeSessions(
  sessions: SessionLogEntry[],
  anchorId: string,
): V2PracticeModeBreakdown {
  const matching = sessions.filter(
    (s) => s.anchorId === anchorId || (s as any).anchor_id === anchorId,
  );

  let focusCount = 0;
  let focusSeconds = 0;
  let deepPrimeCount = 0;
  let deepPrimeSeconds = 0;
  let visualizeCount = 0;
  let visualizeSeconds = 0;
  let releaseCount = 0;
  let releaseSeconds = 0;

  for (const s of matching) {
    const duration = s.durationSeconds || 0;
    const mode = s.mode || s.type;

    if (s.type === 'reinforce' || mode === 'ambient') {
      deepPrimeCount++;
      deepPrimeSeconds += duration;
    } else if (s.type === 'visualize') {
      visualizeCount++;
      visualizeSeconds += duration;
    } else if ((s.type as string) === 'release') {
      releaseCount++;
      releaseSeconds += duration;
    } else {
      focusCount++;
      focusSeconds += duration;
    }
  }

  const totalSessions = matching.length;
  const totalDurationSeconds =
    focusSeconds + deepPrimeSeconds + visualizeSeconds + releaseSeconds;

  return {
    focusCount,
    focusSeconds,
    deepPrimeCount,
    deepPrimeSeconds,
    visualizeCount,
    visualizeSeconds,
    releaseCount,
    releaseSeconds,
    totalSessions,
    totalDurationSeconds,
  };
}

/**
 * Derives durable, evidence-first Thread Events strictly from persisted domain facts.
 * NEVER calculates fake Thread delta; if the authoritative server delta is absent,
 * authoritativeDelta remains null.
 */
export function deriveThreadEvents(
  anchor: Anchor,
  courseLogs: CourseLogEntry[],
  practiceSessions: SessionLogEntry[],
): V2ThreadEventItem[] {
  const events: V2ThreadEventItem[] = [];
  const intentionText = (anchor as any).intention || anchor.intentionText || 'Your Anchor';

  // 1. Anchor Created Event (Baseline lifecycle fact)
  if (anchor.createdAt) {
    const createdIso = toIsoString(anchor.createdAt);
    events.push({
      id: `evt-created-${anchor.id}`,
      type: 'ANCHOR_CREATED',
      title: 'Anchor created',
      copy: intentionText,
      why: 'Where your journey began.',
      significance: 'MEDIUM',
      occurredAt: createdIso,
      formattedDate: formatDate(anchor.createdAt),
      formattedTime: formatTime(anchor.createdAt),
      authoritativeDelta: null, // Initial creation has no delta
      authoritativeThreadRange: null,
      sourceDomain: 'ANCHOR_LIFECYCLE',
      rawDomainEventId: anchor.id,
    });
  }

  // 2. Evolution Stage Reached (if threshold crossed)
  const strength = typeof anchor.threadStrength === 'number' ? anchor.threadStrength : 0;
  const stage = resolveEvolutionStage(strength);
  if (stage !== 'Forming') {
    const stageDate = anchor.updatedAt || anchor.createdAt;
    const stageIso = toIsoString(stageDate);
    events.push({
      id: `evt-stage-${anchor.id}-${stage}`,
      type: 'EVOLUTION_STAGE_REACHED',
      title: `${stage} reached`,
      copy: `Your Anchor reached its permanent structural stage: ${stage}.`,
      why: 'Meaningful reinforcement held across time.',
      significance: 'HIGH',
      occurredAt: stageIso,
      formattedDate: formatDate(stageDate),
      formattedTime: formatTime(stageDate),
      authoritativeDelta: null, // Client must not infer or invent delta numbers
      authoritativeThreadRange: null,
      stageName: stage,
      sourceDomain: 'THREAD_ENGINE',
      rawDomainEventId: anchor.id,
    });
  }

  // 3. Practice Milestones
  const anchorSessions = practiceSessions.filter(
    (s) => s.anchorId === anchor.id || (s as any).anchor_id === anchor.id,
  );
  const totalCount = anchorSessions.length;
  const milestones = [10, 25, 50].filter((m) => totalCount >= m);

  for (const m of milestones) {
    const sessionDate = anchorSessions[m - 1]?.completedAt || new Date().toISOString();
    events.push({
      id: `evt-milestone-${anchor.id}-${m}`,
      type: 'PRACTICE_MILESTONE_REACHED',
      title: `${m}th Practice complete`,
      copy: `${m} completed sessions dedicated to this Anchor.`,
      why: 'Verifiable practice constancy.',
      significance: m >= 25 ? 'HIGH' : 'MEDIUM',
      occurredAt: toIsoString(sessionDate),
      formattedDate: formatDate(sessionDate),
      formattedTime: formatTime(sessionDate),
      authoritativeDelta: null,
      authoritativeThreadRange: null,
      milestoneCount: m,
      sourceDomain: 'PRACTICE',
      rawDomainEventId: anchorSessions[m - 1]?.id,
    });
  }

  // 4. Course / Waypoint Events from canonical CourseLog
  for (const log of courseLogs) {
    if (log.eventType === 'WAYPOINT_REACHED') {
      const wpTitle = (log.snapshot?.waypointTitle as string) || log.message || 'Waypoint reached';
      events.push({
        id: `evt-wp-${log.id}`,
        type: 'WAYPOINT_REACHED',
        title: wpTitle,
        copy: 'Milestone reached on your route.',
        why: 'Real-world milestone confirmed.',
        significance: 'HIGH',
        occurredAt: log.occurredAt,
        formattedDate: formatDate(log.occurredAt),
        formattedTime: formatTime(log.occurredAt),
        authoritativeDelta: null,
        authoritativeThreadRange: null,
        waypointTitle: wpTitle,
        sourceDomain: 'COURSE_EVENT',
        rawDomainEventId: log.id,
      });
    } else if (log.eventType === 'COURSE_COMPLETED') {
      events.push({
        id: `evt-dest-${log.id}`,
        type: 'DESTINATION_REACHED',
        title: 'Destination reached',
        copy: log.message || 'You reached your destination.',
        why: 'All waypoints on your course completed.',
        significance: 'MAJOR',
        occurredAt: log.occurredAt,
        formattedDate: formatDate(log.occurredAt),
        formattedTime: formatTime(log.occurredAt),
        authoritativeDelta: null,
        authoritativeThreadRange: null,
        sourceDomain: 'COURSE_EVENT',
        rawDomainEventId: log.id,
      });
    }
  }

  // 5. Intention Completed / Released lifecycle moments
  if ((anchor as any).intentionCompletedAt) {
    const completedAt = (anchor as any).intentionCompletedAt as string;
    events.push({
      id: `evt-completed-${anchor.id}`,
      type: 'ANCHOR_COMPLETED',
      title: 'Intention completed',
      copy: 'You confirmed this intention was realized in the real world.',
      why: 'Authoritative completion milestone.',
      significance: 'MAJOR',
      occurredAt: toIsoString(completedAt),
      formattedDate: formatDate(completedAt),
      formattedTime: formatTime(completedAt),
      authoritativeDelta: null,
      authoritativeThreadRange: null,
      sourceDomain: 'ANCHOR_LIFECYCLE',
      rawDomainEventId: anchor.id,
    });
  }

  const isArchived = Boolean(anchor.archivedAt || (anchor as any).isArchived);
  if (isArchived) {
    const releasedDate = anchor.archivedAt || anchor.updatedAt;
    const releasedIso = toIsoString(releasedDate);
    events.push({
      id: `evt-released-${anchor.id}`,
      type: 'ANCHOR_RELEASED',
      title: 'Anchor released',
      copy: 'You released your Anchor into the archive.',
      why: 'Non-destructive lifecycle transition.',
      significance: 'MAJOR',
      occurredAt: releasedIso,
      formattedDate: formatDate(releasedDate),
      formattedTime: formatTime(releasedDate),
      authoritativeDelta: null,
      authoritativeThreadRange: null,
      sourceDomain: 'ANCHOR_LIFECYCLE',
      rawDomainEventId: anchor.id,
    });
  }

  // Sort descending by occurredAt
  return events.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

/**
 * Normalizes state for V2ProgressScreen.
 */
export function toV2ProgressModel(
  anchor: Anchor | null | undefined,
  courseLogs: CourseLogEntry[] = [],
  sessions: SessionLogEntry[] = [],
): V2ProgressModel | null {
  if (!anchor) return null;

  const storedStrength = anchor.threadStrength;
  const hasStored = typeof storedStrength === 'number' && Number.isFinite(storedStrength);
  const threadStrength = hasStored ? Math.min(100, Math.max(0, Math.round(storedStrength as number))) : 0;
  const unmeasured = !hasStored;

  const qualitativeLabel = threadQualitativeLabel(threadStrength, unmeasured);
  const highestEvolutionStage = resolveEvolutionStage(threadStrength);
  const practiceSummary = aggregatePracticeSessions(sessions, anchor.id);

  const waypointsReachedCount = courseLogs.filter(
    (l) => l.eventType === 'WAYPOINT_REACHED' || l.eventType === 'COURSE_COMPLETED',
  ).length;

  const events = deriveThreadEvents(anchor, courseLogs, sessions);
  const intention = (anchor as any).intention || anchor.intentionText || 'Your Anchor';

  return {
    anchorId: anchor.id,
    intention,
    category: anchor.category,
    threadStrength,
    unmeasured,
    qualitativeLabel,
    highestEvolutionStage,
    practiceSummary,
    waypointsReachedCount,
    events,
  };
}
