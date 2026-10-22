import { renderHook, act } from '@testing-library/react-native';
import { Image } from 'react-native';
import { useHomePrewarm } from '../useHomePrewarm';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { prefetchV2RecommendationContext } from '@/adapters/v2/practice/recommendationClient';
import { prefetchV2Vision } from '@/hooks/v2/vision';
import { loadAnchorChart } from '@/hooks/v2/chart/useAnchorChart';

jest.mock('@/adapters/v2/practice/recommendationClient', () => ({
  prefetchV2RecommendationContext: jest.fn(() => Promise.resolve(null)),
  fetchV2RecommendationContextBatch: jest.fn(() => Promise.resolve([])),
}));
jest.mock('@/hooks/v2/vision', () => ({
  prefetchV2Vision: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({
  loadAnchorChart: jest.fn(() => Promise.resolve({})),
}));

describe('useHomePrewarm', () => {
  const prefetchImageSpy = jest.spyOn(Image, 'prefetch').mockImplementation(() => Promise.resolve(true));

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('prewarms current and adjacent anchors immediately', () => {
    const anchors = [
      makeAnchor({ id: 'a0', enhancedImageUrl: 'https://img.test/a0.png' }),
      makeAnchor({ id: 'a1', enhancedImageUrl: 'https://img.test/a1.png' }),
      makeAnchor({ id: 'a2', enhancedImageUrl: 'https://img.test/a2.png' }),
      makeAnchor({ id: 'a3', enhancedImageUrl: 'https://img.test/a3.png' }),
    ];

    renderHook(() => useHomePrewarm(anchors, 1));

    // For index 1: immediate window is [a1 (current), a2 (next), a0 (prev)]
    expect(prefetchV2RecommendationContext).toHaveBeenCalledWith('a1', expect.any(Object));
    expect(prefetchV2RecommendationContext).toHaveBeenCalledWith('a2', expect.any(Object));
    expect(prefetchV2RecommendationContext).toHaveBeenCalledWith('a0', expect.any(Object));
    expect(prefetchV2RecommendationContext).not.toHaveBeenCalledWith('a3', expect.any(Object));

    expect(prefetchV2Vision).toHaveBeenCalledWith('a1', expect.any(Object));
    expect(prefetchV2Vision).toHaveBeenCalledWith('a2', expect.any(Object));
    expect(prefetchV2Vision).toHaveBeenCalledWith('a0', expect.any(Object));

    expect(loadAnchorChart).toHaveBeenCalledWith('a1');
    expect(loadAnchorChart).toHaveBeenCalledWith('a2');
    expect(loadAnchorChart).toHaveBeenCalledWith('a0');

    expect(prefetchImageSpy).toHaveBeenCalledWith('https://img.test/a1.png');
    expect(prefetchImageSpy).toHaveBeenCalledWith('https://img.test/a2.png');
    expect(prefetchImageSpy).toHaveBeenCalledWith('https://img.test/a0.png');
  });

  it('prewarms next + 2 after settle delay', () => {
    const anchors = [
      makeAnchor({ id: 'a0' }),
      makeAnchor({ id: 'a1' }),
      makeAnchor({ id: 'a2' }),
      makeAnchor({ id: 'a3' }),
    ];

    renderHook(() => useHomePrewarm(anchors, 1));

    expect(prefetchV2RecommendationContext).not.toHaveBeenCalledWith('a3', expect.any(Object));

    // Fast-forward settle timer (400ms)
    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(prefetchV2RecommendationContext).toHaveBeenCalledWith('a3', expect.any(Object));
    expect(prefetchV2Vision).toHaveBeenCalledWith('a3', expect.any(Object));
    expect(loadAnchorChart).toHaveBeenCalledWith('a3');
  });

  it('handles single anchor without crashing or duplicate calls', () => {
    const anchors = [makeAnchor({ id: 'solo' })];

    renderHook(() => useHomePrewarm(anchors, 0));

    expect(prefetchV2RecommendationContext).toHaveBeenCalledTimes(1);
    expect(prefetchV2RecommendationContext).toHaveBeenCalledWith('solo', expect.any(Object));
  });

  it('handles empty anchor list safely', () => {
    renderHook(() => useHomePrewarm([], -1));

    expect(prefetchV2RecommendationContext).not.toHaveBeenCalled();
    expect(prefetchV2Vision).not.toHaveBeenCalled();
    expect(loadAnchorChart).not.toHaveBeenCalled();
  });
});
