import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { useAudio, type ManagedAudioPlayer, type SoundKey } from '@/hooks/useAudio';
import { SoundPool } from '@/services/audio/SoundPool';
import { VOLUME } from '@/services/CreationSounds';

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
const WAYPOINT_CUES = ['chart-waypoint_1', 'chart-waypoint_2', 'chart-waypoint_3'] as const satisfies readonly SoundKey[];
/** Second pen stroke for long draws: starts at this fraction of the draw. */
const INK_SECOND_AT = 0.45;
const INK_SECOND_MIN_MS = 500;

export type ChartSound = {
  open: () => void;
  ink: (durMs: number) => void;
  flag: () => void;
  /** One authored waypoint cue. Kept under Reduce Motion because it marks the commitment. */
  note: (waypointNumber: number) => void;
  inkHold: () => void;
  check: () => void;
  stamp: () => void;
  wind: () => void;
  /** The summit's stillness: the air bed falls silent for `holdMs` (then returns). */
  hush: (holdMs: number) => void;
  /** The summit's flag: a low thud followed by the chord. Kept under Reduce Motion. */
  summit: () => void;
  startAir: () => void;
  stopAir: () => void;
  duck: (holdMs: number, level?: number) => void;
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
    const cues: SoundKey[] = [
      'chart-open', 'chart-ink', 'chart-flag', 'chart-wind',
      ...WAYPOINT_CUES,
      'chart-move-done', 'chart-ink-hold', 'chart-summit-thud', 'chart-summit-chord',
    ];
    SoundPool.prewarm(cues);
    return () => {
      SoundPool.releaseIdle(cues);
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
  const airStopping = useRef(false);
  const duckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelDuckReturn = useCallback(() => {
    if (duckTimer.current !== null) {
      clearTimeout(duckTimer.current);
      timers.current.delete(duckTimer.current);
      duckTimer.current = null;
    }
  }, []);
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
    (key: SoundKey, volume = VOLUME[key], rate = jitter()) => {
      SoundPool.play(key, { volume, rate });
    },
    []
  );

  const startAir = useCallback(() => {
    if (AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
    cancelDuckReturn();
    airStopping.current = false;
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
  }, [airFadeInMs, cancelDuckReturn, createManagedPlayer, rampTo]);

  const stopAir = useCallback(() => {
    cancelDuckReturn();
    if (airStopping.current) return;
    airStopping.current = true;
    const player = air.current;
    if (!player) return;
    rampTo(0, AIR_OUT_MS, () => {
      if (air.current === player) {
        air.current = null;
        player.stop();
      }
    });
  }, [cancelDuckReturn, rampTo]);

  /** The one pending return-to-full timer: a newer duck replaces it, so two ducks can never undo each other. */
  const duck = useCallback(
    (holdMs: number, level: number = CHART_AIR_DUCKED) => {
      if (!air.current || airStopping.current) return;
      cancelDuckReturn();
      rampTo(level, DUCK_DOWN_MS, () => {
        duckTimer.current = later(holdMs, () => {
          duckTimer.current = null;
          if (air.current && !airStopping.current) rampTo(CHART_AIR_VOLUME, DUCK_UP_MS);
        });
      });
    },
    [cancelDuckReturn, rampTo, later]
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') return;
      cancelDuckReturn();
      airStopping.current = true;
      stopRamp();
      air.current?.stop();
      air.current = null;
      airVolume.current = 0;
    });
    return () => subscription.remove();
  }, [cancelDuckReturn]);

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      timers.current.clear();
      duckTimer.current = null;
      airStopping.current = true;
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
        const index = Math.min(WAYPOINT_CUES.length - 1, Math.max(0, Math.floor(waypointNumber) - 1));
        one(WAYPOINT_CUES[index]);
        duck(1300);
      },
      inkHold: () => one('chart-ink-hold'),
      check: () => one('chart-move-done'),
      stamp: () => {
        one('chart-stamp');
        duck(1300);
      },
      wind: () => {
        if (!reducedRef.current) one('chart-wind', 1, 1);
      },
      hush: (holdMs: number) => duck(holdMs, 0),
      summit: () => {
        one('chart-summit-thud');
        later(20, () => one('chart-summit-chord'));
        duck(2200);
      },
      startAir,
      stopAir,
      duck,
    }),
    [one, later, duck, startAir, stopAir, playOpenWhenReducedMotion]
  );
}
