import { renderHook } from '@testing-library/react-native';
import { Image } from 'react-native';
import { useHomePrewarm } from '../useHomePrewarm';
import { makeAnchor } from '@/adapters/v2/home/__tests__/fixtures';
import { prefetchV2RecommendationContext } from '@/adapters/v2/practice/recommendationClient';
import { hydrateV2RecommendationContext } from '@/adapters/v2/practice/recommendationCache';
import { loadAnchorChart } from '@/hooks/v2/chart/useAnchorChart';

jest.mock('@/adapters/v2/practice/recommendationClient', () => ({ prefetchV2RecommendationContext: jest.fn(() => Promise.resolve(null)) }));
jest.mock('@/adapters/v2/practice/recommendationCache', () => ({ hydrateV2RecommendationContext: jest.fn(() => Promise.resolve(null)) }));
jest.mock('@/hooks/v2/vision', () => ({ prefetchV2Vision: jest.fn(() => Promise.resolve(null)) }));
jest.mock('@/hooks/v2/chart/useAnchorChart', () => ({ loadAnchorChart: jest.fn(() => Promise.resolve({})) }));

const anchors = Array.from({ length: 8 }, (_, index) => makeAnchor({ id: `a${index}`, enhancedImageUrl: `https://img.test/a${index}.png` }));
const warmed = () => jest.mocked(prefetchV2RecommendationContext).mock.calls.map(([id]) => id);
beforeEach(() => { jest.clearAllMocks(); jest.spyOn(Image, 'prefetch').mockResolvedValue(true); });

it.each(['high', 'medium'] as const)('immediately warms all five mounted Anchors on %s tier', tier => {
  renderHook(() => useHomePrewarm(anchors, 0, tier));
  expect(warmed()).toEqual(['a0', 'a1', 'a7', 'a2', 'a6']);
  expect(jest.mocked(hydrateV2RecommendationContext).mock.calls.map(([id]) => id)).toEqual(warmed());
  expect(jest.mocked(loadAnchorChart).mock.calls.map(([id]) => id)).toEqual(warmed());
  expect(Image.prefetch).toHaveBeenCalledTimes(5);
});

it('keeps the low tier at three visible Anchors', () => {
  renderHook(() => useHomePrewarm(anchors, 0, 'low'));
  expect(warmed()).toEqual(['a0', 'a1', 'a7']);
});

it.each([1, 2, 4])('warms each Anchor only once in a vault of %i', count => {
  renderHook(() => useHomePrewarm(anchors.slice(0, count), 0, 'high'));
  expect(new Set(warmed()).size).toBe(count);
  expect(warmed()).toHaveLength(count);
});

it('does not restart the window when cached strength replaces summary objects', () => {
  const { rerender } = renderHook(({ items }) => useHomePrewarm(items, 0, 'high'), { initialProps: { items: anchors } });
  const count = warmed().length;
  rerender({ items: anchors.map(anchor => ({ ...anchor, threadStrength: 68 })) });
  expect(warmed()).toHaveLength(count);
});

it('keeps shared recommendation requests alive when the visual center moves', () => {
  const { rerender } = renderHook(({ index }) => useHomePrewarm(anchors, index, 'high'), { initialProps: { index: 0 } });
  rerender({ index: 1 });
  expect(jest.mocked(prefetchV2RecommendationContext).mock.calls.every(call => call[1] === undefined)).toBe(true);
  expect(warmed().slice(5)).toEqual(['a1', 'a2', 'a0', 'a3', 'a7']);
});
