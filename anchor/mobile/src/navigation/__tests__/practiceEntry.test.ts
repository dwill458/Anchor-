import { startPractice } from '../practiceEntry';
import type { PracticeEntryMode } from '@/types/practice';

const anchor = {
  id: 'anchor-1',
  userId: 'user-1',
  intentionText: 'Keep the thread',
  category: 'career',
  distilledLetters: [],
  baseSigilSvg: '<svg />',
  structureVariant: 'balanced',
  isCharged: true,
  activationCount: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

const access = {
  limitsActive: false,
  tier: 'pro' as const,
  focus: {
    kind: 'focus' as const,
    limit: Infinity,
    remaining: Infinity,
    hasUnlimitedAccess: true,
    isAllowed: true,
    focusUsed: 0,
    deepUsed: 0,
    totalUsed: 0,
    weekKey: 'test-week',
  },
  deep: {
    kind: 'deep' as const,
    limit: Infinity,
    remaining: Infinity,
    hasUnlimitedAccess: true,
    isAllowed: true,
    focusUsed: 0,
    deepUsed: 0,
    totalUsed: 0,
    weekKey: 'test-week',
  },
};

function buildDependencies(overrides: Record<string, unknown> = {}) {
  return {
    getAnchorById: (id: string) => (id === anchor.id ? anchor : undefined),
    primeSessionAccess: access,
    visualizeAvailable: true,
    defaultFocusDurationSeconds: 30,
    defaultAudioConfiguration: {
      focus: { guidanceVoice: 'female' as const, backgroundAudio: 'ambient' as const, source: 'default' as const },
      deepPrime: { guidanceVoice: 'female' as const, backgroundAudio: 'ambient' as const, source: 'default' as const },
    },
    navigateToPractice: jest.fn(),
    navigateToPaywall: jest.fn(),
    ...overrides,
  };
}

describe('startPractice', () => {
  it('creates exactly one direct Deep Prime setup target', () => {
    const dependencies = buildDependencies();

    expect(startPractice({
      mode: 'deepPrime',
      anchorId: anchor.id,
      source: 'practice_hero',
    }, dependencies)).toBe(true);

    expect(dependencies.navigateToPractice).toHaveBeenCalledTimes(1);
    expect(dependencies.navigateToPractice).toHaveBeenCalledWith({
      route: 'ChargeSetup',
      params: {
        anchorId: anchor.id,
        returnTo: 'practice',
        returnTarget: { kind: 'practice' },
        initialDuration: 'deep',
        initialDurationSeconds: undefined,
        flowVariant: 'practice',
        source: 'practice_hero',
      },
    });
    expect(dependencies.navigateToPaywall).not.toHaveBeenCalled();
  });

  it('uses the same direct boundary for focus, visualize, and release', () => {
    const dependencies = buildDependencies();

    expect(startPractice({ mode: 'focus', anchorId: anchor.id, source: 'anchor_detail' }, dependencies)).toBe(true);
    expect(startPractice({ mode: 'visualize', anchorId: anchor.id, source: 'anchor_detail' }, dependencies)).toBe(true);
    expect(startPractice({ mode: 'release', anchorId: anchor.id, source: 'anchor_detail' }, dependencies)).toBe(true);

    expect(dependencies.navigateToPractice).toHaveBeenCalledTimes(3);
    const routes = (dependencies.navigateToPractice as jest.Mock).mock.calls.map(
      ([target]) => target.route
    );
    expect(routes).toEqual(['ActivationRitual', 'VisualizePreparation', 'ConfirmBurn']);
    expect(routes).not.toContain('Sanctuary');
    expect(routes).not.toContain('AnchorDetail');
  });

  it('preserves an Anchor Detail destination through every entry target', () => {
    const dependencies = buildDependencies();
    const returnTarget = { kind: 'anchorDetail' as const, anchorId: anchor.id };

    expect(startPractice({
      mode: 'focus',
      anchorId: anchor.id,
      source: 'anchor_detail',
      returnTarget,
    }, dependencies)).toBe(true);

    expect(dependencies.navigateToPractice).toHaveBeenCalledWith(
      expect.objectContaining({
        route: 'ActivationRitual',
        params: expect.objectContaining({ returnTo: 'detail', returnTarget }),
      }),
    );
  });

  it('validates the anchor and mode before making any navigation call', () => {
    const dependencies = buildDependencies();

    expect(startPractice({ mode: 'deepPrime', anchorId: 'missing', source: 'practice_hero' }, dependencies)).toBe(false);
    expect(startPractice({ mode: 'invalid' as PracticeEntryMode, anchorId: anchor.id, source: 'practice_hero' }, dependencies)).toBe(false);
    expect(dependencies.navigateToPractice).not.toHaveBeenCalled();
    expect(dependencies.navigateToPaywall).not.toHaveBeenCalled();
  });

  it('sends unavailable sessions to the paywall without constructing a session route', () => {
    const dependencies = buildDependencies({
      primeSessionAccess: {
        ...access,
        deep: {
          ...access.deep,
          isAllowed: false,
          remaining: 0,
          limit: 5,
          hasUnlimitedAccess: false,
        },
      },
    });

    expect(startPractice({ mode: 'deepPrime', anchorId: anchor.id, source: 'practice_hero' }, dependencies)).toBe(false);
    expect(dependencies.navigateToPaywall).toHaveBeenCalledTimes(1);
    expect(dependencies.navigateToPractice).not.toHaveBeenCalled();
  });
});
