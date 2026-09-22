import { act, renderHook } from '@testing-library/react-native';
import {
  nextVisionPresentation, useVisionPresentationQueue, VISION_REVEAL_TIMING as R,
} from '../useVisionPresentationQueue';

const candidate = (index: number, imageUrl: string | null = `https://cdn.example.com/${index}.jpg`) => ({
  id: `c${index}`, imageUrl, sortOrder: index,
});

const STEP = R.enterMs + R.dwellMs;

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

describe('nextVisionPresentation', () => {
  it('takes images in the set order, skipping handled or unresolved ones', () => {
    const list = [candidate(2), candidate(0), candidate(1, null)];
    expect(nextVisionPresentation(list, new Set())?.id).toBe('c0');
    expect(nextVisionPresentation(list, new Set(['c0']))?.id).toBe('c2');
    expect(nextVisionPresentation(list, new Set(['c0', 'c2']))).toBeNull();
  });
});

describe('useVisionPresentationQueue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('presents images that arrive together one at a time, in order', async () => {
    const prefetch = jest.fn(async () => true);
    const { result, rerender } = renderHook(
      ({ list }) => useVisionPresentationQueue('job-1', list, { reduceMotion: false, prefetch }),
      { initialProps: { list: [] as ReturnType<typeof candidate>[] } },
    );
    // Three images land in the same poll, milliseconds apart.
    rerender({ list: [candidate(0), candidate(1), candidate(2)] });
    await flush();
    expect(result.current.presented.map(item => item.id)).toEqual(['c0']);
    expect(result.current.idle).toBe(false);

    await act(async () => { jest.advanceTimersByTime(STEP - 1); });
    await flush();
    expect(result.current.presented.map(item => item.id)).toEqual(['c0']);

    await act(async () => { jest.advanceTimersByTime(1); });
    await flush();
    expect(result.current.presented.map(item => item.id)).toEqual(['c0', 'c1']);

    await act(async () => { jest.advanceTimersByTime(STEP); });
    await flush();
    expect(result.current.presented.map(item => item.id)).toEqual(['c0', 'c1', 'c2']);

    await act(async () => { jest.advanceTimersByTime(STEP); });
    await flush();
    expect(result.current.idle).toBe(true);
    expect(prefetch).toHaveBeenCalledTimes(3);
  });

  it('shows images a job already had without replaying them', async () => {
    const prefetch = jest.fn(async () => true);
    const { result } = renderHook(() =>
      useVisionPresentationQueue('job-2', [candidate(0), candidate(1)], { reduceMotion: false, prefetch }));
    await flush();
    expect(result.current.presented.map(item => item.id)).toEqual(['c0', 'c1']);
    expect(result.current.idle).toBe(true);
  });

  it('never presents an image that could not be decoded, and moves on', async () => {
    const prefetch = jest.fn(async (uri: string) => !uri.endsWith('/0.jpg'));
    const { result, rerender } = renderHook(
      ({ list }) => useVisionPresentationQueue('job-3', list, { reduceMotion: false, prefetch }),
      { initialProps: { list: [] as ReturnType<typeof candidate>[] } },
    );
    rerender({ list: [candidate(0), candidate(1)] });
    await flush();
    await flush();
    expect(result.current.presented.map(item => item.id)).toEqual(['c1']);
  });

  it('starts fresh for a new set', async () => {
    const prefetch = jest.fn(async () => true);
    const { result, rerender } = renderHook(
      ({ job, list }) => useVisionPresentationQueue(job, list, { reduceMotion: false, prefetch }),
      { initialProps: { job: 'job-a', list: [candidate(0)] } },
    );
    await flush();
    expect(result.current.presented).toHaveLength(1);
    rerender({ job: 'job-b', list: [] });
    await flush();
    expect(result.current.presented).toHaveLength(0);
    expect(result.current.idle).toBe(true);
  });
});
