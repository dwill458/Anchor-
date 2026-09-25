import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { colors, typography } from '@/theme/v2';
import { creationDelay, creationSequence, creationTiming } from './creationMotion';
import {
  buildDistillationRenderModel,
  computeCompactionTargets,
  distillationSchedule,
  estimateCompactionTargets,
  isCellRemoved,
  DISTILL_EASING,
  DISTILL_TIMING,
  type CompactionTarget,
  type DistillationCell,
  type DistillationStage,
  type MeasuredLetter,
} from './distillationMotion';
import { creationTimingTracker } from './creationTelemetry';


/** Gap between letters once they have closed up, in the compacted row. */
const COMPACT_TRACKING = 16;
/** How far a dimmed letter fades before it withdraws: still legible, clearly leaving. */
const DIMMED = 0.3;

/** Formation's clock, lighting each letter as it leaves the row for its cell. */
export type DistillationGlow = { progress: SharedValue<number>; departures: number[]; accent: string };

/** Where each surviving letter settled, by its slot, in the stage's own coordinates. */
export type SettledSlots = Map<number, { x: number; y: number }>;

/**
 * One character of the intention. It is never replaced or re-mounted: the same view either
 * dims and withdraws (if it is removed) or travels to its slot in the settled sequence (if it
 * survives), and later lights up when formation carries it to its cell.
 */
function DistillationLetter({
  cell,
  stage,
  target,
  reduceMotion,
  instant,
  glow,
  onMeasure,
}: {
  cell: DistillationCell;
  stage: DistillationStage;
  target?: CompactionTarget;
  reduceMotion: boolean;
  /** Place the letter where it belongs without travel (a resumed formation). */
  instant: boolean;
  glow?: DistillationGlow;
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

    if (reduceMotion || instant) {
      return { opacity: removed ? 0 : 1, transform: [{ translateX: dx }, { translateY: dy }, { scale: removed ? 0.86 : settledScale }] };
    }

    const travel = { duration: DISTILL_TIMING.compact, easing: DISTILL_EASING };
    if (removed) {
      // Dim first, so the eye can see which letters are leaving; then withdraw, slightly
      // smaller and lower — a quiet release, never an error state.
      const dim = { duration: DISTILL_TIMING.letterDim, easing: DISTILL_EASING };
      const fade = { duration: DISTILL_TIMING.letterFade, easing: DISTILL_EASING };
      return {
        opacity: creationDelay(delay, creationSequence(creationTiming(DIMMED, dim), creationDelay(DISTILL_TIMING.dimHold, creationTiming(0, fade)))),
        transform: [
          { translateX: 0 },
          { translateY: creationDelay(delay + DISTILL_TIMING.letterDim + DISTILL_TIMING.dimHold, creationTiming(5, fade)) },
          { scale: creationDelay(delay + DISTILL_TIMING.letterDim + DISTILL_TIMING.dimHold, creationTiming(0.84, fade)) },
        ],
      };
    }
    return {
      opacity: creationTiming(1, { duration: DISTILL_TIMING.letterFade }),
      transform: [
        { translateX: creationTiming(dx, travel) },
        { translateY: creationTiming(dy, travel) },
        { scale: creationTiming(settledScale, travel) },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [removed, compacting, target?.dx, target?.dy, target?.scale, delay, reduceMotion, instant]);

  // Kept separate from the motion style so formation's per-frame progress never restarts the
  // distillation timings.
  const departure = cell.keep && glow ? glow.departures[cell.keptIndex] ?? -1 : -1;
  const glowStyle = useAnimatedStyle(() => {
    if (!cell.keep) return {};
    if (glow) {
      if (departure < 0) return { color: '#F4F6FA' };
      // The letter warms to the accent as it leaves for its cell, rather than switching.
      const lit = interpolate(glow.progress.value, [departure - 0.015, departure], [0, 1], 'clamp');
      return { color: interpolateColor(lit, [0, 1], ['#F4F6FA', glow.accent]) };
    }
    // As the distillation stage advances and background deepens toward ink, transition text color to off-white
    const isDarkening = stage === 'compact' || stage === 'settled';
    const isHalfDark = stage === 'repeats';
    const targetColor = isDarkening ? '#F4F6FA' : isHalfDark ? '#C7CAD0' : colors.text.primary;
    return { color: targetColor };
  }, [cell.keep, departure, glow, stage]);

  return (
    <Animated.Text onLayout={handleLayout} style={[styles.char, motionStyle, glowStyle]}>
      {cell.char}
    </Animated.Text>
  );
}

/**
 * Letter Distillation — one continuous reduction of the phrase the user just wrote.
 *
 * The intention arrives whole and untouched. Then, pass by pass, the letters the method
 * removes dim and withdraw — the vowels, then the repeats — and the letters left standing
 * physically travel together into the sequence the Anchor is built from, while the original
 * sentence stays faintly above so the relationship is never lost. Both the classification and
 * the letters come from the production distillation algorithm — this component computes no
 * letters of its own.
 */
export function DistillationLetters({
  intention,
  letters,
  reduceMotion,
  glow,
  showSource = true,
  startSettled = false,
  onStage,
  onSlots,
}: {
  intention: string;
  letters: string[];
  reduceMotion: boolean;
  /**
   * Open on the settled sequence, already in place — for a formation resumed after the app
   * was closed. The letters are still the measured, travelling views formation carries on
   * from, so nothing jumps when they leave for their cells.
   */
  startSettled?: boolean;
  glow?: DistillationGlow;
  /** The original sentence, kept faintly present while it is being reduced. */
  showSource?: boolean;
  onStage?: (stage: DistillationStage) => void;
  /** Where the survivors settled, so formation can carry each one on to its cell. */
  onSlots?: (slots: SettledSlots) => void;
}) {
  const model = useMemo(() => buildDistillationRenderModel(intention), [intention]);
  const [stage, setStage] = useState<DistillationStage>(startSettled ? 'settled' : 'whole');
  const [targets, setTargets] = useState<Map<number, CompactionTarget> | null>(null);
  const { keptCount, lastStaggerIndex } = model;
  const onStageRef = useRef(onStage);
  onStageRef.current = onStage;
  const onSlotsRef = useRef(onSlots);
  onSlotsRef.current = onSlots;

  useEffect(() => {
    onStageRef.current?.(stage);
    if (stage === 'settled') {
      creationTimingTracker.record('distillation_end');
    }
  }, [stage]);

  useEffect(() => {
    if (!targets) return;
    const slots: SettledSlots = new Map();
    targets.forEach((target, keptIndex) => slots.set(keptIndex, { x: target.cx, y: target.cy }));
    onSlotsRef.current?.(slots);
  }, [targets]);

  useEffect(() => {
    creationTimingTracker.record('distillation_begin', { intention, letterCount: letters.length, reduceMotion });
    if (startSettled) {
      setStage('settled');
      return undefined;
    }
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
  }, [intention, reduceMotion, lastStaggerIndex, startSettled, letters.length]);

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
    if (!targets && width > 0 && height > 0 && model.keptLetters.length > 0) {
      setTargets(estimateCompactionTargets(model.keptLetters, { width, height }, { tracking: COMPACT_TRACKING }));
    }
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
  const presentAsRow = settled && reduceMotion && !startSettled;

  const sourceVisible = showSource && stage !== 'whole' && !startSettled;
  const sourceStyle = useAnimatedStyle(() => ({
    opacity: reduceMotion ? (sourceVisible ? 0.62 : 0) : creationTiming(sourceVisible ? 0.62 : 0, { duration: 600, easing: DISTILL_EASING }),
  }), [reduceMotion, sourceVisible]);

  return (
    <View style={styles.stage} onLayout={onStageLayout} pointerEvents="none">
      <Animated.View style={[styles.source, sourceStyle]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text style={styles.sourceText} numberOfLines={2}>“{intention}”</Text>
      </Animated.View>
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
                  instant={startSettled}
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
  // Padded (not offset) so it still starts at the stage origin while leaving the top line to
  // the original sentence.
  phrase: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center', paddingTop: 52 },
  // A word stays one unbreakable unit, so wrapping happens between words and never inside one.
  word: { flexDirection: 'row', marginRight: 10 },
  char: { ...typography.headingXL, color: colors.text.primary },
  settledRow: { ...typography.headingXL, color: '#F4F6FA', textAlign: 'center', letterSpacing: 4 },
  source: { position: 'absolute', top: 6, left: 0, right: 0, alignItems: 'center' },
  sourceText: { fontFamily: 'EBGaramond-Medium', fontSize: 20, lineHeight: 25, letterSpacing: -0.2, color: 'rgba(244, 246, 250, 0.65)', textAlign: 'center', fontStyle: 'italic' },
});
