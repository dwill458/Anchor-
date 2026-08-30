const mockEnv = { ENABLE_VISUALIZE: true };
const mockGetRevenueCatAccess = jest.fn();
const mockUserUpdate = jest.fn();

jest.mock('../../config/env', () => ({ env: mockEnv }));
jest.mock('../../lib/prisma', () => ({
  prisma: { user: { update: (...args: unknown[]) => mockUserUpdate(...args) } },
}));
jest.mock('../RevenueCatEntitlementService', () => ({
  getRevenueCatAccess: (...args: unknown[]) => mockGetRevenueCatAccess(...args),
}));

import { requireVisualizeAccess, type PracticeAccessUser } from '../PracticeAccessService';

const user = (overrides: Partial<PracticeAccessUser> = {}): PracticeAccessUser => ({
  id: 'user-1',
  isComped: false,
  subscriptionStatus: 'free',
  subscriptionId: null,
  trialStartedAt: new Date(),
  ...overrides,
});

describe('PracticeAccessService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.ENABLE_VISUALIZE = true;
    mockGetRevenueCatAccess.mockResolvedValue(null);
    mockUserUpdate.mockResolvedValue(undefined);
  });

  it('rejects every tier while the backend feature flag is disabled', async () => {
    mockEnv.ENABLE_VISUALIZE = false;
    await expect(
      requireVisualizeAccess(user({ isComped: true, subscriptionStatus: 'pro' }))
    ).rejects.toMatchObject({ statusCode: 403, code: 'FEATURE_DISABLED' });
  });

  it('permits comped users, active RevenueCat subscribers, and the seven-day trial', async () => {
    await expect(requireVisualizeAccess(user({ isComped: true }))).resolves.toBeUndefined();

    mockGetRevenueCatAccess.mockResolvedValue({
      isActive: true,
      productIdentifier: 'anchor_annual',
    });
    await expect(requireVisualizeAccess(user())).resolves.toBeUndefined();

    mockGetRevenueCatAccess.mockResolvedValue({
      isActive: false,
      productIdentifier: null,
    });
    await expect(
      requireVisualizeAccess(user({ trialStartedAt: new Date(Date.now() - 6 * 86_400_000) }))
    ).resolves.toBeUndefined();
  });

  it('rejects an expired Free account without trusting a client claim', async () => {
    mockGetRevenueCatAccess.mockResolvedValue({
      isActive: false,
      productIdentifier: null,
    });
    await expect(
      requireVisualizeAccess(user({ trialStartedAt: new Date(Date.now() - 8 * 86_400_000) }))
    ).rejects.toMatchObject({ statusCode: 403, code: 'PREMIUM_PRACTICE_LOCKED' });
  });
});
