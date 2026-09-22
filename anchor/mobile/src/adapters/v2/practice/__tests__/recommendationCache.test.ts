import {
  V2_RECOMMENDATION_FRESH_MS,
  invalidateV2RecommendationContext,
  isV2RecommendationContextFresh,
  peekV2RecommendationContext,
  rememberV2RecommendationContext,
} from '../recommendationCache';
import { useSessionStore } from '@/stores/sessionStore';
import type { V2RecommendationContext } from '../recommendationClient';

const context = (anchorId: string): V2RecommendationContext => ({
  anchorId,
  completionSignal: null,
  vision: { exists: false, seenToday: false },
  thread: { delta7d: null, delta7dStatus: 'UNAVAILABLE', status: 'UNAVAILABLE' },
  recommendation: { action: 'Focus', reason: 'server_authoritative' },
});

describe('recommendationCache', () => {
  beforeEach(() => {
    invalidateV2RecommendationContext();
    jest.useRealTimers();
  });

  it('returns nothing for an Anchor it has not seen', () => {
    expect(peekV2RecommendationContext('a')).toBeNull();
    expect(isV2RecommendationContextFresh('a')).toBe(false);
  });

  it('serves the last context and treats it as fresh within the window', () => {
    rememberV2RecommendationContext('a', context('a'));
    expect(peekV2RecommendationContext('a')?.anchorId).toBe('a');
    expect(isV2RecommendationContextFresh('a')).toBe(true);
  });

  it('keeps serving a stale context but stops calling it fresh', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    rememberV2RecommendationContext('a', context('a'));
    (Date.now as jest.Mock).mockReturnValue(now + V2_RECOMMENDATION_FRESH_MS + 1);
    expect(peekV2RecommendationContext('a')).not.toBeNull();
    expect(isV2RecommendationContextFresh('a')).toBe(false);
    (Date.now as jest.Mock).mockRestore();
  });

  it('is no longer fresh once a practice has been recorded', () => {
    rememberV2RecommendationContext('a', context('a'));
    useSessionStore.setState({ lastSession: { id: 'session-after-fetch' } as never });
    expect(isV2RecommendationContextFresh('a')).toBe(false);
    expect(peekV2RecommendationContext('a')).not.toBeNull();
  });

  it('also indexes the context under the server Anchor id', () => {
    rememberV2RecommendationContext('local-a', context('server-a'));
    expect(peekV2RecommendationContext('server-a')?.anchorId).toBe('server-a');
  });

  it('forgets one Anchor or everything on invalidation', () => {
    rememberV2RecommendationContext('a', context('a'));
    rememberV2RecommendationContext('b', context('b'));
    invalidateV2RecommendationContext('a');
    expect(peekV2RecommendationContext('a')).toBeNull();
    expect(peekV2RecommendationContext('b')).not.toBeNull();
    invalidateV2RecommendationContext();
    expect(peekV2RecommendationContext('b')).toBeNull();
  });
});
