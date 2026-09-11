import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { AppError } from '../../api/middleware/errorHandler';
import { normalizeTimeZone, computeLocalDateKey } from './VisionService';

type InsightMode = 'focus' | 'deep_prime' | 'visualize' | 'release';
type Fact = Record<string, unknown>;

function localMonday(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(date);
  const take = (kind: string) => Number(parts.find(part => part.type === kind)?.value);
  const weekday = parts.find(part => part.type === 'weekday')?.value;
  const offsets: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const midnight = Date.UTC(take('year'), take('month') - 1, take('day'));
  return new Date(midnight - (offsets[weekday ?? 'Mon'] ?? 0) * 86_400_000);
}

function dayIndex(date: Date, timeZone: string): number {
  const key = computeLocalDateKey(date, timeZone);
  return (new Date(`${key}T00:00:00.000Z`).getUTCDay() + 6) % 7;
}

function dayLabel(index: number): string {
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index] ?? 'Mon';
}

function weekLabel(start: Date, end: Date, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric' });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

/**
 * Server-owned weekly evidence builder. It deliberately accepts no counts,
 * Thread scores, or narrative facts from a device.
 */
export class WeeklyInsightService {
  async generate(userId: string, input: { anchorId?: string | null; timeZone?: string; now?: Date }) {
    const timeZone = normalizeTimeZone(input.timeZone ?? 'UTC');
    const now = input.now ?? new Date();
    const weekStart = localMonday(now, timeZone);
    const weekEnd = new Date(weekStart.getTime() + 7 * 86_400_000 - 1);
    const anchorId = input.anchorId ?? null;

    if (anchorId) {
      const owned = await prisma.anchor.findFirst({ where: { id: anchorId, userId }, select: { id: true } });
      if (!owned) throw new AppError('Anchor not found', 404, 'ANCHOR_NOT_FOUND');
    }

    // Fetch a small authoritative range then apply the account timezone in JS;
    // DB UTC boundaries alone would move events into the wrong user week.
    const rangeStart = new Date(weekStart.getTime() - 36 * 60 * 60 * 1000);
    const rangeEnd = new Date(weekEnd.getTime() + 36 * 60 * 60 * 1000);
    const sessions = await prisma.practiceSession.findMany({
      where: { userId, completionStatus: 'completed', completedAt: { gte: rangeStart, lte: rangeEnd }, ...(anchorId ? { anchorId } : {}) },
      orderBy: { completedAt: 'asc' },
      select: { id: true, anchorId: true, practiceMode: true, completedDurationSeconds: true, completedAt: true, waypointId: true },
    });
    const weeklySessions = sessions.filter(session => {
      const key = computeLocalDateKey(session.completedAt, timeZone);
      return key >= computeLocalDateKey(weekStart, timeZone) && key <= computeLocalDateKey(weekEnd, timeZone);
    });
    const anchors = await prisma.anchor.findMany({
      where: { userId, ...(anchorId ? { id: anchorId } : {}) },
      select: { id: true, intentionText: true, category: true, createdAt: true, releasedAt: true },
    });
    const movements = await prisma.threadV2Movement.findMany({
      where: { userId, completedAt: { gte: rangeStart, lte: rangeEnd }, ...(anchorId ? { anchorId } : {}) },
      orderBy: { completedAt: 'asc' },
      select: { anchorId: true, completedAt: true, beforeStrength: true, afterStrength: true, delta: true },
    });
    const weeklyMovements = movements.filter(movement => {
      const key = computeLocalDateKey(movement.completedAt, timeZone);
      return key >= computeLocalDateKey(weekStart, timeZone) && key <= computeLocalDateKey(weekEnd, timeZone);
    });
    const [events, views, courseEvents] = await Promise.all([
      prisma.threadEventLedger.findMany({ where: { userId, occurredAt: { gte: rangeStart, lte: rangeEnd }, ...(anchorId ? { anchorId } : {}) }, orderBy: { occurredAt: 'asc' }, select: { eventType: true, occurredAt: true, metadata: true } }),
      prisma.visionView.findMany({ where: { userId, viewedAt: { gte: rangeStart, lte: rangeEnd } }, select: { viewedAt: true, vision: { select: { anchorId: true, title: true } } } }),
      prisma.courseEvent.findMany({ where: { userId, occurredAt: { gte: rangeStart, lte: rangeEnd } }, orderBy: { occurredAt: 'asc' }, select: { eventType: true, occurredAt: true, waypoint: { select: { title: true } } } }),
    ]);

    const modeCounts: Record<InsightMode, number> = { focus: 0, deep_prime: 0, visualize: 0, release: 0 };
    const activeDays = Array<boolean>(7).fill(false);
    for (const session of weeklySessions) {
      if (session.practiceMode in modeCounts) modeCounts[session.practiceMode as InsightMode] += 1;
      activeDays[dayIndex(session.completedAt, timeZone)] = true;
    }
    const movementByDay = Array.from({ length: 7 }, () => undefined as number | undefined);
    weeklyMovements.forEach(movement => { movementByDay[dayIndex(movement.completedAt, timeZone)] = movement.afterStrength; });
    const firstMovement = weeklyMovements[0];
    const lastMovement = weeklyMovements[weeklyMovements.length - 1];
    const threadPoints = movementByDay.map((value, index) => value ?? (index ? movementByDay[index - 1] : firstMovement?.beforeStrength ?? 0));
    const weekLabelText = weekLabel(weekStart, weekEnd, timeZone);
    const facts: Fact = {
      weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString(), weekLabel: weekLabelText, completedDateLabel: 'Current week',
      sessions: weeklySessions.map(session => ({ id: session.id, anchorId: session.anchorId, mode: session.practiceMode, durationSeconds: session.completedDurationSeconds, completedAt: session.completedAt.toISOString(), dayOfWeekIndex: dayIndex(session.completedAt, timeZone), isLinkedToWaypoint: Boolean(session.waypointId) })),
      activeDaysCount: activeDays.filter(Boolean).length, activeDays,
      totalDurationSeconds: weeklySessions.reduce((total, session) => total + session.completedDurationSeconds, 0),
      modeCounts: { focus: modeCounts.focus, deepPrime: modeCounts.deep_prime, visualize: modeCounts.visualize, release: modeCounts.release },
      threadPoints, startThread: firstMovement?.beforeStrength ?? null, endThread: lastMovement?.afterStrength ?? null,
      authoritativeThreadDelta: weeklyMovements.length ? weeklyMovements.reduce((total, movement) => total + movement.delta, 0) : null,
      canonicalEvents: [...events.map(event => ({ type: event.eventType, dayLabel: dayLabel(dayIndex(event.occurredAt, timeZone)), occurredAt: event.occurredAt.toISOString(), metadata: event.metadata })), ...courseEvents.map(event => ({ type: event.eventType, dayLabel: dayLabel(dayIndex(event.occurredAt, timeZone)), occurredAt: event.occurredAt.toISOString(), metadata: event.waypoint?.title ? { waypointTitle: event.waypoint.title } : undefined }))],
      anchors: anchors.map(anchor => ({ id: anchor.id, intention: anchor.intentionText, category: anchor.category, practiceCountInWeek: weeklySessions.filter(session => session.anchorId === anchor.id).length, releasedThisWeek: Boolean(anchor.releasedAt && anchor.releasedAt >= weekStart && anchor.releasedAt <= weekEnd) })),
      visionContext: { revisitsCount: views.filter(view => !anchorId || view.vision.anchorId === anchorId).length },
      evidenceAvailability: { thread: weeklyMovements.length > 0, course: courseEvents.length > 0, vision: views.length > 0 },
      timeZone,
    };
    const total = weeklySessions.length;
    const headline = total ? `You completed ${total} practice${total === 1 ? '' : 's'} this week.` : 'No Practice was recorded this week.';
    const snapshot = {
      weekLabel: weekLabelText, completedDateLabel: 'Current week', ruleType: total ? 'ACTIVITY' : 'QUIET',
      headline, support: 'Based on your recorded Anchor activity.', accentColor: '#7A6252', accentKey: 'neutral', visualType: 'activity',
      visualData: { type: 'activity', activeDays, activeDaysCount: activeDays.filter(Boolean).length, completedPracticesCount: total },
      evidence: [[String(total), 'PRACTICES', 'Recorded'], [String(activeDays.filter(Boolean).length), 'ACTIVE DAYS', 'Recorded'], [lastMovement ? `${lastMovement.afterStrength}` : 'Not recorded', 'THREAD', lastMovement ? 'Authoritative' : 'Not recorded']],
      comparison: 'Not recorded', comparisonTone: 'neutral', interpretation: headline, nextDirection: 'Return when you are ready.',
      detailedActivity: { totalPractices: total, activeDays: activeDays.filter(Boolean).length, totalMinutes: Math.floor((weeklySessions.reduce((sum, session) => sum + session.completedDurationSeconds, 0)) / 60), threadStart: firstMovement?.beforeStrength ?? null, threadEnd: lastMovement?.afterStrength ?? null, threadPoints, modeDistribution: [], connectedActivity: [], canonicalEvents: events.map(event => ({ label: event.eventType, day: dayLabel(dayIndex(event.occurredAt, timeZone)) })) },
      facts, createdAt: now.toISOString(),
    };
    const result = await prisma.weeklyInsightSnapshot.upsert({
      where: { userId_anchorId_weekStart: { userId, anchorId, weekStart } },
      create: { userId, anchorId, weekStart, weekEnd, snapshot: snapshot as Prisma.InputJsonValue }, update: {},
    });
    return { ...(result.snapshot as object), id: result.id, feedback: result.feedback };
  }
}

export const weeklyInsightService = new WeeklyInsightService();
