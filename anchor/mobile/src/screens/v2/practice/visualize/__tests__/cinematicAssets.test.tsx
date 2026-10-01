
import { Image } from 'react-native';
import { act, render } from '@testing-library/react-native';
import { Asset } from 'expo-asset';
import { useImage } from '@shopify/react-native-skia';
import type { V2VisionTile } from '@/adapters/v2/vision';
import { freezeCinematicTiles, useCinematicAssets } from '../cinematicAssets';

const mockUseImage = jest.fn();

jest.mock('expo-asset', () => ({ Asset: { loadAsync: jest.fn() } }));
jest.mock('@shopify/react-native-skia', () => ({ useImage: (...args: unknown[]) => mockUseImage(...args) }));
jest.mock('@/components/v2/vision/board/visionBoardLayouts', () => ({ VISION_BOARD_MAX_IMAGES: 6 }));

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => { resolve = resolvePromise; reject = rejectPromise; });
  return { promise, resolve, reject };
}

const tiles = (count: number): V2VisionTile[] => Array.from({ length: count }, (_, index) => ({
  id: `tile-${index}`, sceneId: `scene-${index}`, imageUrl: `https://vision.example/${index}.jpg`,
  prompt: `generation prompt ${index}`, sortOrder: index, isHero: index === 0,
}));

let latest: ReturnType<typeof useCinematicAssets>;
let decoded: Map<string, object>;
let imageFailures: Map<string, Array<() => void>>;
let prefetch: (uri: string) => Promise<boolean>;
let prefetchSpy: jest.SpyInstance;
let getSizeSpy: jest.SpyInstance;

function Harness({ input, enhancedImageUrl }: { input: V2VisionTile[]; enhancedImageUrl?: string }) {
  latest = useCinematicAssets(input, enhancedImageUrl);
  return latest.resources;
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function mount(input: V2VisionTile[]) {
  return render(<Harness input={input} />);
}

function mountWithEnhanced(input: V2VisionTile[], enhancedImageUrl: string) {
  return render(<Harness input={input} enhancedImageUrl={enhancedImageUrl} />);
}

describe('cinematic saved-asset readiness', () => {
  beforeEach(() => {
    decoded = new Map();
    imageFailures = new Map();
    prefetch = async () => true;
    prefetchSpy = jest.spyOn(Image, 'prefetch').mockImplementation(uri => prefetch(uri));
    getSizeSpy = jest.spyOn(Image, 'getSize').mockImplementation(((_uri: string, ok?: (width: number, height: number) => void) => {
      ok?.(1080, 1920);
    }) as never);
    jest.mocked(Asset.loadAsync).mockReset().mockResolvedValue([] as never);
    mockUseImage.mockReset().mockImplementation((uri: string, onError?: () => void) => {
      if (onError) imageFailures.set(uri, [...(imageFailures.get(uri) ?? []), onError]);
      return decoded.get(uri) ?? null;
    });
  });

  afterEach(() => {
    prefetchSpy.mockRestore();
    getSizeSpy.mockRestore();
    jest.useRealTimers();
  });

  it('keeps readiness closed and offers the decoded image when another prefetch hangs', async () => {
    jest.useFakeTimers();
    const board = deferred<unknown[]>();
    const first = deferred<boolean>();
    const second = deferred<boolean>();
    jest.mocked(Asset.loadAsync).mockReturnValue(board.promise as never);
    prefetch = uri => uri.endsWith('/0.jpg') ? first.promise : second.promise;
    const input = tiles(2);
    const view = mount(input);

    await act(async () => { board.resolve([]); first.resolve(true); await flushPromises(); });
    decoded.set(input[0].imageUrl!, {});
    await act(async () => { view.rerender(<Harness input={input} />); await flushPromises(); });
    expect(latest.available.map(tile => tile.sceneId)).toEqual(['scene-0']);
    expect(latest.ready).toBe(false);

    await act(async () => { jest.advanceTimersByTime(20_000); await flushPromises(); });
    expect(latest.partial).toBe(true);
    expect(latest.ready).toBe(false);
    expect(latest.unavailable).toBe(false);
    expect(latest.select(latest.available).tiles.map(tile => tile.sceneId)).toEqual(['scene-0']);
  });

  it('waits for Skia texture decode after native prefetch succeeds', async () => {
    const input = tiles(1);
    const view = mount(input);
    await act(async () => { await flushPromises(); });
    expect(latest.ready).toBe(false);
    expect(latest.available).toHaveLength(0);

    decoded.set(input[0].imageUrl!, {});
    await act(async () => { view.rerender(<Harness input={input} />); await flushPromises(); });
    expect(latest.ready).toBe(true);
    expect(latest.available.map(tile => tile.sceneId)).toEqual(['scene-0']);
  });

  it('never offers partial Continue when enhanced artwork is still decoding at timeout', async () => {
    jest.useFakeTimers();
    const input = tiles(2);
    const enhancedImageUrl = 'https://anchor.example/enhanced.jpg';
    const view = mountWithEnhanced(input, enhancedImageUrl);
    await act(async () => { await flushPromises(); });
    decoded.set(input[0].imageUrl!, {});
    await act(async () => { view.rerender(<Harness input={input} enhancedImageUrl={enhancedImageUrl} />); await flushPromises(); });
    imageFailures.get(input[1].imageUrl!)?.at(-1)?.();
    await act(async () => { jest.advanceTimersByTime(20_000); await flushPromises(); });

    expect(latest.available.map(tile => tile.sceneId)).toEqual(['scene-0']);
    expect(latest.enhancedReady).toBe(false);
    expect(latest.partial).toBe(false);
    expect(latest.unavailable).toBe(true);
    view.unmount();
  });

  it('rejects a low-byte image whose decoded pixel count exceeds the texture budget', async () => {
    const input = tiles(1);
    getSizeSpy.mockImplementation(((_uri: string, ok?: (width: number, height: number) => void) => {
      ok?.(4096, 4096);
    }) as never);
    const view = mount(input);
    await act(async () => { await flushPromises(); });

    expect(Image.prefetch).not.toHaveBeenCalled();
    expect(mockUseImage).not.toHaveBeenCalled();
    expect(latest.available).toHaveLength(0);
    expect(latest.ready).toBe(false);
    expect(latest.unavailable).toBe(true);
    view.unmount();
  });

  it('ignores prefetch and decoder failures delivered by an earlier retry generation', async () => {
    const oldPrefetch = deferred<boolean>();
    const newPrefetch = deferred<boolean>();
    let calls = 0;
    prefetch = () => (calls++ === 0 ? oldPrefetch.promise : newPrefetch.promise);
    const view = mount(tiles(1));
    await act(async () => { await flushPromises(); });
    const oldImageFailure = imageFailures.get('https://vision.example/0.jpg')?.[0];

    act(() => { latest.retry(); });
    await act(async () => { await flushPromises(); });
    await act(async () => { oldImageFailure?.(); oldPrefetch.resolve(false); await flushPromises(); });
    expect(latest.failedCount).toBe(0);
    expect(latest.available).toHaveLength(0);

    await act(async () => { newPrefetch.resolve(true); await flushPromises(); });
    decoded.set('https://vision.example/0.jpg', {});
    await act(async () => { view.rerender(<Harness input={tiles(1)} />); await flushPromises(); });
    expect(latest.ready).toBe(true);
  });

  it('reports unavailable when every saved image fails', async () => {
    prefetch = async () => false;
    const input = tiles(2);
    const view = mount(input);
    await act(async () => { await flushPromises(); });
    for (const tile of input) imageFailures.get(tile.imageUrl!)?.at(-1)?.();
    await act(async () => { await flushPromises(); });
    expect(latest.available).toHaveLength(0);
    expect(latest.failedCount).toBe(2);
    expect(latest.ready).toBe(false);
    expect(latest.unavailable).toBe(true);
    view.unmount();
  });

  it('does not call an empty board ready or allow a cinematic clock to start', async () => {
    const view = mount([]);
    await act(async () => { await flushPromises(); });
    expect(latest.available).toHaveLength(0);
    expect(latest.ready).toBe(false);
    expect(latest.unavailable).toBe(true);
    view.unmount();
  });

  it('freezes only saved image URLs and respects the six-image board limit', () => {
    const input = [...tiles(7), { ...tiles(1)[0], id: 'missing', sceneId: 'missing', imageUrl: null }];
    const frozen = freezeCinematicTiles(input);
    expect(frozen.map(tile => tile.sceneId)).toEqual(['scene-0', 'scene-1', 'scene-2', 'scene-3', 'scene-4', 'scene-5']);
    expect(frozen).not.toBe(input);
    expect(frozen[0]).not.toBe(input[0]);
  });
});
