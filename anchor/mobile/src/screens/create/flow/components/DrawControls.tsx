import React, { useMemo, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '@/theme/colors';
import type { DrawnPoint } from '@/utils/sigil/drawnGeometry';
import { DESIGN_WIDTH } from '../creationFlowConfig';
import { PAD } from '../geometry';

/** A drawing must be at least this long before Done unlocks. */
export const MIN_DRAWN_LENGTH = 80;
/** Points closer than this to the previous one are ignored. */
export const MIN_POINT_GAP = 1.8;

const clampToPad = (p: DrawnPoint): DrawnPoint => ({
  x: Math.min(PAD.x + PAD.w, Math.max(PAD.x, p.x)),
  y: Math.min(PAD.y + PAD.h, Math.max(PAD.y, p.y)),
});

interface DrawPadProps {
  /** Pad opens only once it has risen in. */
  enabled: boolean;
  onStrokeStart: (point: DrawnPoint) => void;
  onStrokeMove: (point: DrawnPoint) => void;
  onStrokeEnd: () => void;
}

/**
 * The drawing surface. It paints nothing itself — strokes are drawn by the flow canvas — and has
 * no children, so every touch has this view as its target and `locationX/Y` are pad-relative.
 */
export function DrawPad({ enabled, onStrokeStart, onStrokeMove, onStrokeEnd }: DrawPadProps) {
  const handlers = useRef({ enabled, onStrokeStart, onStrokeMove, onStrokeEnd });
  handlers.current = { enabled, onStrokeStart, onStrokeMove, onStrokeEnd };
  const lastRef = useRef<DrawnPoint | null>(null);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => handlers.current.enabled,
        onMoveShouldSetPanResponder: () => handlers.current.enabled,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          const point = clampToPad({
            x: PAD.x + event.nativeEvent.locationX,
            y: PAD.y + event.nativeEvent.locationY,
          });
          lastRef.current = point;
          handlers.current.onStrokeStart(point);
        },
        onPanResponderMove: (event) => {
          const point = clampToPad({
            x: PAD.x + event.nativeEvent.locationX,
            y: PAD.y + event.nativeEvent.locationY,
          });
          const last = lastRef.current;
          if (last && Math.hypot(point.x - last.x, point.y - last.y) <= MIN_POINT_GAP) return;
          lastRef.current = point;
          handlers.current.onStrokeMove(point);
        },
        onPanResponderRelease: () => {
          lastRef.current = null;
          handlers.current.onStrokeEnd();
        },
        onPanResponderTerminate: () => {
          lastRef.current = null;
          handlers.current.onStrokeEnd();
        },
      }),
    []
  );

  return (
    <View
      style={styles.pad}
      {...responder.panHandlers}
      accessible
      accessibilityLabel="Drawing area"
      accessibilityHint="Draw your anchor with your finger"
    />
  );
}

interface DrawControlsProps {
  hasStrokes: boolean;
  canFinish: boolean;
  onUndo: () => void;
  onClear: () => void;
  onDone: () => void;
}

/** Undo (last stroke), Done (dim until the drawing is long enough), Clear. Real controls. */
export function DrawControls({ hasStrokes, canFinish, onUndo, onClear, onDone }: DrawControlsProps) {
  return (
    <View style={styles.controls} pointerEvents="box-none">
      {hasStrokes ? (
        <Pressable
          onPress={onUndo}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Undo"
          style={[styles.textButton, { left: 62 - 40 }]}
        >
          <Text style={styles.textButtonLabel}>Undo</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={onDone}
        disabled={!canFinish}
        accessibilityRole="button"
        accessibilityLabel="Done"
        accessibilityState={{ disabled: !canFinish }}
        style={[styles.done, { opacity: canFinish ? 1 : 0.28 }]}
      >
        <Svg width={56} height={56} viewBox="-28 -28 56 56">
          <Circle cx={0} cy={0} r={27} stroke={colors.creation.gold} strokeWidth={1.4} fill="none" />
          <Path
            d="M -8 0 L 8 0 M 3 -5 L 8 0 L 3 5"
            stroke={colors.creation.cream}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </Svg>
      </Pressable>
      {canFinish ? <Text style={styles.doneLabel}>Done</Text> : null}

      {hasStrokes ? (
        <Pressable
          onPress={onClear}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Clear"
          style={[styles.textButton, { left: 328 - 40 }]}
        >
          <Text style={styles.textButtonLabel}>Clear</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { position: 'absolute', left: PAD.x, top: PAD.y, width: PAD.w, height: PAD.h },
  controls: { position: 'absolute', left: 0, top: 0, width: DESIGN_WIDTH, height: 844 },
  textButton: { position: 'absolute', top: 738, width: 80, height: 28, alignItems: 'center', justifyContent: 'center' },
  textButtonLabel: {
    fontFamily: 'Figtree-Regular',
    fontSize: 13,
    color: colors.creation.cream,
    opacity: 0.7,
  },
  done: { position: 'absolute', left: DESIGN_WIDTH / 2 - 28, top: 720, width: 56, height: 56 },
  doneLabel: {
    position: 'absolute',
    left: 0,
    width: DESIGN_WIDTH,
    top: 783,
    textAlign: 'center',
    fontFamily: 'Figtree-Regular',
    fontSize: 12,
    color: colors.creation.cream,
    opacity: 0.7,
  },
});
