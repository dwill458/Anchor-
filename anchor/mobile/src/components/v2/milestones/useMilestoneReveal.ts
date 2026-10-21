import { useEffect, useRef, useState } from 'react';
import { cancelAnimation, Easing, useAnimatedStyle, useDerivedValue, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { playCreationSound, type CreationSoundHandle } from '@/services/CreationSounds';
import { v2Haptics } from '@/hooks/v2/haptics';
import type { MilestoneSpec } from '@/milestones/registry';
import { approvedMotionDuration, approvedReducedMotionDuration } from '@/milestones/approvedMotion';
import { APPROVED_MILESTONE_ASSETS } from '@/milestones/approvedAssets';

export const REVEAL_TIMING = { transition: 650, drawing: 1250, accent: 850, copy: 850 } as const;

/** One UI-thread timeline, finite and cancellable. JS schedules only the single accent, never frames. */
export function useMilestoneReveal(spec: MilestoneSpec | undefined, reducedMotion: boolean, transition: boolean) {
  const progress = useSharedValue(0);
  const atmosphere = useSharedValue(transition ? 0 : 1);
  const copy = useSharedValue(0);
  const cued = useRef(false);
  const sound = useRef<CreationSoundHandle | null>(null);
  const travel = useDerivedValue(() => transition ? (atmosphere.value + progress.value) / 2 : progress.value);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!spec) return;
    cued.current = false;
    setSettled(false);
    progress.value = 0;
    copy.value = 0;
    const asset = APPROVED_MILESTONE_ASSETS[spec.id];
    const duration = reducedMotion ? approvedReducedMotionDuration : asset ? approvedMotionDuration(asset) : REVEAL_TIMING.drawing;
    const delay = transition ? REVEAL_TIMING.transition : 0;
    atmosphere.value = withTiming(1, { duration: reducedMotion ? 160 : delay });
    // The manifest owns each element's easing; this clock must be linear.
    progress.value = withDelay(reducedMotion ? 0 : delay, withTiming(1, { duration, easing: Easing.linear }));
    copy.value = withDelay(reducedMotion ? 0 : delay + REVEAL_TIMING.copy, withTiming(1, { duration: reducedMotion ? 160 : 450 }));
    const cue = () => {
      if (cued.current) return;
      cued.current = true;
      v2Haptics[spec.haptic]();
      sound.current = playCreationSound(spec.sound) ?? null;
    };
    const timer = setTimeout(cue, reducedMotion ? 0 : delay + REVEAL_TIMING.accent);
    const settleTimer = setTimeout(() => setSettled(true), (reducedMotion ? 0 : delay) + duration);
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
    opacity: atmosphere.value,
  }));
  const reducedEarnedStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const reducedLockedStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const copyStyle = useAnimatedStyle(() => ({ opacity: copy.value }));
  return { progress, travel, fieldStyle, artStyle, copyStyle, settled, reducedEarnedStyle, reducedLockedStyle };
}
