import { act, renderHook } from '@testing-library/react-native';
import { CHART_AIR_DUCKED, CHART_AIR_VOLUME, CHART_SUMMIT_CHORD, CHART_WAYPOINT_NOTE, useChartSound, waypointNoteRate } from '../useChartSound';

type Player = { key: string; opts: { loop?: boolean; volume?: number }; play: jest.Mock; stop: jest.Mock; setVolume: jest.Mock; setRate: jest.Mock; pause: jest.Mock };

let mockEnabled = true;
const mockPlayers: Player[] = [];
const mockPooledCalls: Array<{ key: string; options: { volume?: number; rate?: number } }> = [];
const mockSoundPoolPlay = jest.fn((key: string, options: { volume?: number; rate?: number } = {}) => {
  if (!mockEnabled) return null;
  mockPooledCalls.push({ key, options });
  return { stop: jest.fn() };
});
jest.mock('@/services/audio/SoundPool', () => ({
  SoundPool: { play: (...args: [string, { volume?: number; rate?: number }?]) => mockSoundPoolPlay(...args), prewarm: jest.fn(), releaseIdle: jest.fn() },
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
  mockEnabled = true;
  mockPlayers.length = 0;
  mockPooledCalls.length = 0;
  mockSoundPoolPlay.mockClear();
});
afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('useChartSound', () => {
  it('plays each beat once, with a small random rate on repeating one-shots', () => {
    const { result } = renderHook(() => useChartSound(false));
    act(() => {
      result.current.open();
      result.current.flag();
      result.current.check();
      result.current.wind();
    });
    expect(mockPooledCalls.map(({ key }) => key)).toEqual(['chart-open', 'chart-flag', 'chart-check', 'chart-wind']);
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
    expect(mockPooledCalls.map(({ key }) => key)).toEqual(['chart-check', 'chart-stamp']);
  });

  it('the waypoint note is the chart-flag cue at the pentatonic rate: C#5 0.8409, E5 1, F#5 1.1225, then climbing', () => {
    const { result } = renderHook(() => useChartSound(false));
    act(() => {
      result.current.note(1);
      result.current.note(2);
      result.current.note(3);
      result.current.note(4);
    });
    expect(mockPooledCalls.map(({ key }) => key)).toEqual(['chart-flag', 'chart-flag', 'chart-flag', 'chart-flag']);
    const rates = mockPooledCalls.map(({ options }) => options.rate!);
    expect(rates[0]).toBeCloseTo(0.8409, 4);
    expect(rates[1]).toBe(1);
    expect(rates[2]).toBeCloseTo(1.1225, 4);
    expect(rates[3]).toBeCloseTo(Math.pow(2, 5 / 12), 6);
    // Exact pitch: the note takes no random jitter (a repeat of one waypoint sounds identical).
    mockPooledCalls.length = 0;
    act(() => { result.current.note(1); result.current.note(1); });
    expect(mockPooledCalls[0].options.rate).toBe(mockPooledCalls[1].options.rate);
  });

  it('the pitch lives in one constants object; later waypoints hold the last step; the rate stays inside the pool clamp', () => {
    expect(CHART_WAYPOINT_NOTE.basePitch).toBe('E5');
    expect(CHART_WAYPOINT_NOTE.semitones.slice(0, 3)).toEqual([-3, 0, 2]);
    expect(waypointNoteRate(1)).toBeCloseTo(2 ** (-3 / 12));
    expect(waypointNoteRate(99)).toBe(waypointNoteRate(CHART_WAYPOINT_NOTE.semitones.length));
    expect(waypointNoteRate(0)).toBe(waypointNoteRate(1));
    for (let n = 1; n <= 12; n++) {
      expect(waypointNoteRate(n)).toBeGreaterThanOrEqual(0.5);
      expect(waypointNoteRate(n)).toBeLessThanOrEqual(2);
    }
  });

  it('Reduce Motion keeps the waypoint note (it marks the commitment, not motion)', () => {
    const { result } = renderHook(() => useChartSound(true));
    act(() => result.current.note(2));
    expect(mockPooledCalls.map(({ key }) => key)).toEqual(['chart-flag']);
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

  it('the summit plays the thud and the chord stand-in once each, also under Reduce Motion, with no wind', () => {
    for (const reduced of [false, true]) {
      mockPooledCalls.length = 0;
      const { result, unmount } = renderHook(() => useChartSound(reduced));
      act(() => result.current.summit());
      expect(mockPooledCalls.map(({ key }) => key)).toEqual(['chart-stamp', 'chart-flag']);
      expect(mockPooledCalls[1].options.rate).toBeCloseTo(Math.pow(2, CHART_SUMMIT_CHORD.standInSemitones / 12));
      unmount();
    }
    expect(CHART_SUMMIT_CHORD.voices).toEqual(['A3', 'E4', 'A4', 'C#5', 'E5']);
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
