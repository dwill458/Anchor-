import { useCallback, useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import { playCreationSound, type CreationSoundHandle } from '@/services/CreationSounds';
import { RELEASE_CEREMONY_TIMELINE_MS as T } from '@/constants/v2/release';

/** Swell begins just after the ignition pulse and ends before the coin is gone; then nothing. */
const SWELL_START_MS = 220;
const SWELL_END_MS = T.emptyPause - 160;
const SWELL_FIRST_GAP_MS = 300;
const SWELL_LAST_GAP_MS = 95;

type Tick = { at: number; style: Haptics.ImpactFeedbackStyle };

/** Slow swell: ticks speed up and strengthen as the flames rise. Pure, so it is testable. */
export function buildBurnHapticSchedule(): Tick[] {
  const ticks: Tick[] = [];
  let at = SWELL_START_MS;
  while (at < SWELL_END_MS) {
    const p = (at - SWELL_START_MS) / (SWELL_END_MS - SWELL_START_MS);
    ticks.push({ at, style: p < 0.35 ? Haptics.ImpactFeedbackStyle.Light
      : p < 0.72 ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Heavy });
    at += SWELL_FIRST_GAP_MS + (SWELL_LAST_GAP_MS - SWELL_FIRST_GAP_MS) * Math.pow(p, 1.1);
  }
  return ticks;
}

/**
 * The felt burn: one sound file that runs ignition → rising crackle → exact silence, and a haptic swell
 * on the same clock. `begin()` lands on hold-complete; `end()` lands on the coin's disappearance and
 * also on unmount / any other exit, so nothing can be left sounding or buzzing.
 */
export function useReleaseBurnFeel() {
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const sound = useRef<CreationSoundHandle | null>(null);

  const end = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    sound.current?.stop();
    sound.current = null;
  }, []);

  const begin = useCallback((reduceMotion: boolean) => {
    end();
    sound.current = playCreationSound(reduceMotion ? 'releaseIgnite' : 'releaseBurn');
    if (reduceMotion) return; // Ignition pulse only; no swell without the flames.
    const start = Date.now();
    timers.current = buildBurnHapticSchedule().map(({ at, style }) =>
      setTimeout(() => safeHaptics.impact(style), Math.max(0, at - (Date.now() - start))));
  }, [end]);

  useEffect(() => end, [end]);
  return { begin, end };
}
