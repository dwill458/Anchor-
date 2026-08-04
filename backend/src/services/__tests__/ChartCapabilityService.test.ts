/**
 * Coverage for Workstream G's capability projection.
 *
 * `/api/auth/me` and every Chart route resolve authorization from this one
 * projection, but it shipped without direct tests. These pin the entitlement
 * matrix, the rollout and kill-switch precedence, and the fail-closed planner
 * configuration behaviour, and prove no billing or rollout internals leak into
 * the projection the client sees.
 */

const mockPrisma = {
  aIPlanProposal: { count: jest.fn(), findMany: jest.fn() },
};
jest.mock('../../lib/prisma', () => ({ prisma: mockPrisma }));

// Provider configuration is read through these resolvers. Driving them directly
// keeps "the planner is unconfigured" independent of how the key reaches env.
const plannerConfig: { apiKey: string | undefined } = { apiKey: 'test-planner-key' };
jest.mock('../../config/plannerPolicy', () => {
  const actual = jest.requireActual('../../config/plannerPolicy');
  return { ...actual, resolvePlannerApiKey: () => plannerConfig.apiKey };
});

const ALL_ON = {
  ENABLE_CHART: 'true',
  ENABLE_CHART_WRITE: 'true',
  ENABLE_CHART_REFLECTIONS: 'true',
  ENABLE_CHART_AI_PLANNER: 'true',
  CHART_ROLLOUT_PERCENT: '100',
  CHART_KILL_SWITCH: 'false',
  GOOGLE_API_KEY: 'test-planner-key',
};

type Entitlement = 'free' | 'trial' | 'pro' | 'expired' | 'comped';

function accountFor(entitlement: Entitlement, chartSchemaVersion = 1) {
  const base = {
    id: `account-${entitlement}`,
    isComped: false,
    subscriptionStatus: 'free',
    subscriptionId: null as string | null,
    trialStartedAt: null as Date | null,
    chartSchemaVersion,
  };
  switch (entitlement) {
    case 'trial':
      return { ...base, trialStartedAt: new Date() };
    case 'pro':
      return { ...base, subscriptionStatus: 'pro', subscriptionId: 'pro-sub' };
    case 'expired':
      // Trial began well outside the window and no subscription replaced it.
      return { ...base, trialStartedAt: new Date('2020-01-01T00:00:00.000Z') };
    case 'comped':
      return { ...base, isComped: true };
    default:
      return base;
  }
}

/** Loads the service with a fresh env so flag composition is re-evaluated. */
async function capabilitiesFor(
  entitlement: Entitlement,
  overrides: Record<string, string> = {},
  chartSchemaVersion = 1
) {
  jest.resetModules();
  const previous = { ...process.env };
  Object.assign(process.env, ALL_ON, overrides);
  try {
    const { getChartCapabilities } = await import('../ChartCapabilityService');
    return await getChartCapabilities(accountFor(entitlement, chartSchemaVersion));
  } finally {
    process.env = previous;
  }
}

const withoutProviderKey = async () => {
  plannerConfig.apiKey = undefined;
  return capabilitiesFor('pro');
};

describe('ChartCapabilityService (Workstream G)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    plannerConfig.apiKey = 'test-planner-key';
    mockPrisma.aIPlanProposal.count.mockResolvedValue(0);
    mockPrisma.aIPlanProposal.findMany.mockResolvedValue([]);
  });

  describe('entitlement matrix', () => {
    it('gives free accounts Chart access but no AI generation', async () => {
      const capabilities = await capabilitiesFor('free');
      expect(capabilities.canViewChart).toBe(true);
      expect(capabilities.canCreateManualCourse).toBe(true);
      expect(capabilities.canGenerateChartPlan).toBe(false);
      expect(capabilities.plannerQuota.limit).toBe(0);
    });

    it('gives trial accounts the frozen three lifetime generations', async () => {
      const capabilities = await capabilitiesFor('trial');
      expect(capabilities.canGenerateChartPlan).toBe(true);
      expect(capabilities.plannerQuota.limit).toBe(3);
      expect(capabilities.plannerQuota.remaining).toBe(3);
    });

    it('gives Pro accounts ten per rolling day', async () => {
      const capabilities = await capabilitiesFor('pro');
      expect(capabilities.canGenerateChartPlan).toBe(true);
      expect(capabilities.plannerQuota.limit).toBe(10);
    });

    it('treats a comped account as entitled', async () => {
      const capabilities = await capabilitiesFor('comped');
      expect(capabilities.canGenerateChartPlan).toBe(true);
      expect(capabilities.plannerQuota.limit).toBeGreaterThan(0);
    });

    it('keeps existing work usable after entitlement expires but blocks generation', async () => {
      const capabilities = await capabilitiesFor('expired');
      expect(capabilities.canGenerateChartPlan).toBe(false);
      // F1: history stays visible and an eligible proposal stays acceptable.
      expect(capabilities.canViewOwnedCourseHistory).toBe(true);
      expect(capabilities.canRetrieveOwnedChartPlan).toBe(true);
      expect(capabilities.canAcceptExistingChartPlan).toBe(true);
      expect(capabilities.canCompleteExistingCourse).toBe(true);
    });

    it('exhausted quota withdraws generation without withdrawing anything else', async () => {
      mockPrisma.aIPlanProposal.count.mockResolvedValue(3);
      const capabilities = await capabilitiesFor('trial');
      expect(capabilities.canGenerateChartPlan).toBe(false);
      expect(capabilities.plannerQuota.remaining).toBe(0);
      expect(capabilities.canCreateManualCourse).toBe(true);
      expect(capabilities.canCreateOrEditReflections).toBe(true);
    });
  });

  describe('rollout and kill switch', () => {
    it('denies everything at the default rollout of zero', async () => {
      const capabilities = await capabilitiesFor('pro', { CHART_ROLLOUT_PERCENT: '0' });
      expect(capabilities.chartEnabled).toBe(false);
      expect(capabilities.canViewChart).toBe(false);
      expect(capabilities.canCreateManualCourse).toBe(false);
      expect(capabilities.canGenerateChartPlan).toBe(false);
    });

    it('lets the kill switch override an otherwise fully enabled account', async () => {
      const capabilities = await capabilitiesFor('pro', { CHART_KILL_SWITCH: 'true' });
      expect(capabilities.chartEnabled).toBe(false);
      expect(capabilities.canViewChart).toBe(false);
      expect(capabilities.canCreateOrEditReflections).toBe(false);
    });

    it('assigns buckets deterministically from the server-resolved account id', async () => {
      jest.resetModules();
      const previous = { ...process.env };
      Object.assign(process.env, ALL_ON, { CHART_ROLLOUT_PERCENT: '50' });
      try {
        const { isAccountInChartRollout } = await import('../../config/chartFlags');
        const first = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => isAccountInChartRollout(id));
        const second = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => isAccountInChartRollout(id));
        expect(second).toEqual(first);
        // A partial rollout must actually partition, not admit everyone.
        expect(new Set(first).size).toBe(2);
      } finally {
        process.env = previous;
      }
    });

    it('withholds Chart until the account has been migrated', async () => {
      const capabilities = await capabilitiesFor('pro', {}, 0);
      expect(capabilities.canViewChart).toBe(false);
      expect(capabilities.canCreateManualCourse).toBe(false);
    });
  });

  describe('planner configuration fails closed', () => {
    it('reports the planner unavailable when the provider key is missing', async () => {
      const capabilities = await withoutProviderKey();
      expect(capabilities.chartAiPlannerEnabled).toBe(false);
      expect(capabilities.canGenerateChartPlan).toBe(false);
      expect(capabilities.plannerQuota.reason).toBe('planner_disabled');
      // Retrieval and acceptance of already-owned proposals are unaffected.
      expect(capabilities.canRetrieveOwnedChartPlan).toBe(true);
      expect(capabilities.canAcceptExistingChartPlan).toBe(true);
    });

    it('reports the planner unavailable when the planner flag is off', async () => {
      const capabilities = await capabilitiesFor('pro', { ENABLE_CHART_AI_PLANNER: 'false' });
      expect(capabilities.chartAiPlannerEnabled).toBe(false);
      expect(capabilities.canGenerateChartPlan).toBe(false);
      expect(capabilities.canViewChart).toBe(true);
    });

    it('does not consult the provider or quota while the planner is unavailable', async () => {
      await withoutProviderKey();
      expect(mockPrisma.aIPlanProposal.count).not.toHaveBeenCalled();
    });
  });

  describe('write withdrawal', () => {
    it('freezes writes while reads continue', async () => {
      const capabilities = await capabilitiesFor('pro', { ENABLE_CHART_WRITE: 'false' });
      expect(capabilities.canViewChart).toBe(true);
      expect(capabilities.canViewOwnedCourseHistory).toBe(true);
      expect(capabilities.canCreateManualCourse).toBe(false);
      expect(capabilities.canEditCourse).toBe(false);
      expect(capabilities.canCreateOrEditReflections).toBe(false);
      expect(capabilities.canAcceptExistingChartPlan).toBe(false);
    });

    it('withdraws reflection writes independently of other writes', async () => {
      const capabilities = await capabilitiesFor('pro', { ENABLE_CHART_REFLECTIONS: 'false' });
      expect(capabilities.canCreateOrEditReflections).toBe(false);
      expect(capabilities.canCreateManualCourse).toBe(true);
    });
  });

  describe('projection safety', () => {
    it('exposes decisions only — no billing, rollout, or provider internals', async () => {
      const capabilities = await capabilitiesFor('pro');
      const serialized = JSON.stringify(capabilities);

      expect(serialized).not.toMatch(/test-planner-key/);
      expect(serialized).not.toMatch(/subscriptionId|pro-sub|revenuecat|entitlement"/i);
      expect(serialized).not.toMatch(/bucket|rollout|percent/i);
      // Quota is display-only: no raw usage counters or entitlement labels.
      expect(Object.keys(capabilities.plannerQuota).sort()).toEqual(
        ['eligible', 'limit', 'reason', 'remaining', 'resetAt'].sort()
      );
    });

    it('resolves per account, so two accounts do not share a decision', async () => {
      mockPrisma.aIPlanProposal.count.mockResolvedValue(3);
      const trialExhausted = await capabilitiesFor('trial');
      mockPrisma.aIPlanProposal.count.mockResolvedValue(0);
      const proFresh = await capabilitiesFor('pro');

      expect(trialExhausted.canGenerateChartPlan).toBe(false);
      expect(proFresh.canGenerateChartPlan).toBe(true);
    });
  });
});
