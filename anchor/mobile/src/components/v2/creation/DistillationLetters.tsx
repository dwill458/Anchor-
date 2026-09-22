import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';

import { colors, typography } from '@/theme/v2';
import {
  buildDistillationRenderModel,
  computeCompactionTargets,
  distillationSchedule,
  isCellRemoved,
  DISTILL_EASING,
  DISTILL_TIMING,
  type CompactionTarget,
  type DistillationCell,
  type DistillationStage,
  type MeasuredLetter,
} from './distillationMotion';

/** Gap between letters once they have closed up, in the compacted row. */
const COMPACT_TRACKING = 14;

type Glow = { progress: SharedValue<number>; arrivals: number[]; accent: string };

/**
 * One character of the intention. It is never replaced or re-mounted: the same view either
 * fades away (if it is removed) or travels to its slot in the settled sequence (if it
 * survives), and later lights up when formation places its point.
 */
function DistillationLetter({
  cell,
  stage,
  target,
  reduceMotion,
  glow,
  onMeasure,
}: {
  cell: DistillationCell;
  stage: DistillationStage;
  target?: CompactionTarget;
  reduceMotion: boolean;
  glow?: Glow;
  onMeasure: (keptIndex: number, box: { x: number; y: number; width: number; height: number }) => void;
}) {
  const removed = isCellRemoved(cell, stage);
  const compacting = cell.keep && Boolean(target) && (stage === 'compact' || stage === 'settled');
  const delay = cell.staggerIndex * DISTILL_TIMING.letterStagger;

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (!cell.keep) return;
      const { x, y, width, height } = event.nativeEvent.layout;
      onMeasure(cell.keptIndex, { x, y, width, height });
    },
    [cell.keep, cell.keptIndex, onMeasure],
  );

  const motionStyle = useAnimatedStyle(() => {
    const dx = compacting && target ? target.dx : 0;
    const dy = compacting && target ? target.dy : 0;
    const settledScale = compacting && target ? target.scale : 1;
    const opacity = removed ? 0 : 1;
    // A removed character shrinks slightly as it goes — a soft withdrawal, never an error state.
    const scale = removed ? 0.86 : settledScale;

    if (reduceMotion) {
      return { opacity, transform: [{ translateX: dx }, { translateY: dy }, { scale }] };
    }

    const fade = { duration: DISTILL_TIMING.letterFade, easing: DISTILL_EASING };
    const travel = { duration: DISTILL_TIMING.compact, easing: DISTILL_EASING };
    return {
      opacity: withDelay(removed ? delay : 0, withTiming(opacity, fade)),
      transform: [
        { translateX: withTiming(dx, travel) },
        { translateY: withTiming(dy, travel) },
        { scale: withDelay(removed ? delay : 0, withTiming(scale, removed ? fade : travel)) },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removed, compacting, target?.dx, target?.dy, target?.scale, delay, reduceMotion]);

  // Kept separate from the motion style so formation's per-frame progress never restarts the
  // distillation timings.
  const arrival = cell.keep && glow ? glow.arrivals[cell.keptIndex] ?? -1 : -1;
  const glowStyle = useAnimatedStyle(() => {
    if (!glow || arrival < 0) return {};
    const lit = glow.progress.value >= arrival ? 1 : 0;
    return { color: interpolateColor(lit, [0, 1], [colors.text.primary, glow.accent]) };
  }, [arrival, glow]);

  return (
    <Animated.Text onLayout={handleLayout} style={[styles.char, cell.keep && styles.charKept, motionStyle, glowStyle]}>
      {cell.char}
    </Animated.Text>
  );
}

/**
 * Letter Distillation — one continuous reduction of the phrase the user just wrote.
 *
 * The intention arrives whole, the vowels go, the repeats go, and the letters left standing
 * physically travel together into the sequence the Anchor is built from. Both the
 * classification and the letters come from the production distillation algorithm — this
 * component computes no letters of its own.
 */
export function DistillationLetters({
  intention,
  letters,
  reduceMotion,
  glow,
  onStage,
}: {
  intention: string;
  letters: string[];
  reduceMotion: boolean;
  /** Formation's progress, lighting each letter as its point is placed. */
  glow?: Glow;
  onStage?: (stage: DistillationStage) => void;
}) {
  const model = useMemo(() => buildDistillationRenderModel(intention), [intention]);
  const [stage, setStage] = useState<DistillationStage>('whole');
  const [targets, setTargets] = useState<Map<number, CompactionTarget> | null>(null);
  const { keptCount, lastStaggerIndex } = model;
  const onStageRef = useRef(onStage);
  onStageRef.current = onStage;

  useEffect(() => {
    onStageRef.current?.(stage);
  }, [stage]);

  useEffect(() => {
    setStage('whole');
    if (reduceMotion) {
      // Reduced motion still opens on the phrase, then presents the settled sequence
      // outright — the causal story without the cascade or the travel.
      const settle = setTimeout(() => setStage('settled'), DISTILL_TIMING.reducedHold);
      return () => clearTimeout(settle);
    }
    const at = distillationSchedule(lastStaggerIndex);
    const timers = [
      setTimeout(() => setStage('vowels'), at.vowels),
      setTimeout(() => setStage('repeats'), at.repeats),
      setTimeout(() => setStage('compact'), at.compact),
      setTimeout(() => setStage('settled'), at.settled),
    ];
    return () => timers.forEach(clearTimeout);
  }, [intention, reduceMotion, lastStaggerIndex]);

  /**
   * Letter boxes arrive relative to their word and words relative to the stage, so the row
   * is only solvable once every piece of both has landed — hence a recompute per arrival.
   */
  const measured = useRef({
    stage: null as { width: number; height: number } | null,
    words: new Map<number, { x: number; y: number }>(),
    letters: new Map<number, MeasuredLetter>(),
  });

  const recompute = useCallback(() => {
    const { stage: box, words, letters: boxes } = measured.current;
    if (!box || keptCount === 0) return;
    if (boxes.size !== keptCount || words.size !== model.words.length) return;

    const absolute: MeasuredLetter[] = [];
    for (const [wordIndex, word] of model.words.entries()) {
      const origin = words.get(wordIndex);
      if (!origin) return;
      for (const cell of word.cells) {
        if (!cell.keep) continue;
        const letter = boxes.get(cell.keptIndex);
        if (!letter) return;
        absolute.push({ ...letter, x: origin.x + letter.x, y: origin.y + letter.y });
      }
    }
    setTargets(computeCompactionTargets(absolute, box, { tracking: COMPACT_TRACKING }));
  }, [keptCount, model.words]);

  useEffect(() => {
    measured.current = { stage: null, words: new Map(), letters: new Map() };
    setTargets(null);
  }, [intention]);

  const onStageLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    measured.current.stage = { width, height };
    recompute();
  };
  const onWordLayout = (wordIndex: number) => (event: LayoutChangeEvent) => {
    const { x, y } = event.nativeEvent.layout;
    measured.current.words.set(wordIndex, { x, y });
    recompute();
  };
  const onLetterMeasure = useCallback(
    (keptIndex: number, box: { x: number; y: number; width: number; height: number }) => {
      measured.current.letters.set(keptIndex, { keptIndex, ...box });
      recompute();
    },
    [recompute],
  );

  const settled = stage === 'settled';
  const lettersLabel = `Distilled letters: ${letters.join(', ')}`;
  // Reduced motion never measures a travel, so it presents the sequence as a settled line.
  const presentAsRow = settled && (reduceMotion || !targets);

  return (
    <View style={styles.stage} onLayout={onStageLayout} pointerEvents="none">
      {presentAsRow ? (
        <Text style={styles.settledRow} accessibilityLabel={lettersLabel} testID="distillation-letters">
          {letters.join('  ')}
        </Text>
      ) : (
        <View style={styles.phrase} accessible accessibilityLabel={settled ? lettersLabel : intention} testID="distillation-phrase">
          {model.words.map((word, wordIndex) => (
            <View key={wordIndex} style={styles.word} onLayout={onWordLayout(wordIndex)}>
              {word.cells.map((cell, cellIndex) => (
                <DistillationLetter
                  key={cellIndex}
                  cell={cell}
                  stage={stage}
                  target={targets?.get(cell.keptIndex)}
                  reduceMotion={reduceMotion}
                  glow={glow}
                  onMeasure={onLetterMeasure}
                />
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, justifyContent: 'center' },
  // The phrase fills the stage, so every measured word and letter position is stage-relative,
  // which is what the compaction targets are solved in.
  phrase: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center' },
  // A word stays one unbreakable unit, so wrapping happens between words and never inside one.
  word: { flexDirection: 'row', marginRight: 8 },
  char: { ...typography.headingXL, color: colors.text.tertiary },
  charKept: { color: colors.text.primary },
  settledRow: { ...typography.headingXL, color: colors.text.primary, textAlign: 'center', letterSpacing: 2 },
});
