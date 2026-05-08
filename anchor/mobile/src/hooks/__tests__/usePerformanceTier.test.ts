/**
 * Tests for usePerformanceTier.
 *
 * Strategy:
 * - detectDeviceTier() runs synchronously in useState(), so result.current
 *   is correct immediately after renderHook() without any await.
 * - For async signals (battery, reduce-motion), we flush pending promises
 *   with act(async () => Promise.resolve()) before asserting.
 */
import { renderHook, act } from '@testing-library/react-hooks';
import { Platform, PixelRatio, AccessibilityInfo } from 'react-native';
import { usePerformanceTier, tierPolicy } from '../usePerformanceTier';

// ── Mocks ─────────────────────────────────────────────────────────────────────

let mockIsReduceMotionEnabled: jest.Mock;
let mockAddAccessibilityListener: jest.Mock;
let mockPixelRatioGet: jest.SpiedFunction<typeof PixelRatio.get>;
const mockGetPowerStateAsync = jest.fn().mockResolvedValue({ lowPowerMode: false });
const mockAddLowPowerModeListener = jest.fn().mockReturnValue({ remove: jest.fn() });

jest.mock('expo-battery', () => ({
  getPowerStateAsync: mockGetPowerStateAsync,
  addLowPowerModeListener: mockAddLowPowerModeListener,
}), { virtual: true });

jest.mock('expo-device', () => ({
  deviceYearClass: null,
  totalMemory: null,
  brand: null,
  manufacturer: null,
  modelName: null,
  designName: null,
}), { virtual: true });

// Helpers
const flushAsync = () => act(async () => { await Promise.resolve(); });

const setOS = (os: string, version: number | string = 17) => {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  Object.defineProperty(Platform, 'Version', { value: version, configurable: true });
};
const setPixelRatio = (ratio: number) =>
  mockPixelRatioGet.mockReturnValue(ratio);

const expoDevice = () => require('expo-device');
const setDeviceYearClass = (year: number | null) =>
  jest.replaceProperty(expoDevice(), 'deviceYearClass', year);
const setTotalMemory = (bytes: number | null) =>
  jest.replaceProperty(expoDevice(), 'totalMemory', bytes);
const setBrand = (brand: string | null) =>
  jest.replaceProperty(expoDevice(), 'brand', brand);
const setManufacturer = (manufacturer: string | null) =>
  jest.replaceProperty(expoDevice(), 'manufacturer', manufacturer);
const setModelName = (modelName: string | null) =>
  jest.replaceProperty(expoDevice(), 'modelName', modelName);
const setDesignName = (designName: string | null) =>
  jest.replaceProperty(expoDevice(), 'designName', designName);

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  mockIsReduceMotionEnabled = jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(false) as unknown as jest.Mock;
  mockAddAccessibilityListener = jest
    .spyOn(AccessibilityInfo, 'addEventListener')
    .mockReturnValue({ remove: jest.fn() } as any) as unknown as jest.Mock;
  mockPixelRatioGet = jest.spyOn(PixelRatio, 'get').mockReturnValue(3);
  mockGetPowerStateAsync.mockResolvedValue({ lowPowerMode: false });
  mockAddLowPowerModeListener.mockReturnValue({ remove: jest.fn() });
  setOS('ios');
  setPixelRatio(3);
  setDeviceYearClass(null);
  setTotalMemory(null);
  setBrand(null);
  setManufacturer(null);
  setModelName(null);
  setDesignName(null);
});

// ── Platform baseline (synchronous initial state) ─────────────────────────────

describe('platform baseline', () => {
  it('high for iOS', () => {
    setOS('ios');
    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current).toBe('high');
  });

  it('low for Android SDK < 29', () => {
    setOS('android', 28);
    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current).toBe('low');
  });

  it('medium for Android SDK 29–30', () => {
    setOS('android', 30);
    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current).toBe('medium');
  });

  it('high for Android SDK >= 31 + high pixel density', () => {
    setOS('android', 31);
    setPixelRatio(3);
    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current).toBe('high');
  });

  it('medium for Android SDK >= 31 + low pixel density', () => {
    setOS('android', 33);
    setPixelRatio(1.5);
    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current).toBe('medium');
  });
});

// ── expo-device year class (synchronous) ──────────────────────────────────────

describe('expo-device year class', () => {
  it('low for year class < 2019 on iOS', () => {
    setOS('ios');
    setDeviceYearClass(2017);
    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current).toBe('low');
  });

  it('medium for year class 2019–2020 on iOS', () => {
    setOS('ios');
    setDeviceYearClass(2020);
    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current).toBe('medium');
  });

  it('high for year class >= 2021 on iOS', () => {
    setOS('ios');
    setDeviceYearClass(2023);
    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current).toBe('high');
  });
});

// ── expo-device total memory (synchronous) ────────────────────────────────────

describe('expo-device total memory', () => {
  const GB = 1_073_741_824;

  it('low for < 2 GB RAM', () => {
    setOS('ios');
    setTotalMemory(1.5 * GB);
    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current).toBe('low');
  });

  it('medium for 2–3 GB RAM', () => {
    setOS('ios');
    setTotalMemory(2.5 * GB);
    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current).toBe('medium');
  });

  it('high for >= 3 GB RAM on iOS', () => {
    setOS('ios');
    setTotalMemory(6 * GB);
    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current).toBe('high');
  });
});

describe('known flagship Android models', () => {
  it('keeps Galaxy S24 Ultra classified as high', () => {
    setOS('android', 34);
    setPixelRatio(3.5);
    setBrand('samsung');
    setModelName('SM-S928U');
    setTotalMemory(1.5 * 1_073_741_824);

    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current).toBe('high');
  });

  it('keeps Pixel 9 Pro classified as high', () => {
    setOS('android', 35);
    setBrand('google');
    setModelName('Pixel 9 Pro');
    setDeviceYearClass(2020);

    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current).toBe('high');
  });
});

// ── Accessibility reduce-motion (async) ───────────────────────────────────────

describe('reduce-motion', () => {
  it('low when reduce-motion is enabled at mount', async () => {
    setOS('ios');
    mockIsReduceMotionEnabled.mockResolvedValue(true);
    const { result } = renderHook(() => usePerformanceTier());
    await flushAsync();
    expect(result.current).toBe('low');
  });

  it('responds live when reduce-motion is toggled on', async () => {
    setOS('ios');
    let listener: (v: boolean) => void = () => {};
    mockAddAccessibilityListener.mockImplementation(
      (_event: string, cb: (v: boolean) => void) => {
        listener = cb;
        return { remove: jest.fn() };
      },
    );
    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current).toBe('high');
    act(() => { listener(true); });
    expect(result.current).toBe('low');
  });

  it('recovers to high when reduce-motion is toggled back off', async () => {
    setOS('ios');
    let listener: (v: boolean) => void = () => {};
    mockAddAccessibilityListener.mockImplementation(
      (_event: string, cb: (v: boolean) => void) => {
        listener = cb;
        return { remove: jest.fn() };
      },
    );
    const { result } = renderHook(() => usePerformanceTier());
    act(() => { listener(true); });
    expect(result.current).toBe('low');
    act(() => { listener(false); });
    expect(result.current).toBe('high');
  });
});

// ── Battery low-power mode (async) ────────────────────────────────────────────

describe('battery low-power mode', () => {
  it('low when device starts in low-power mode', async () => {
    setOS('ios');
    mockGetPowerStateAsync.mockResolvedValue({ lowPowerMode: true });
    const { result } = renderHook(() => usePerformanceTier());
    await flushAsync();
    expect(result.current).toBe('low');
  });

  it('responds live to low-power mode changes', async () => {
    setOS('ios');
    let listener: (e: { lowPowerMode: boolean }) => void = () => {};
    mockAddLowPowerModeListener.mockImplementation(
      (cb: (e: { lowPowerMode: boolean }) => void) => {
        listener = cb;
        return { remove: jest.fn() };
      },
    );
    const { result } = renderHook(() => usePerformanceTier());
    expect(result.current).toBe('high');
    act(() => { listener({ lowPowerMode: true }); });
    expect(result.current).toBe('low');
    act(() => { listener({ lowPowerMode: false }); });
    expect(result.current).toBe('high');
  });
});

// ── Manual override ───────────────────────────────────────────────────────────

describe('override', () => {
  it("forces 'low' regardless of device signals", () => {
    setOS('ios');
    const { result } = renderHook(() => usePerformanceTier({ override: 'low' }));
    expect(result.current).toBe('low');
  });

  it("forces 'medium' even on a high-tier iOS device", () => {
    setOS('ios');
    const { result } = renderHook(() => usePerformanceTier({ override: 'medium' }));
    expect(result.current).toBe('medium');
  });

  it("'auto' defers to detected tier", () => {
    setOS('ios');
    const { result } = renderHook(() => usePerformanceTier({ override: 'auto' }));
    expect(result.current).toBe('high');
  });
});

// ── tierPolicy helper ─────────────────────────────────────────────────────────

describe('tierPolicy', () => {
  it('enables everything for high', () => {
    const p = tierPolicy('high');
    expect(p).toEqual({
      enableSkiaAura: true,
      enablePerFrameGlow: true,
      enableDashedRings: true,
      enableParticles: true,
      enableBlurViews: true,
      blurIntensity: 30,
      particleMultiplier: 1,
      rayMultiplier: 1,
    });
  });

  it('freezes per-frame effects for medium', () => {
    const p = tierPolicy('medium');
    expect(p.enableSkiaAura).toBe(true);
    expect(p.enablePerFrameGlow).toBe(false);
    expect(p.enableParticles).toBe(false);
    expect(p.blurIntensity).toBe(12);
  });

  it('disables everything for low', () => {
    const p = tierPolicy('low');
    expect(p.enableSkiaAura).toBe(false);
    expect(p.enableBlurViews).toBe(false);
    expect(p.blurIntensity).toBe(0);
    expect(p.particleMultiplier).toBe(0);
  });
});

// ── Cleanup ───────────────────────────────────────────────────────────────────

describe('cleanup', () => {
  it('removes both listeners on unmount', async () => {
    const removeSub = jest.fn();
    const removeBattery = jest.fn();
    mockAddAccessibilityListener.mockReturnValue({ remove: removeSub } as any);
    mockAddLowPowerModeListener.mockReturnValue({ remove: removeBattery } as any);

    const { unmount } = renderHook(() => usePerformanceTier());
    unmount();

    expect(removeSub).toHaveBeenCalled();
    expect(removeBattery).toHaveBeenCalled();
  });
});
