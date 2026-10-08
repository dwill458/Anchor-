import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAudio, type ManagedAudioPlayer, type SoundKey } from '@/hooks/useAudio';
import { SoundPool } from '@/services/audio/SoundPool';

/**
 * Chart's sound world: paper, pen, brass and air (design/sound/chart). Short
 * cues use the shared pool; the looping air bed remains a managed player.
 *
 * - One-shots get a random +-3% rate so repeats never sound mechanical.
 * - The air bed is a single looping player per hook: `startAir` is idempotent,
 *   ramps in over 800 ms and `stopAir` ramps out over 400 ms. `duck` dips it
 *   under a ceremony and brings it back over 600 ms.
 * - Reduce Motion keeps the one-shots but drops `open` and `wind`, which belong
 *   to motion that no longer plays.
 */

export const CHART_AIR_VOLUME = 0.9;
export const CHART_AIR_DUCKED = 0.45;
const AIR_IN_MS = 800;
const AIR_OUT_MS = 400;
const DUCK_DOWN_MS = 120;
const DUCK_UP_MS = 600;
const RAMP_STEPS = 16;
/** Second pen stroke for long draws: starts at this fraction of the draw. */
const INK_SECOND_AT = 0.45;
const INK_SECOND_MIN_MS = 500;

/**
 * The one note of a reached waypoint: the existing `chart-flag` cue, re-pitched by playback rate so each waypoint
 * sounds a step higher on the A major pentatonic (C#5, E5, F#5, A5, B5, C#6). Everything pitch-related lives here.
 *
 * UNVERIFIED: `basePitch` is an assumption. The sample's true pitch has not been confirmed (a crude spectrum read of
 * assets/sounds/chart-flag.mp3 found most energy near 410 Hz and 550 Hz, not 659 Hz, and the cue is inharmonic).
 * When the real pitch is known, change `basePitch` and `semitones` together; nothing else needs to move.
 */
export const CHART_WAYPOINT_NOTE = {
  /** Assumed pitch of the chart-flag sample, played at rate 1. */
  basePitch: 'E5',
  /** Semitones from `basePitch` for waypoint 1, 2, 3, ... Later waypoints hold the last step. */
  semitones: [-3, 0, 2, 5, 7, 9],
} as const;

/** Playback rate for the note of waypoint number `waypointNumber` (1-based; below 1 reads as 1). */
export function waypointNoteRate(waypointNumber: number): number {
  const steps = CHART_WAYPOINT_NOTE.semitones;
  const index = Math.min(steps.length - 1, Math.max(0, Math.floor(waypointNumber) - 1));
  return Math.pow(2, steps[index] / 12);
}

export type ChartSound = {
  open: () => void;
  ink: (durMs: number) => void;
  flag: () => void;
  /** The single waypoint-reached note (climbs per waypoint). Kept under Reduce Motion: it marks the commitment. */
  note: (waypointNumber: number) => void;
  check: () => void;
  stamp: () => void;
  wind: () => void;
  startAir: () => void;
  stopAir: () => void;
  duck: (holdMs: number) => void;
};

export type ChartSoundOptions = {
  /** Optional entrance-specific air fade. Existing callers keep the 800ms default. */
  airFadeInMs?: number;
  /** The creation intro still plays its one `open` cue when Reduce Motion is enabled. */
  playOpenWhenReducedMotion?: boolean;
  /** Fade the ambient bed when this screen owns its lifetime and unmounts. */
  fadeAirOnUnmount?: boolean;
};

const jitter = () => 0.97 + Math.random() * 0.06;

export function useChartSound(reducedMotion: boolean, options: ChartSoundOptions = {}): ChartSound {
  const { createManagedPlayer } = useAudio();
  const airFadeInMs = options.airFadeInMs ?? AIR_IN_MS;
  const playOpenWhenReducedMotion = options.playOpenWhenReducedMotion ?? false;
  const fadeAirOnUnmount = options.fadeAirOnUnmount ?? false;
  useEffect(() => {
    SoundPool.prewarm(['chart-open', 'chart-ink', 'chart-flag', 'chart-check', 'chart-stamp', 'chart-wind']);
    return () => {
      SoundPool.releaseIdle(['chart-open', 'chart-ink', 'chart-flag', 'chart-check', 'chart-stamp', 'chart-wind']);
    };
  }, []);
  const reducedRef = useRef(reducedMotion);
  reducedRef.current = reducedMotion;

  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const later = useCallback((ms: number, fn: () => void) => {
    const handle = setTimeout(() => {
      timers.current.delete(handle);
      fn();
    }, ms);
    timers.current.add(handle);
    return handle;
  }, []);

  /* ---- air bed ---------------------------------------------------- */
  const air = useRef<ManagedAudioPlayer | null>(null);
  const airVolume = useRef(0);
  const ramp = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopRamp = () => {
    if (ramp.current) clearInterval(ramp.current);
    ramp.current = null;
  };
  /** Stepped volume ramp (expo-audio has no native fade). */
  const rampTo = useCallback((target: number, ms: number, done?: () => void) => {
    stopRamp();
    const player = air.current;
    if (!player) return;
    const from = airVolume.current;
    let step = 0;
    ramp.current = setInterval(() => {
      step += 1;
      const value = from + (target - from) * (step / RAMP_STEPS);
      airVolume.current = value;
      player.setVolume(value);
      if (step >= RAMP_STEPS) {
        stopRamp();
        done?.();
      }
    }, Math.max(1, ms / RAMP_STEPS));
  }, []);

  const one = useCallback(
    (key: SoundKey, volume = 1, rate = jitter()) => {
      SoundPool.play(key, { volume, rate });
    },
    []
  );

  const startAir = useCallback(() => {
    if (air.current) {
      // Already playing (or fading out): bring it back up.
      rampTo(CHART_AIR_VOLUME, airFadeInMs);
      return;
    }
    const player = createManagedPlayer('chart-air', { loop: true, volume: 0 });
    if (!player) return;
    air.current = player;
    airVolume.current = 0;
    player.play();
    rampTo(CHART_AIR_VOLUME, airFadeInMs);
  }, [airFadeInMs, createManagedPlayer, rampTo]);

  const stopAir = useCallback(() => {
    const player = air.current;
    if (!player) return;
    rampTo(0, AIR_OUT_MS, () => {
      if (air.current === player) {
        air.current = null;
        player.stop();
      }
    });
  }, [rampTo]);

  const duck = useCallback(
    (holdMs: number) => {
      if (!air.current) return;
      rampTo(CHART_AIR_DUCKED, DUCK_DOWN_MS, () => {
        later(holdMs, () => {
          if (air.current) rampTo(CHART_AIR_VOLUME, DUCK_UP_MS);
        });
      });
    },
    [rampTo, later]
  );

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
      if (fadeAirOnUnmount && air.current) {
        const player = air.current;
        rampTo(0, AIR_OUT_MS, () => {
          if (air.current === player) {
            air.current = null;
            player.stop();
          }
        });
      } else {
        stopRamp();
        air.current?.stop();
        air.current = null;
      }
    },
    []
  );

  return useMemo<ChartSound>(
    () => ({
      open: () => {
        if (!reducedRef.current || playOpenWhenReducedMotion) one('chart-open', 1, 1);
      },
      ink: (durMs: number) => {
        one('chart-ink');
        if (durMs > INK_SECOND_MIN_MS) later(durMs * INK_SECOND_AT, () => one('chart-ink', 0.75, 0.95 * jitter()));
      },
      flag: () => one('chart-flag'),
      note: (waypointNumber: number) => {
        // Exact pitch: no jitter, or the climb would wobble.
        one('chart-flag', 1, waypointNoteRate(waypointNumber));
        duck(1300);
      },
      check: () => one('chart-check'),
      stamp: () => {
        one('chart-stamp');
        duck(1300);
      },
      wind: () => {
        if (!reducedRef.current) one('chart-wind', 1, 1);
      },
      startAir,
      stopAir,
      duck,
    }),
    [one, later, duck, startAir, stopAir, playOpenWhenReducedMotion]
  );
}
