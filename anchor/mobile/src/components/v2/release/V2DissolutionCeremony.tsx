import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { cancelAnimation, Easing, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { RELEASE_CEREMONY_CHAMBER_BG, RELEASE_CEREMONY_TIMELINE_MS as T,
  RELEASE_CEREMONY_TIMELINE_REDUCED_MS as R, RELEASE_COPY } from '@/constants/v2/release';
import { V2ReleaseArtwork } from './V2ReleaseArtwork';

interface Props {
  artworkSvg: string;
  anchorId?: string;
  category?: string | null;
  reduceMotion?: boolean;
  clock?: SharedValue<number>;
  artworkAlreadyMounted?: boolean;
  onEmptyPause?: () => void;
  onDissolutionComplete: () => void;
  testID?: string;
}

/** Visual time only. Network completion is independently gated by useV2Release. */
export function V2DissolutionCeremony({ artworkSvg, anchorId = 'anchor', category,
  reduceMotion = false, clock: suppliedClock, artworkAlreadyMounted = false,
  onEmptyPause, onDissolutionComplete, testID }: Props) {
  const localClock = useSharedValue(0);
  const clock = suppliedClock ?? localClock;
  const [phase, setPhase] = useState('isolate');
  const callbacks = useRef({ onEmptyPause, onDissolutionComplete });
  callbacks.current = { onEmptyPause, onDissolutionComplete };
  const finished = useRef(false);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility?.(RELEASE_COPY.committedAnnouncement);
  }, []);

  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const timeline = reduceMotion ? R : T;
    cancelAnimation(clock);
    clock.value = 0;
    setPhase('isolate');
    clock.value = withTiming(timeline.completion, { duration: timeline.completion, easing: Easing.linear });
    if (reduceMotion) at(R.fade, () => setPhase('fade'));
    else {
      at(T.ignite, () => setPhase('ignite'));
      at(T.burnEarly, () => setPhase('burnEarly'));
      at(T.burnLate, () => setPhase('burnLate'));
      at(T.finalEmber, () => setPhase('finalEmber'));
    }
    at(timeline.emptyPause, () => {
      setPhase('emptyPause');
      callbacks.current.onEmptyPause?.();
    });
    at(timeline.completion, () => {
      if (finished.current) return;
      finished.current = true;
      callbacks.current.onDissolutionComplete();
    });
    return () => { timers.forEach(clearTimeout); cancelAnimation(clock); };
  }, [clock, reduceMotion]);

  return (
    <View pointerEvents="none" style={styles.chamber} testID={testID ?? 'v2-dissolution-ceremony'}>
      <View style={styles.stage} testID={`v2-dissolution-phase-${phase}`}>
        {!artworkAlreadyMounted && phase !== 'emptyPause' ? (
          <V2ReleaseArtwork anchorId={anchorId} artworkSvg={artworkSvg} category={category}
            size={244} active reduceMotion={reduceMotion} clock={clock} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chamber: { ...StyleSheet.absoluteFillObject, backgroundColor: RELEASE_CEREMONY_CHAMBER_BG,
    alignItems: 'center', justifyContent: 'center' },
  stage: { width: 244, height: 244 },
});
