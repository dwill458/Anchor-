import { useEffect, useRef, useState } from 'react';
import { AppState, Image, StyleSheet } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { safeHaptics } from '@/utils/haptics';
import { playCreationSound } from '@/services/CreationSounds';
import { visionCelebrationTrace } from './ceremony/visionCelebrationTrace';
import { CEREMONY, ceremonyDuration } from './ceremony/VisionDevelop';
import type { VisionImageRect } from './VisionImageArrival';

export type VisionArrivalPhase = 'waiting' | 'flying' | 'landed' | 'pinned' | 'failed';
export type VisionArrivalPrint = { sceneId: string; url: string; source: VisionImageRect; target?: VisionImageRect; phase: VisionArrivalPhase };
export type SavedVisionImage = { sceneId: string; url: string };

/** Uses the board's measured aperture; no duplicate tile-count layout exists here. */
export function VisionArrivalSetPrint({ item, index, firstImage, reduced, onPhase, readyToFly, onDecoded }: {
  item: VisionArrivalPrint; index: number; firstImage: boolean; reduced: boolean;
  onPhase: (sceneId: string, phase: VisionArrivalPhase) => void;
  readyToFly: boolean; onDecoded: (sceneId: string) => void;
}) {
  const progress = useSharedValue(0), started = useRef(false);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const elapsed = useRef(0), landedOnce = useRef(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => sub.remove();
  }, []);
  const [decoded, setDecoded] = useState(false);
  const latest = useRef(onPhase); latest.current = onPhase;
  useEffect(() => {
    if (item.phase !== 'waiting' || !foreground) return;
    // Lost image/layout callbacks cannot trap the screen or leave the orb hidden.
    const timer = setTimeout(() => latest.current(item.sceneId, 'failed'), 4000 + index * 120);
    return () => clearTimeout(timer);
  }, [item.sceneId, item.phase, foreground]);
  useEffect(() => {
    if (!readyToFly || !item.target || !decoded || !foreground || item.phase === 'failed' || item.phase === 'pinned') return;
    const delay = reduced ? 0 : index * 120, duration = reduced ? 180 : 760;
    const remainingDelay = Math.max(0, delay - elapsed.current), remainingFlight = Math.max(0, delay + duration - elapsed.current - remainingDelay);
    const resumedAt = Date.now();
    progress.value = withDelay(remainingDelay, withTiming(1, { duration: remainingFlight, easing: Easing.bezier(.2, .8, .2, 1) }));
    if (!started.current) { started.current = true; latest.current(item.sceneId, 'flying'); }
    const landed = setTimeout(() => {
      if (landedOnce.current) return;
      landedOnce.current = true;
      latest.current(item.sceneId, 'landed');
      const medium = !firstImage && index === 0;
      if (medium) void safeHaptics.impact(ImpactFeedbackStyle.Medium);
      visionCelebrationTrace('arrival landed', medium ? 'Medium' : 0, medium, false, { sceneId: item.sceneId });
    }, Math.max(0, delay + duration - elapsed.current));
    const pinned = setTimeout(() => {
      latest.current(item.sceneId, 'pinned');
      const sound = playCreationSound('visionPin');
      visionCelebrationTrace('pin dropped', 0, false, Boolean(sound), { sceneId: item.sceneId });
    }, Math.max(0, delay + duration + ceremonyDuration(CEREMONY.pinDropMs, reduced) - elapsed.current));
    return () => { elapsed.current += Date.now() - resumedAt; clearTimeout(landed); clearTimeout(pinned); cancelAnimation(progress); };
  }, [readyToFly, Boolean(item.target), decoded, item.sceneId, index, reduced, firstImage, foreground]);
  const style = useAnimatedStyle(() => {
    const target = item.target ?? item.source;
    return { left: item.source.x + (target.x - item.source.x) * progress.value,
      top: item.source.y + (target.y - item.source.y) * progress.value,
      width: item.source.width + (target.width - item.source.width) * progress.value,
      height: item.source.height + (target.height - item.source.height) * progress.value };
  });
  // Keep the decoder mounted through the pin phase; only its flight becomes invisible.
  return <Animated.View pointerEvents="none" style={[styles.print, { opacity: item.phase === 'landed' || item.phase === 'pinned' || item.phase === 'failed' ? 0 : 1 }, style]}>
    <Image testID={`vision-arrival-set-${item.sceneId}`} source={{ uri: item.url }} resizeMode="cover" style={StyleSheet.absoluteFill}
      onLoad={() => { setDecoded(true); onDecoded(item.sceneId); }} onError={() => latest.current(item.sceneId, 'failed')} />
  </Animated.View>;
}
const styles = StyleSheet.create({ print: { position: 'absolute', backgroundColor: '#F7F1E6', borderWidth: 4, borderColor: '#F7F1E6',
  shadowColor: '#000', shadowOpacity: .16, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } } });
