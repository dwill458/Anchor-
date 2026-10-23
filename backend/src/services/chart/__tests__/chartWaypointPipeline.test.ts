const mockPrisma = {
  anchor: { findFirst: jest.fn() }, vision: { findFirst: jest.fn() },
  aIPlanProposal: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
  $transaction: jest.fn(),
  course: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  waypoint: { create: jest.fn() }, move: { create: jest.fn() },
  courseAnchorLink: { create: jest.fn() }, courseEvent: { findUnique: jest.fn(), create: jest.fn() },
};
jest.mock('../../../lib/prisma', () => ({ prisma: mockPrisma }));
jest.mock('../../v2/OnboardingContextService', () => ({ getOnboardingContext: jest.fn(async () => null) }));
jest.mock('../../StorageService', () => ({ readPrivateImageAsset: jest.fn() }));
jest.mock('../../../config/chartFlags', () => ({ getChartFeatureFlags: () => ({ chart_ai_planner_enabled: true }) }));
jest.mock('../../../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { ChartPlannerService } from '../ChartPlannerService';
import { chartService } from '../ChartService';
import { findCourse, projection } from '../../CourseService';
import { resolveChartPlannerConfig, type ChartModelProvider } from '../chartModelProviders';
import { logger } from '../../../utils/logger';

function response(count: number) {
  return {
    needsMoreContext: false, followUpQuestion: null, destination: 'A meaningful destination',
    complexity: count >= 5 ? 'COMPLEX' : 'SIMPLE', routeScope: 'DESTINATION',
    analysis: { startingPointSummary: 'The person has a starting point.', assumptions: [], routeDesign: { selectedWaypointCount: count, complexityReason: 'Distinct dependent outcomes remain.', countReason: 'Each state is a separate achievement.' }, firstMilestoneEvidence: 'The stated resources support the first achievement.', difficultyReduction: null, prerequisites: Array.from({ length: count }, (_, waypointIndex) => ({ waypointIndex, requires: waypointIndex ? [waypointIndex - 1] : [] })) },
    waypoints: Array.from({ length: count }, (_, index) => ({ title: `Distinct achievement ${index + 1}`, rationale: 'An observable change.', type: 'MILESTONE', metricType: 'completion', targetMetric: null, targetValue: null, baselineValue: null, completionCriteria: `State ${index + 1} is demonstrably complete`, requirements: [], moves: [] })),
    suggestedOneMove: { title: 'Ask one current user about their experience', rationale: null }, personalizedGuidance: null,
  };
}

const input = { anchorId: 'anchor', idempotencyKey: 'plan-request', actualStartingPoint: 'The app is live and I can speak to current users.' };
const provider = (name: 'openai' | 'gemini', result: unknown): ChartModelProvider => ({ name, model: `${name}-test`, generateJson: jest.fn(async () => result) });

beforeEach(() => {
  jest.clearAllMocks();
  mockPrisma.anchor.findFirst.mockResolvedValue({ id: 'anchor', intentionText: 'A meaningful destination', category: 'career', activationCount: 0, practiceSessions: [], releasedAt: null, isArchived: false });
  mockPrisma.vision.findFirst.mockResolvedValue(null);
  mockPrisma.aIPlanProposal.findUnique.mockResolvedValue(null);
  let stored: unknown;
  mockPrisma.aIPlanProposal.create.mockImplementation(async ({ data }) => { stored = { id: 'proposal', ...data }; return stored; });
  mockPrisma.aIPlanProposal.findFirst.mockImplementation(async () => stored);
  mockPrisma.aIPlanProposal.updateMany.mockResolvedValue({ count: 1 });
  const now = new Date();
  let course: any;
  mockPrisma.$transaction.mockImplementation(async callback => callback(mockPrisma));
  mockPrisma.course.findUnique.mockResolvedValue(null);
  mockPrisma.course.findFirst.mockImplementation(async ({ where }) => where.id ? structuredClone(course) : null);
  mockPrisma.course.create.mockImplementation(async ({ data }) => { course = { ...data, status: 'DRAFT', version: 1, currentWaypointId: null, currentMoveId: null, waypoints: [], moves: [], anchorLinks: [], plottedAt: now, createdAt: now, updatedAt: now, completedAt: null, archivedAt: null, deletedAt: null }; return course; });
  mockPrisma.course.update.mockImplementation(async ({ data }) => Object.assign(course, data));
  mockPrisma.waypoint.create.mockImplementation(async ({ data }) => { const row = { reachedAt: null, skippedAt: null, cancelledAt: null, supportingPracticeSessionId: null, createdAt: now, updatedAt: now, ...data }; course.waypoints.push(row); return row; });
  mockPrisma.move.create.mockImplementation(async ({ data }) => { const row = { createdAt: now, completedAt: null, ...data }; course.moves.push(row); return row; });
  mockPrisma.courseAnchorLink.create.mockImplementation(async ({ data }) => data);
  mockPrisma.courseEvent.findUnique.mockResolvedValue(null);
  mockPrisma.courseEvent.create.mockImplementation(async ({ data }) => data);
});

describe('waypoint count through the real planning, persistence and response code', () => {
  it('configures OpenAI primary and Gemini fallback', () => {
    const config = resolveChartPlannerConfig({ OPENAI_API_KEY: 'test-openai', GOOGLE_API_KEY: 'test-google' });
    expect(config.providers.map(p => p.name)).toEqual(['openai', 'gemini']);
    expect(config.providers[0].model).toBe('gpt-5.4-mini');
    expect(config.providers[1].model).toBe('gemini-3.5-flash-lite');
  });
  it.each([3, 4, 5, 6, 7, 8])('preserves all %i generated waypoints through validation, proposal storage and API projection', async count => {
    const primary = provider('openai', response(count));
    const planner = new ChartPlannerService(() => ({ providers: [primary], primaryTimeoutMs: 1000, fallbackTimeoutMs: 1000 }));
    const result = await planner.generate('user', input);
    if (result.status !== 'proposal') throw new Error('Expected a proposal');
    const persisted = mockPrisma.aIPlanProposal.create.mock.calls[0][0].data;
    const retrieved = await planner.get('user', result.proposal.proposalId);
    expect(persisted.waypoints).toHaveLength(count);
    expect(result.proposal.waypoints).toHaveLength(count);
    expect(retrieved.waypoints.map(w => w.title)).toEqual(response(count).waypoints.map(w => w.title));
    expect(logger.info).toHaveBeenCalledWith('chart_planner_waypoint_counts', expect.objectContaining({ rawCount: count, normalizedCount: count, validatedCount: count }));
    const reviewed = [...retrieved.waypoints].reverse();
    const saved = await chartService.createChart('user', { anchorId: 'anchor', idempotencyKey: 'save-request', destinationText: retrieved.destination, waypoints: reviewed, oneMove: retrieved.suggestedOneMove });
    const apiResponse = projection(await findCourse(mockPrisma as never, 'user', saved.id));
    expect(mockPrisma.waypoint.create).toHaveBeenCalledTimes(count);
    expect(saved.waypoints.map(w => w.title)).toEqual(reviewed.map(w => w.title));
    expect(apiResponse.waypointCount).toBe(count);
    expect(apiResponse.waypoints).toHaveLength(count);
    expect(mockPrisma.courseEvent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ eventType: 'COURSE_CREATED', snapshot: { waypointCount: count } }) }));
  });

  it('uses Gemini after OpenAI returns an invalid plan', async () => {
    const primary = provider('openai', response(1));
    const fallback = provider('gemini', response(7));
    const planner = new ChartPlannerService(() => ({ providers: [primary, fallback], primaryTimeoutMs: 1000, fallbackTimeoutMs: 1000 }));
    const result = await planner.generate('user', input);
    expect(result).toMatchObject({ status: 'proposal', proposal: { generation: { source: 'ai', fallbackUsed: true } } });
    expect(primary.generateJson).toHaveBeenCalledTimes(1);
    expect(fallback.generateJson).toHaveBeenCalledTimes(1);
    expect(mockPrisma.aIPlanProposal.create.mock.calls[0][0].data.generationSource).toBe('gemini');
  });

  it('fails explicitly when both plans are invalid, without saving a template', async () => {
    const planner = new ChartPlannerService(() => ({ providers: [provider('openai', response(1)), provider('gemini', response(1))], primaryTimeoutMs: 1000, fallbackTimeoutMs: 1000 }));
    await expect(planner.generate('user', input)).rejects.toMatchObject({ code: 'CHART_PLAN_UNAVAILABLE' });
    expect(mockPrisma.aIPlanProposal.create).not.toHaveBeenCalled();
  });

  it('rejects an oversized adjustment instead of silently slicing its route', async () => {
    const primary = provider('openai', response(7));
    const planner = new ChartPlannerService(() => ({ providers: [primary], primaryTimeoutMs: 1000, fallbackTimeoutMs: 1000 }));
    await expect(planner.adjust('user', { ...input, reason: 'OTHER', draft: { destination: 'Goal', waypoints: Array.from({ length: 13 }, () => ({ title: 'Milestone' })) } })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(primary.generateJson).not.toHaveBeenCalled();
  });
});
