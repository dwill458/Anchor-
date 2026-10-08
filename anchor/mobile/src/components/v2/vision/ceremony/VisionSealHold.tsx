import { useCallback, useEffect, useRef } from 'react';
import { AppState, Pressable, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, useAnimatedProps, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import { playCreationSound, type CreationSoundHandle } from '@/services/CreationSounds';
import { CEREMONY, ceremonyDuration } from './VisionDevelop';
import { visionCeremonyCopy as copy } from './visionCeremonyCopy';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
/** The Vision hold has no dependency on Anchor creation stores or analytics. */
export function VisionSealHold({ children, active, committed, reduced, onCommit, onBegin, onAbandon }: {
  children: React.ReactNode; active: boolean; committed: boolean; reduced: boolean;
  onCommit: () => void; onBegin?: () => void; onAbandon?: (progress: number) => void;
}) {
  const progress = useSharedValue(0), press = useSharedValue(1);
  const complete = useRef(false), touching = useRef(false), startedAt = useRef(0);
  const tone = useRef<CreationSoundHandle | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const callbacks = useRef({ onCommit, onBegin, onAbandon }); callbacks.current = { onCommit, onBegin, onAbandon };
  const stop = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; tone.current?.stop(); tone.current = null; }, []);
  const commit = useCallback(() => {
    if (complete.current || committed || !active) return;
    complete.current = true; touching.current = false; stop(); progress.value = 1; press.value = 1;
    callbacks.current.onCommit();
  }, [active, committed, stop]);
  const begin = () => {
    if (!active || committed || complete.current || touching.current || AppState.currentState === 'background') return;
    stop(); touching.current = true; startedAt.current = Date.now(); callbacks.current.onBegin?.();
    void safeHaptics.impact(ImpactFeedbackStyle.Light);
    tone.current = playCreationSound('sealRise', undefined, { loop: true });
    progress.value = 0; progress.value = withTiming(1, { duration: CEREMONY.sealHoldMs });
    press.value = reduced ? 1 : withTiming(.94, { duration: CEREMONY.sealHoldMs });
    timers.current = [setTimeout(() => { void safeHaptics.impact(ImpactFeedbackStyle.Light); }, 400),
      setTimeout(() => { void safeHaptics.impact(ImpactFeedbackStyle.Medium); }, 1200), setTimeout(commit, CEREMONY.sealHoldMs)];
  };
  const release = useCallback(() => {
    if (!touching.current || complete.current) return;
    touching.current = false; stop(); cancelAnimation(progress);
    callbacks.current.onAbandon?.(Math.min(1, (Date.now() - startedAt.current) / CEREMONY.sealHoldMs));
    progress.value = withTiming(0, { duration: ceremonyDuration(CEREMONY.sealDecayMs, reduced) });
    press.value = withTiming(1, { duration: ceremonyDuration(CEREMONY.sealDecayMs, reduced) });
  }, [reduced, stop]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') release(); });
    return () => sub.remove();
  }, [release]);
  useEffect(() => { if (!active) release(); }, [active, release]);
  useEffect(() => () => { release(); stop(); }, [release, stop]);
  const circle = useAnimatedProps(() => ({ strokeDashoffset: 2 * Math.PI * 72 * (1 - progress.value) }));
  const style = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));
  return <Animated.View style={[styles.fill, style]}>
    {children}
    {active && !committed ? <>
      <Svg pointerEvents="none" width="125%" height="125%" viewBox="0 0 160 160" style={styles.ring}>
        <Circle cx="80" cy="80" r="72" stroke="#F4EDE024" strokeWidth="1.5" fill="none" />
        <AnimatedCircle cx="80" cy="80" r="72" stroke="#F4EDE0" strokeWidth="1.5" fill="none" strokeDasharray={2 * Math.PI * 72}
          rotation="-90" origin="80,80" animatedProps={circle} />
      </Svg>
      <Pressable testID="vision-seal-hold" style={styles.fill} accessibilityRole="button" accessibilityLabel={copy.sealLabel}
        accessibilityActions={[{ name: 'activate' }]} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'activate') { callbacks.current.onBegin?.(); commit(); } }}
        onPressIn={begin} onPressOut={release} />
    </> : null}
  </Animated.View>;
}

const styles = StyleSheet.create({ fill: { ...StyleSheet.absoluteFillObject }, ring: { position: 'absolute', left: '-12.5%', top: '-12.5%' } });
