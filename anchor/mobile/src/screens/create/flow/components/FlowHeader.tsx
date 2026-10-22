import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { colors } from '@/theme/colors';
import { DESIGN_WIDTH } from '../creationFlowConfig';

export const FLOW_BEAT_COUNT = 8;

/** Header labels, one per beat. Beat 1 is the Intention screen itself and has none. */
export const FLOW_LABELS = {
  distill: 'DISTILLING YOUR INTENTION',
  map: 'MAPPING YOUR INTENTION',
  forget: 'THE TECHNOLOGY OF FORGETTING',
  style: 'CHOOSE A STYLE',
  form: 'FORMING YOUR ANCHOR',
  choose: 'CHOOSE YOUR ANCHOR',
  seal: 'SEAL YOUR ANCHOR',
  draw: 'DRAW YOUR ANCHOR',
} as const;

const BAR = { x: 62, total: 266, gap: 3, y: 39 };
const SEGMENT_WIDTH = (BAR.total - BAR.gap * (FLOW_BEAT_COUNT - 1)) / FLOW_BEAT_COUNT;

interface FlowHeaderProps {
  /** 1..8: which beat is current. */
  beat: SharedValue<number>;
  /** 0..1 progress through the current beat. */
  progress: SharedValue<number>;
  /** 0..1 for the whole header's visibility (the label has its own fade). */
  labelAlpha: SharedValue<number>;
  label: string;
  onBack: () => void;
  backDisabled?: boolean;
}

/** Back arrow, an 8-segment step bar, and the beat's label. Always sits on cream paper. */
export function FlowHeader({ beat, progress, labelAlpha, label, onBack, backDisabled = false }: FlowHeaderProps) {
  const labelStyle = useAnimatedStyle(() => ({ opacity: 0.85 * labelAlpha.value }));

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Pressable
        onPress={onBack}
        disabled={backDisabled}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 24 }}
        accessibilityRole="button"
        accessibilityLabel="Back"
        accessibilityState={{ disabled: backDisabled }}
        style={styles.back}
      >
        <Svg width={20} height={20} viewBox="0 0 20 20" style={backDisabled ? styles.backDisabled : undefined}>
          <Path
            d="M 13 3 L 6 10 L 13 17 M 6 10 L 19 10"
            stroke={colors.creation.ink}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={0.75}
          />
        </Svg>
      </Pressable>

      <View style={styles.bar} accessibilityRole="progressbar" accessibilityLabel={label}>
        {Array.from({ length: FLOW_BEAT_COUNT }, (_, i) => (
          <Segment key={i} index={i} beat={beat} progress={progress} />
        ))}
      </View>

      <Animated.Text style={[styles.label, labelStyle]} accessibilityRole="header">
        {label}
      </Animated.Text>
    </View>
  );
}

function Segment({ index, beat, progress }: { index: number; beat: SharedValue<number>; progress: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => {
    const current = beat.value - 1;
    const f = index < current ? 1 : index === current ? progress.value : 0;
    return { width: SEGMENT_WIDTH * f };
  });

  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.segmentFill, fill]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: 'absolute', left: 0, top: 0, width: DESIGN_WIDTH, height: 96 },
  back: { position: 'absolute', left: 12, top: 30, width: 28, height: 20, justifyContent: 'center' },
  backDisabled: { opacity: 0.3 },
  bar: {
    position: 'absolute',
    left: BAR.x,
    top: BAR.y,
    width: BAR.total,
    height: 2,
    flexDirection: 'row',
    gap: BAR.gap,
  },
  segment: { width: SEGMENT_WIDTH, height: 2, backgroundColor: 'rgba(20, 22, 43, 0.16)' },
  segmentFill: { height: 2, backgroundColor: colors.creation.ink, opacity: 0.9 },
  label: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 66,
    textAlign: 'center',
    fontFamily: 'Figtree-SemiBold',
    fontSize: 11,
    letterSpacing: 2.6,
    color: colors.creation.ink,
  },
});
