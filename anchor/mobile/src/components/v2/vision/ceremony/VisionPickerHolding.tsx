import { useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { CircularAnchorRenderer } from '@/components/v2/anchor';
import { AnalyticsService } from '@/services/AnalyticsService';
import { useV2ReduceMotion } from '@/hooks/v2';
import { visionCelebrationTrace } from './visionCelebrationTrace';

/** Expo resolves at selection, not presentation. Native focus loss is the presentation signal. */
export function useVisionPicker(anchorId: string) {
  const [state, setState] = useState<'opening' | 'retry' | null>(null);
  const attempt = useRef(0), mounted = useRef(true), retry = useRef<(() => void) | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; attempt.current++; cleanup.current?.(); }; }, []);
  const run = async <T,>(open: () => Promise<T>, consume?: (result: T) => void): Promise<T | undefined> => {
    cleanup.current?.();
    const id = ++attempt.current, started = Date.now();
    Keyboard.dismiss(); setState('opening');
    let presented = false;
    const presentedNow = (signal: string) => {
      if (presented || attempt.current !== id || !mounted.current) return;
      presented = true;
      AnalyticsService.track('vision_picker_open_ms', { anchor_id: anchorId, duration_ms: Date.now() - started, signal });
      visionCelebrationTrace('picker opened', 0, false, false, { signal });
    };
    const blur = AppState.addEventListener('blur', () => presentedNow('native_blur'));
    const change = AppState.addEventListener('change', value => { if (value !== 'active') presentedNow('app_state'); });
    const timer = setTimeout(() => {
      if (!presented && mounted.current && attempt.current === id) {
        setState('retry'); AnalyticsService.track('vision_picker_failed', { anchor_id: anchorId, reason: 'presentation_timeout' });
      }
    }, 1500);
    const clean = () => { clearTimeout(timer); blur.remove(); change.remove(); };
    cleanup.current = clean;
    retry.current = () => { void run(open, consume); };
    try {
      // Yield the press handler so the holding state can commit before native presentation.
      await Promise.resolve();
      if (!mounted.current || attempt.current !== id) return;
      const result = await open();
      if (!mounted.current || attempt.current !== id) return;
      // No invented open latency when the native picker has not exposed a focus event.
      if (!presented) visionCelebrationTrace('picker returned', 0, false, false, { presentationObserved: false });
      setState(null); consume?.(result); return result;
    } catch {
      if (mounted.current && attempt.current === id) {
        setState('retry'); AnalyticsService.track('vision_picker_failed', { anchor_id: anchorId, reason: 'launch_error' });
      }
      return;
    } finally { clean(); }
  };
  return { state, run, retry: () => retry.current?.(), dismiss: () => { attempt.current++; cleanup.current?.(); setState(null); } };
}

export function VisionPickerHolding({ retrying, onRetry, onBack, anchorArt }: {
  retrying: boolean; onRetry: () => void; onBack: () => void;
  anchorArt?: React.ComponentProps<typeof CircularAnchorRenderer> | null;
}) {
  const reduced = useV2ReduceMotion(), breath = useSharedValue(1);
  useEffect(() => { if (!reduced) breath.value = withSequence(withTiming(1.08, { duration: 650 }), withTiming(1, { duration: 650 })); }, [reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: breath.value }] }));
  return <View testID="vision-picker-holding" style={styles.root}>
    <Animated.View style={style}>{anchorArt ? <CircularAnchorRenderer {...anchorArt} size={88} appearance="bare" /> : <View style={styles.mark} />}</Animated.View>
    {retrying ? <>
      <Text accessibilityLiveRegion="polite" style={styles.text}>Open your photos</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Retry opening photos" onPress={onRetry} style={styles.button}><Text style={styles.buttonText}>Open your photos</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={onBack} style={styles.button}><Text style={styles.buttonText}>Go back</Text></Pressable>
    </> : null}
  </View>;
}
const styles = StyleSheet.create({ root: { ...StyleSheet.absoluteFill, zIndex: 100, backgroundColor: '#14162B', justifyContent: 'center', alignItems: 'center', gap: 20 },
  mark: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: '#F4EDE0' },
  text: { fontFamily: 'Inter-Medium', fontSize: 18, color: '#F4EDE0' },
  button: { minHeight: 44, paddingHorizontal: 24, justifyContent: 'center' }, buttonText: { fontFamily: 'Inter-Medium', color: '#F4EDE0' },
});
