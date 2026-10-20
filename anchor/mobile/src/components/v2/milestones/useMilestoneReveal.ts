import { useEffect, useRef, useState } from 'react';
import { cancelAnimation, Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { playCreationSound, type CreationSoundHandle } from '@/services/CreationSounds';
import { v2Haptics } from '@/hooks/v2/haptics';
import type { MilestoneSpec } from '@/milestones/registry';

export const REVEAL_TIMING = { transition: 650, drawing: 1250, accent: 850, copy: 850 } as const;

/** One UI-thread timeline, finite and cancellable. JS schedules only the single accent, never frames. */
export function useMilestoneReveal(spec: MilestoneSpec | undefined, reducedMotion: boolean, transition: boolean) {
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  const atmosphere = useSharedValue(transition ? 0 : 1);
  const copy = useSharedValue(0);
  const cued = useRef(false);
  const sound = useRef<CreationSoundHandle | null>(null);
  const family = spec?.family;
  const travel = useDerivedValue(() => transition ? (atmosphere.value + progress.value) / 2 : progress.value);
  const [settled, setSettled] = useState(reducedMotion);
  useEffect(() => {
    if (!spec) return;
    const delay = transition ? REVEAL_TIMING.transition : 0;
    atmosphere.value = withTiming(1, { duration: reducedMotion ? 160 : delay });
    progress.value = reducedMotion ? 1 : withDelay(delay, withTiming(1, { duration: REVEAL_TIMING.drawing, easing: Easing.inOut(Easing.cubic) }));
    copy.value = withDelay(reducedMotion ? 0 : delay + REVEAL_TIMING.copy, withTiming(1, { duration: reducedMotion ? 160 : 450 }));
    const cue = () => {
      if (cued.current) return;
      cued.current = true;
      v2Haptics[spec.haptic]();
      sound.current = playCreationSound(spec.sound) ?? null;
    };
    const timer = setTimeout(cue, reducedMotion ? 0 : delay + REVEAL_TIMING.accent);
    const settleTimer = setTimeout(() => setSettled(true), reducedMotion ? 160 : delay + REVEAL_TIMING.drawing);
    return () => {
      clearTimeout(timer);
      clearTimeout(settleTimer);
      sound.current?.stop(80);
      sound.current = null;
      cancelAnimation(progress); cancelAnimation(atmosphere); cancelAnimation(copy);
    };
  }, [atmosphere, copy, progress, reducedMotion, spec, transition]);

  const fieldStyle = useAnimatedStyle(() => ({ opacity: atmosphere.value }));
  const artStyle = useAnimatedStyle(() => ({
    opacity: reducedMotion ? atmosphere.value : Math.min(1, progress.value * 5),
    transform: [
      { scale: reducedMotion ? 1 : family === 'strength' ? 1 + Math.sin(progress.value * Math.PI) * 0.045 : 0.94 + 0.06 * progress.value },
      { translateY: !reducedMotion && family === 'journey' ? (1 - progress.value) * 18 : 0 },
    ],
  }));
  const copyStyle = useAnimatedStyle(() => ({ opacity: copy.value }));
  return { progress, travel, fieldStyle, artStyle, copyStyle, settled };
}
