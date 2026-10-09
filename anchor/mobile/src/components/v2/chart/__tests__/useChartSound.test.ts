import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { CHART_AIR_DUCKED, CHART_AIR_VOLUME, useChartSound } from '../useChartSound';

type Player = { key: string; opts: { loop?: boolean; volume?: number }; play: jest.Mock; stop: jest.Mock; setVolume: jest.Mock; setRate: jest.Mock; pause: jest.Mock };

let mockEnabled = true;
const mockPlayers: Player[] = [];
const mockPooledCalls: Array<{ key: string; options: { volume?: number; rate?: number } }> = [];
const mockPrewarm = jest.fn();
const mockSoundPoolPlay = jest.fn((key: string, options: { volume?: number; rate?: number } = {}) => {
  if (!mockEnabled) return null;
  mockPooledCalls.push({ key, options });
  return { stop: jest.fn() };
});
jest.mock('@/services/audio/SoundPool', () => ({
  SoundPool: { play: (...args: [string, { volume?: number; rate?: number }?]) => mockSoundPoolPlay(...args), prewarm: (...args: [string[]]) => mockPrewarm(...args), releaseIdle: jest.fn() },
}));
jest.mock('@/hooks/useAudio', () => ({
  useAudio: () => ({
    createManagedPlayer: (key: string, opts: { loop?: boolean; volume?: number } = {}) => {
      if (!mockEnabled) return null;
      const player = { key, opts, play: jest.fn(), stop: jest.fn(), setVolume: jest.fn(), setRate: jest.fn(), pause: jest.fn() };
      mockPlayers.push(player);
      return player;
    },
    playSound: jest.fn(),
  }),
}));

const lastVolume = (p: Player) => p.setVolume.mock.calls[p.setVolume.mock.calls.length - 1]?.[0];

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  mockEnabled = true;
  mockPlayers.length = 0;
  mockPooledCalls.length = 0;
  mockSoundPoolPlay.mockClear();
  mockPrewarm.mockClear();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('useChartSound', () => {
  it('prewarms every registered authored Chart celebration cue', () => {
    renderHook(() => useChartSound(false));
    expect(mockPrewarm).toHaveBeenCalledWith(expect.arrayContaining([
      'chart-waypoint_1', 'chart-waypoint_2', 'chart-waypoint_3',
      'chart-move-done', 'chart-ink-hold', 'chart-summit-thud', 'chart-summit-chord',
    ]));
  });

  it('plays each beat once, with a small random rate on repeating one-shots', () => {
    const { result } = renderHook(() => useChartSound(false));
    act(() => {
      result.current.open();
      result.current.flag();
      result.current.check();
      result.current.wind();
    });
    expect(mockPooledCalls.map(({ key }) => key)).toEqual(['chart-open', 'chart-flag', 'chart-move-done', 'chart-wind']);
    const rate = mockPooledCalls[2].options.rate!;
    expect(rate).toBeGreaterThanOrEqual(0.97);
    expect(rate).toBeLessThanOrEqual(1.03);
  });

  it('a long pen stroke gets a second, softer pass at 45% of the draw; a short one does not', () => {
    const { result } = renderHook(() => useChartSound(false));
    act(() => result.current.ink(850));
    expect(mockPooledCalls.map(({ key }) => key)).toEqual(['chart-ink']);
    act(() => jest.advanceTimersByTime(Math.ceil(850 * 0.45)));
    expect(mockPooledCalls.map(({ key }) => key)).toEqual(['chart-ink', 'chart-ink']);
    expect(mockPooledCalls[1].options.volume).toBe(0.75);
    mockPooledCalls.length = 0;
    act(() => result.current.ink(400));
    act(() => jest.advanceTimersByTime(1000));
    expect(mockPooledCalls.map(({ key }) => key)).toEqual(['chart-ink']);
  });

  it('creates no players at all when sound effects are off', () => {
    mockEnabled = false;
    const { result } = renderHook(() => useChartSound(false));
    expect(() =>
      act(() => {
        result.current.startAir();
        result.current.open();
        result.current.ink(850);
        result.current.stamp();
        result.current.stopAir();
      })
    ).not.toThrow();
    act(() => jest.advanceTimersByTime(3000));
    expect(mockPlayers).toHaveLength(0);
    expect(mockPooledCalls).toHaveLength(0);
  });

  it('Reduce Motion drops open and wind but keeps the other one-shots', () => {
    const { result } = renderHook(() => useChartSound(true));
    act(() => {
      result.current.open();
      result.current.wind();
      result.current.check();
      result.current.stamp();
    });
    expect(mockPooledCalls.map(({ key }) => key)).toEqual(['chart-move-done', 'chart-stamp']);
  });

  it('uses the three authored waypoint cues in order and clamps later waypoints to the third cue', () => {
    const { result } = renderHook(() => useChartSound(false));
    act(() => {
      result.current.note(1);
      result.current.note(2);
      result.current.note(3);
      result.current.note(4);
    });
    expect(mockPooledCalls.map(({ key }) => key)).toEqual(['chart-waypoint_1', 'chart-waypoint_2', 'chart-waypoint_3', 'chart-waypoint_3']);
  });

  it('Reduce Motion keeps the waypoint note (it marks the commitment, not motion)', () => {
    const { result } = renderHook(() => useChartSound(true));
    act(() => result.current.note(2));
    expect(mockPooledCalls.map(({ key }) => key)).toEqual(['chart-waypoint_2']);
  });

  it('allows the intro open cue under Reduce Motion when explicitly requested', () => {
    const { result } = renderHook(() => useChartSound(true, { playOpenWhenReducedMotion: true }));
    act(() => result.current.open());
    expect(mockPooledCalls.map(({ key }) => key)).toEqual(['chart-open']);
  });

  it('startAir is idempotent: one looping bed that ramps in to 0.9 over 800ms', () => {
    const { result } = renderHook(() => useChartSound(false));
    act(() => result.current.startAir());
    act(() => result.current.startAir());
    const beds = mockPlayers.filter((p) => p.key === 'chart-air');
    expect(beds).toHaveLength(1);
    expect(beds[0].opts).toMatchObject({ loop: true, volume: 0 });
    act(() => jest.advanceTimersByTime(400));
    expect(lastVolume(beds[0])).toBeLessThan(CHART_AIR_VOLUME);
    act(() => jest.advanceTimersByTime(500));
    expect(lastVolume(beds[0])).toBeCloseTo(CHART_AIR_VOLUME);
  });

  it('uses an intro-specific 600ms air fade without changing the default ramp', () => {
    const { result } = renderHook(() => useChartSound(false, { airFadeInMs: 600 }));
    act(() => result.current.startAir());
    const bed = mockPlayers[0];
    act(() => jest.advanceTimersByTime(600));
    expect(lastVolume(bed)).toBeCloseTo(CHART_AIR_VOLUME);
  });

  it('stopAir fades the bed out over 400ms, then stops it', () => {
    const { result } = renderHook(() => useChartSound(false));
    act(() => result.current.startAir());
    act(() => jest.advanceTimersByTime(900));
    const bed = mockPlayers[0];
    act(() => result.current.stopAir());
    act(() => jest.advanceTimersByTime(300));
    expect(bed.stop).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(200));
    expect(lastVolume(bed)).toBeCloseTo(0);
    expect(bed.stop).toHaveBeenCalledTimes(1);
  });

  it('stopping during a duck hold cannot be undone by the pending volume recovery', () => {
    const { result } = renderHook(() => useChartSound(false));
    act(() => result.current.startAir());
    act(() => jest.advanceTimersByTime(900));
    const bed = mockPlayers[0];
    act(() => result.current.duck(1300));
    act(() => jest.advanceTimersByTime(1200));
    act(() => result.current.stopAir());
    act(() => jest.advanceTimersByTime(2000));
    expect(lastVolume(bed)).toBeCloseTo(0);
    expect(bed.stop).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('a late ceremony cannot restart a bed that is already fading out', () => {
    const { result } = renderHook(() => useChartSound(false));
    act(() => result.current.startAir());
    act(() => jest.advanceTimersByTime(900));
    const bed = mockPlayers[0];
    act(() => result.current.stopAir());
    act(() => jest.advanceTimersByTime(100));
    act(() => result.current.stamp());
    act(() => jest.advanceTimersByTime(3000));
    expect(lastVolume(bed)).toBeCloseTo(0);
    expect(bed.stop).toHaveBeenCalledTimes(1);
  });

  it('backgrounding immediately stops the loop and cancels its pending duck return', () => {
    let onState: ((state: AppStateStatus) => void) | undefined;
    const remove = jest.fn();
    const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
      onState = callback;
      return { remove };
    });
    const { result, unmount } = renderHook(() => useChartSound(false));
    act(() => result.current.startAir());
    act(() => jest.advanceTimersByTime(900));
    const bed = mockPlayers[0];
    act(() => result.current.duck(1300));
    act(() => jest.advanceTimersByTime(150));
    act(() => onState?.('background'));
    expect(bed.stop).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    act(() => onState?.('active'));
    expect(bed.play).toHaveBeenCalledTimes(1);
    unmount();
    expect(remove).toHaveBeenCalledTimes(1);
    listener.mockRestore();
  });

  it('a stamp ducks the bed to 0.45 and brings it back to 0.9', () => {
    const { result } = renderHook(() => useChartSound(false));
    act(() => result.current.startAir());
    act(() => jest.advanceTimersByTime(900));
    const bed = mockPlayers[0];
    act(() => result.current.stamp());
    act(() => jest.advanceTimersByTime(150));
    expect(lastVolume(bed)).toBeCloseTo(CHART_AIR_DUCKED);
    // Held through the ceremony (down 120ms + hold 1300ms), then back up over 600ms.
    act(() => jest.advanceTimersByTime(1200));
    expect(lastVolume(bed)).toBeCloseTo(CHART_AIR_DUCKED);
    act(() => jest.advanceTimersByTime(800));
    expect(lastVolume(bed)).toBeCloseTo(CHART_AIR_VOLUME);
  });

  it('the summit plays the authored thud at the flag and the chord 20ms later, also under Reduce Motion', () => {
    for (const reduced of [false, true]) {
      mockPooledCalls.length = 0;
      const { result, unmount } = renderHook(() => useChartSound(reduced));
      act(() => result.current.summit());
      expect(mockPooledCalls.map(({ key }) => key)).toEqual(['chart-summit-thud']);
      act(() => jest.advanceTimersByTime(20));
      expect(mockPooledCalls.map(({ key }) => key)).toEqual(['chart-summit-thud', 'chart-summit-chord']);
      unmount();
    }
  });

  it('plays the move completion and ink-hold cues at their distinct semantic beats', () => {
    const { result } = renderHook(() => useChartSound(false));
    act(() => { result.current.check(); result.current.inkHold(); });
    expect(mockPooledCalls.map(({ key }) => key)).toEqual(['chart-move-done', 'chart-ink-hold']);
  });

  it('hush silences the bed and brings it back; a later duck replaces the pending return instead of being undone by it', () => {
    const { result } = renderHook(() => useChartSound(false));
    act(() => result.current.startAir());
    act(() => jest.advanceTimersByTime(900));
    const bed = mockPlayers[0];
    act(() => result.current.hush(600));
    act(() => jest.advanceTimersByTime(150));
    expect(lastVolume(bed)).toBeCloseTo(0);
    // The summit lands inside the hush: its own duck takes over, so the hush's return never fires on top of it.
    act(() => jest.advanceTimersByTime(300));
    act(() => result.current.summit());
    act(() => jest.advanceTimersByTime(300));
    expect(lastVolume(bed)).toBeCloseTo(CHART_AIR_DUCKED);
    act(() => jest.advanceTimersByTime(1500));
    expect(lastVolume(bed)).toBeCloseTo(CHART_AIR_DUCKED);
    act(() => jest.advanceTimersByTime(1500));
    expect(lastVolume(bed)).toBeCloseTo(CHART_AIR_VOLUME);
  });

  it('unmounting stops the bed and leaves no timers', () => {
    const { result, unmount } = renderHook(() => useChartSound(false));
    act(() => {
      result.current.startAir();
      result.current.ink(900);
    });
    const bed = mockPlayers[0];
    unmount();
    expect(bed.stop).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('fades the intro-owned bed on unmount instead of cutting it off', () => {
    const { result, unmount } = renderHook(() => useChartSound(false, { fadeAirOnUnmount: true }));
    act(() => result.current.startAir());
    act(() => jest.advanceTimersByTime(600));
    const bed = mockPlayers[0];
    unmount();
    expect(bed.stop).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(400));
    expect(lastVolume(bed)).toBeCloseTo(0);
    expect(bed.stop).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
