import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import { colors, spacing, typography } from '@/theme/v2';
import type { GeneratedAnchorCandidate } from '@/constants/v2/creation';
import type { AnchorPoint } from '@/components/v2/anchor/anchorStructure';
import { SealMedallion } from './SealMedallion';
import { SurfaceSweep } from './SurfaceSweep';

type PairProps = {
  svg: string; category?: string; candidates: GeneratedAnchorCandidate[]; chosen: number;
  stage: { width: number; height: number }; disabled: boolean; reduceMotion: boolean; onSelect: (index: number) => void;
  originSize: number; originY: number; emerge: SharedValue<number>; resolve: SharedValue<number>; handingOff: boolean;
  points: AnchorPoint[]; onKeep: () => void; onCommitted: () => void;
  onMeasure: (rect: { x: number; y: number; width: number; height: number }) => void;
};

/** The existing split composition, with both forms visible and a hold on the selected form. */
export function CandidatePager(props: PairProps) {
  const { stage } = props;
  const [interacting, setInteracting] = useState(false);
  const gap = spacing[3];
  const captionRoom = 52;
  const portrait = stage.height >= stage.width * 1.05;
  const size = Math.max(44, portrait
    ? Math.min(stage.width * 0.64, (stage.height - gap - captionRoom * 2) / 2)
    : Math.min((stage.width - gap - 24) / 2, stage.height - captionRoom));
  return <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="candidate-pair">
    {/* // DEFERRED: horizontal pager and page indicators; both interpretations are on screen. */}
    {props.candidates.slice(0, 2).map((candidate, index) => <PairForm key={candidate.variationId ?? candidate.imageUrl}
      {...props} candidate={candidate} index={index} size={size} interacting={interacting} onInteraction={setInteracting}
      slotX={props.candidates.length === 1 ? stage.width / 2 : portrait ? stage.width * (index === 0 ? 0.38 : 0.62) : stage.width / 2 + (index === 0 ? -1 : 1) * (size + gap) / 2}
      slotY={stage.height / 2 - captionRoom / 2 + (props.candidates.length === 1 ? 0 : portrait ? (index === 0 ? -1 : 1) * (size + captionRoom + gap) / 2 : 0)} />)}
  </View>;
}

function PairForm({ candidate, index, size, slotX, slotY, interacting, onInteraction, ...props }: PairProps & {
  candidate: GeneratedAnchorCandidate; index: number; size: number; slotX: number; slotY: number;
  interacting: boolean; onInteraction: (locked: boolean) => void;
}) {
  const selected = props.chosen === index;
  const { emerge, resolve, originSize, originY, stage, reduceMotion, handingOff } = props;
  const style = useAnimatedStyle(() => {
    const e = reduceMotion ? 1 : emerge.value;
    const x = stage.width / 2 + (slotX - stage.width / 2) * e;
    const y = originY + (slotY - originY) * e;
    const scale = originSize / size + (1 - originSize / size) * e;
    // Keep the sealed source where it was measured; the existing Home arrival carries it.
    const away = handingOff && !selected ? resolve.value : 0;
    return { opacity: interpolate(e, [0, 0.55], [0, 1], 'clamp') * (selected ? 1 : 0.82) * (1 - away),
      transform: [{ translateX: x - size / 2 }, { translateY: y - size / 2 }, { scale }] };
  });
  return <Animated.View style={[styles.form, { width: size }, style]}>
    <Pressable onPress={() => props.onSelect(index)} disabled={props.disabled || interacting}
      accessible={!selected} accessibilityRole="radio" accessibilityLabel={`Anchor interpretation ${index === 0 ? 'one' : 'two'}`}
      accessibilityState={{ selected, disabled: props.disabled || interacting }} testID={`candidate-${index}`}>
      <SealMedallion points={props.points} size={size} active={selected} disabled={props.disabled} reduceMotion={reduceMotion}
        onKeep={props.onKeep} onInteraction={onInteraction} onCommitted={props.onCommitted} onMeasure={props.onMeasure}>
        <CircularAnchorRenderer svg={props.svg} imageUrl={candidate.imageUrl} category={props.category} size={size} appearance="paper" />
        <SurfaceSweep size={size} play reduceMotion={reduceMotion} />
      </SealMedallion>
    </Pressable>
    <Text style={[styles.label, { opacity: selected ? 1 : 0.7 }]}>{index === 0 ? 'Form I' : 'Form II'}</Text>
  </Animated.View>;
}
const styles = StyleSheet.create({
  form: { position: 'absolute', top: 0, left: 0 },
  label: { ...typography.labelSM, color: colors.text.primary, textAlign: 'center', marginTop: 8 },
});
