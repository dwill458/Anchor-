import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CircularAnchorRenderer } from '@/components/v2/anchor/CircularAnchorRenderer';
import { colors, typography } from '@/theme/v2';
import type { GeneratedAnchorCandidate } from '@/constants/v2/creation';
import { SealMedallion } from './SealMedallion';
import type { AnchorPoint } from '@/components/v2/anchor/anchorStructure';
import { SurfaceSweep } from './SurfaceSweep';

export function CandidatePager({ svg, category, candidates, chosen, stage, disabled, reduceMotion, onSelect, points, onKeep, onCommitted, onMeasure }: {
  svg: string; category?: string; candidates: GeneratedAnchorCandidate[]; chosen: number;
  stage: { width: number; height: number }; disabled: boolean; reduceMotion: boolean; onSelect: (index: number) => void;
  points: AnchorPoint[]; onKeep: () => void; onCommitted: () => void;
  onMeasure: (rect: { x: number; y: number; width: number; height: number }) => void;
}) {
  const [interacting, setInteracting] = useState(false);
  const pager = useRef<ScrollView>(null);
  const [seen, setSeen] = useState(() => new Set([Math.max(0, chosen)]));
  const size = Math.max(44, Math.min(stage.width, stage.height - 84));
  useEffect(() => {
    pager.current?.scrollTo({ x: Math.max(0, chosen) * stage.width, animated: false });
    setSeen((previous) => new Set([...previous, Math.max(0, chosen)]));
  }, [chosen, stage.width]);
  return <View style={[StyleSheet.absoluteFill, styles.center]}>
    <ScrollView ref={pager} horizontal pagingEnabled scrollEnabled={!disabled && !interacting} showsHorizontalScrollIndicator={false}
      style={{ width: stage.width, flexGrow: 0 }} contentContainerStyle={styles.center}
      onMomentumScrollEnd={(event) => {
        const index = Math.max(0, Math.min(candidates.length - 1, Math.round(event.nativeEvent.contentOffset.x / stage.width)));
        if (!interacting && !disabled) onSelect(index);
      }} testID="candidate-pager">
      {candidates.slice(0, 2).map((candidate, index) => <View key={candidate.variationId ?? candidate.imageUrl}
        style={[styles.center, { width: stage.width }]}>
        <Pressable onPress={() => onSelect(index)} disabled={disabled || interacting} accessibilityRole="radio"
          accessible={chosen !== index}
          accessibilityLabel={`Anchor interpretation ${index === 0 ? 'one' : 'two'}`}
          accessibilityState={{ selected: chosen === index, disabled }} testID={`candidate-${index}`}
          style={{ width: size }}>
          <SealMedallion points={points} size={size} active={chosen === index} disabled={disabled} reduceMotion={reduceMotion}
            onKeep={onKeep} onInteraction={setInteracting} onCommitted={onCommitted} onMeasure={onMeasure}>
            <CircularAnchorRenderer svg={svg} imageUrl={candidate.imageUrl} category={category} size={size} appearance="paper" />
            <SurfaceSweep size={size} play={seen.has(index)} reduceMotion={reduceMotion} />
          </SealMedallion>
        </Pressable>
        <Text style={styles.label}>{index === 0 ? 'Form I' : 'Form II'}</Text>
      </View>)}
    </ScrollView>
    <View style={styles.indicator}>
      {candidates.slice(0, 2).map((_, index) => <Pressable key={index} onPress={() => onSelect(index)} disabled={disabled || interacting}
        accessibilityRole="button" accessibilityLabel={`Show Form ${index === 0 ? 'I' : 'II'}`}
        accessibilityState={{ selected: chosen === index }} style={styles.dotTouch}>
        <View style={[styles.dot, { opacity: chosen === index ? 1 : 0.25 }]} />
      </Pressable>)}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { ...typography.labelSM, color: colors.text.primary, marginTop: 8 },
  indicator: { flexDirection: 'row' },
  dotTouch: { width: 44, height: 28, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.ink.base },
});
