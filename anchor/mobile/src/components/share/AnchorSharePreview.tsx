import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ShareTemplate } from './ShareTemplate';
import { StyleEditorialMorphPreview } from './StyleEditorialMorphPreview';
import { SHARE_ASPECT, type ShareExportData, type ShareLayoutId } from './shareTypes';

type Family = 'minimal' | 'environment' | 'vision';

/** Style and Editorial are one family: same environment, so they morph rather than crossfade. */
const familyOf = (layout: ShareLayoutId): Family => (layout === 'style' || layout === 'editorial' ? 'environment' : layout);

type Props = {
  layout: ShareLayoutId;
  data: ShareExportData;
  /** Preview width in dp. The export itself is always rendered separately at 1080 x 1920. */
  width: number;
  showMark: boolean;
  visionBackgroundId?: string | null;
  reduceMotion?: boolean;
  /** Horizontal swipe on the preview: +1 for the next layout, -1 for the previous. */
  onSwipe?: (direction: 1 | -1) => void;
};

const FADE_MS = 280;
const MORPH_MS = 460;

/** The large 9:16 preview: real templates at screen size, never a screenshot of anything. */
export function AnchorSharePreview({ layout, data, width, showMark, visionBackgroundId, reduceMotion, onSwipe }: Props) {
  const family = familyOf(layout);
  const [shown, setShown] = useState<Family>(family);
  const [leaving, setLeaving] = useState<Family | null>(null);
  const fade = useSharedValue(1);
  const morph = useSharedValue(layout === 'editorial' ? 1 : 0);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const target = layout === 'editorial' ? 1 : 0;
    morph.value = reduceMotion ? target : withTiming(target, { duration: MORPH_MS, easing: Easing.inOut(Easing.cubic) });
  }, [layout, morph, reduceMotion]);

  useEffect(() => {
    if (family === shown) return;
    setLeaving(shown);
    setShown(family);
    fade.value = reduceMotion ? 1 : 0;
    if (!reduceMotion) fade.value = withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.quad) });
    if (clearTimer.current) clearTimeout(clearTimer.current);
    clearTimer.current = setTimeout(() => setLeaving(null), reduceMotion ? 0 : FADE_MS + 40);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family]);

  useEffect(
    () => () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    },
    [],
  );

  const swipeRef = useRef(onSwipe);
  swipeRef.current = onSwipe;
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderRelease: (_e, g) => {
          if (g.dx <= -40) swipeRef.current?.(1);
          else if (g.dx >= 40) swipeRef.current?.(-1);
        },
      }),
    [],
  );

  const incoming = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: 0.985 + 0.015 * fade.value }],
  }));

  const render = (f: Family) =>
    f === 'environment' ? (
      <StyleEditorialMorphPreview data={data} width={width} showMark={showMark} progress={morph} />
    ) : (
      <ShareTemplate layout={f} data={data} width={width} showMark={showMark} visionBackgroundId={visionBackgroundId} />
    );

  return (
    <View
      testID={`share-preview-${layout}`}
      style={[styles.frame, { width, height: width * SHARE_ASPECT }]}
      {...pan.panHandlers}
    >
      {leaving ? <View style={StyleSheet.absoluteFill}>{render(leaving)}</View> : null}
      <Animated.View style={[StyleSheet.absoluteFill, incoming]}>{render(shown)}</Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0B0C16',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
});
