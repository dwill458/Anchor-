import {
  DevOrientationMode,
  getDevOrientationMode,
  initDevOrientation,
  isScreenOrientationAvailable,
  setDevOrientation,
  subscribeDevOrientation,
  toggleDevOrientation,
} from '../devOrientation';

// Mock expo-screen-orientation
jest.mock('expo-screen-orientation', () => ({
  OrientationLock: {
    DEFAULT: 0,
    ALL: 1,
    PORTRAIT_UP: 3,
    LANDSCAPE: 5,
  },
  unlockAsync: jest.fn().mockResolvedValue(undefined),
  lockAsync: jest.fn().mockResolvedValue(undefined),
  getOrientationLockAsync: jest.fn().mockResolvedValue(0),
}));

describe('devOrientation', () => {
  const ScreenOrientation = require('expo-screen-orientation');

  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).__DEV__ = true;
  });

  it('detects screen orientation availability when native module is present', async () => {
    const available = await isScreenOrientationAvailable();
    expect(available).toBe(true);
    expect(ScreenOrientation.getOrientationLockAsync).toHaveBeenCalled();
  });

  it('sets dev orientation to landscape', async () => {
    const result = await setDevOrientation('landscape');
    expect(result.ok).toBe(true);
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith(
      ScreenOrientation.OrientationLock.LANDSCAPE
    );
    expect(getDevOrientationMode()).toBe('landscape');
  });

  it('sets dev orientation to portrait', async () => {
    const result = await setDevOrientation('portrait');
    expect(result.ok).toBe(true);
    expect(ScreenOrientation.lockAsync).toHaveBeenCalledWith(
      ScreenOrientation.OrientationLock.PORTRAIT_UP
    );
    expect(getDevOrientationMode()).toBe('portrait');
  });

  it('sets dev orientation to sensor (unlocks orientation)', async () => {
    const result = await setDevOrientation('sensor');
    expect(result.ok).toBe(true);
    expect(ScreenOrientation.unlockAsync).toHaveBeenCalled();
    expect(getDevOrientationMode()).toBe('sensor');
  });

  it('toggles between portrait and landscape', async () => {
    await setDevOrientation('portrait');
    const toggle1 = await toggleDevOrientation();
    expect(toggle1.ok).toBe(true);
    expect(toggle1.mode).toBe('landscape');
    expect(getDevOrientationMode()).toBe('landscape');

    const toggle2 = await toggleDevOrientation();
    expect(toggle2.ok).toBe(true);
    expect(toggle2.mode).toBe('portrait');
    expect(getDevOrientationMode()).toBe('portrait');
  });

  it('notifies subscribers on orientation change', async () => {
    const listener = jest.fn();
    const unsubscribe = subscribeDevOrientation(listener);

    await setDevOrientation('landscape');
    expect(listener).toHaveBeenCalledWith('landscape');

    unsubscribe();
    await setDevOrientation('portrait');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('strictly blocks dev orientation changes in production (!__DEV__)', async () => {
    (global as any).__DEV__ = false;
    const result = await setDevOrientation('landscape');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Orientation overrides are disabled in production builds');
    expect(ScreenOrientation.lockAsync).not.toHaveBeenCalled();
  });

  it('initDevOrientation unlocks orientation to sensor in dev', () => {
    initDevOrientation();
    expect(ScreenOrientation.unlockAsync).toHaveBeenCalled();
  });
});
