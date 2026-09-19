import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Modal, PanResponder, Platform, Pressable, StyleSheet, Text, TextInput, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, withDelay, withTiming } from 'react-native-reanimated';
import { ArrowLeft, Check, Info, X } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CircularAnchorRenderer, V2Button, V2IconButton, V2Screen, V2Surface } from '@/components/v2';
import { V2ActivityIndicator, V2InlineError } from '@/components/v2/feedback/V2Feedback';
import { AnalyticsService } from '@/services/AnalyticsService';
import { colors, getCategoryColor, getCategorySoftTint, radii, spacing, typography } from '@/theme/v2';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import {
  ANCHOR_EXPRESSIONS,
  CREATION_MAX_INTENTION_LENGTH,
  DISTILLATION_COPY,
  EXPRESSION_LABELS,
  STRUCTURE_DESCRIPTIONS,
  STRUCTURE_LABELS,
  type AnchorExpression,
  type CanonicalStructure,
  type CreationStep,
} from '@/constants/v2/creation';
import {
  structureSvgForDraft,
  useCreationStore,
  type AnchorCandidate,
  type CreationContinuation,
  type CreationDraft,
  type DrawnPath,
} from '@/stores/v2/creationStore';
import { InkUnderline } from './InkUnderline';
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
import { assessIntention, type PrincipleState } from './intentionGuidance';

export type CreationSaveAdapter = (input: {
  draft: CreationDraft;
  candidate: AnchorCandidate;
  idempotencyKey: string;
}) => Promise<{ anchorId: string }>;

export interface V2CreationFlowProps {
  /** Integration supplies persistence; this module deliberately owns no backend contract. */
  saveAnchor?: CreationSaveAdapter;
  /** Integration turns continuation intent into a route after central navigation is registered. */
  onContinue?: (continuation: CreationContinuation) => void;
  /** A provider can replace the deterministic visual candidates without changing formation state. */
  generateCandidates?: (draft: CreationDraft) => Promise<AnchorCandidate[]>;
}

const track = (event: string, properties?: Record<string, string | boolean | number>) => {
  AnalyticsService.track(event, properties);
};

/** Back targets. Every hop is a pure `setStep` — the draft is never mutated by going back. */
const backStep: Partial<Record<CreationStep, CreationStep>> = {
  distillation: 'intention',
  structure: 'distillation',
  draw: 'structure',
  expression: 'structure',
  generation: 'expression',
  candidates: 'generation',
  save: 'candidates',
};

/**
 * Appearance-only finish treatments, ported from UI-B's ExpressionArtwork so first-run and normal
 * creation render the same 13 finishes identically. Geometry is never touched here.
 */
const expressionTreatment: Record<AnchorExpression, ViewStyle> = {
  original: {},
  monoline: { opacity: 0.58, transform: [{ scale: 0.92 }] },
  architectural: { opacity: 0.82 },
  foil: { opacity: 0.92 },
  embossed: { opacity: 0.7, transform: [{ translateY: 1 }] },
  etched: { opacity: 0.72 },
  ink: { opacity: 1, transform: [{ scale: 1.03 }] },
  halo: { shadowColor: '#8B5CF6', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  glass: { opacity: 0.55 },
  radiant: { shadowColor: '#F28A2E', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  organic: { transform: [{ rotate: '-1deg' }] },
  woven: { opacity: 0.8 },
  cut_paper: { transform: [{ translateY: -2 }], shadowColor: '#171717', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 3 } },
};

/** One-line finish descriptions, ported from UI-B's expressionCopy (cutpaper → cut_paper). */
const expressionCopy: Record<AnchorExpression, string> = {
  original: 'Baseline generated form',
  monoline: 'Ultra-fine technical line',
  architectural: 'Precision guide construction',
  foil: 'Warm metallic finish',
  embossed: 'Tactile paper relief',
  etched: 'Fine engraved finish',
  ink: 'Textured drawn finish',
  halo: 'Soft luminous edge',
  glass: 'Refractive transparent finish',
  radiant: 'Focal vertex light',
  organic: 'Textured natural line',
  woven: 'Textured fiber finish',
  cut_paper: 'Layered dimensional relief',
};

type ArtSize = 'hero' | 'large' | 'medium' | 'thumbnail';

function AnchorArt({ svg, category, expression, size, label }: { svg?: string; category?: string; expression?: AnchorExpression; size: ArtSize; label: string }) {
  if (!svg) {
    return <View style={[styles.artEmpty, size === 'thumbnail' && styles.artEmptyThumb]}><Text style={styles.artEmptyText}>Your form will appear here.</Text></View>;
  }
  return (
    <View style={[styles.artWrap, expression ? expressionTreatment[expression] : undefined]}>
      <CircularAnchorRenderer svg={svg} category={category} size={size} accessibilityLabel={label} />
    </View>
  );
}

const pointsToPath = (points: Array<{ x: number; y: number }>) =>
  points.length ? `M ${points[0].x} ${points[0].y} ${points.slice(1).map((point) => `L ${point.x} ${point.y}`).join(' ')}` : '';

const INTENTION_EXAMPLES: Record<string, { before: string; after: string }> = {
  focus: { before: 'I want to stop getting distracted.', after: 'I am fully present with my work.' },
  performance: { before: 'I hope I play well.', after: 'I compete with calm confidence.' },
  growth: { before: 'I want my business to grow.', after: 'I build my business with consistent action.' },
  personal: { before: "I don't want to doubt myself.", after: 'I trust myself when I make decisions.' },
  career: { before: 'I want to stop getting distracted.', after: 'I am fully present with my work.' },
};

/** Enforces the limit even when text arrives by paste/autofill, and keeps the intention to one flowing line of prose. */
export function sanitizeIntention(value: string): string {
  let next = value.replace(/\s*[\r\n]+\s*/g, ' ');
  if (next.length > CREATION_MAX_INTENTION_LENGTH) {
    next = next.slice(0, CREATION_MAX_INTENTION_LENGTH);
    // Never leave half of a surrogate pair (emoji) at the cut.
    const last = next.charCodeAt(next.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) next = next.slice(0, -1);
  }
  return next;
}

function PrinciplesSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  // A sheet opened from a text field should not stack under a lingering keyboard.
  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
         <SafeAreaView edges={['bottom']} style={styles.sheetInner}>
          <View style={styles.sheetHandle} />
          <Pressable style={styles.sheetCloseBtn} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" hitSlop={8}>
            <X size={15} color={colors.text.secondary} />
          </Pressable>
          <Text style={styles.sheetTitle} accessibilityRole="header">Short · Present · Felt</Text>
          <View style={styles.sheetItem}>
            <Text style={styles.sheetItemLabel}>SHORT</Text>
            <Text style={styles.sheetItemBody}>One intention. One direction.</Text>
          </View>
          <View style={styles.sheetItem}>
            <Text style={styles.sheetItemLabel}>PRESENT</Text>
            <Text style={styles.sheetItemBody}>Write it as true now, not as something you’re trying to escape.</Text>
            <View style={styles.sheetExample}>
              <View style={styles.hintRow}>
                <Text style={styles.hintTag}>Instead of </Text>
                <Text style={styles.hintQuoteBad}>“I don’t want to procrastinate.”</Text>
              </View>
              <View style={styles.hintRow}>
                <Text style={styles.hintTagTry}>TRY </Text>
                <Text style={styles.hintQuoteGood}>“I begin important work immediately.”</Text>
              </View>
            </View>
          </View>
          <View style={styles.sheetItem}>
            <Text style={styles.sheetItemLabel}>FELT</Text>
            <Text style={styles.sheetItemBody}>Use words that feel personally meaningful.</Text>
          </View>
          <V2Button size="large" style={styles.sheetDismissBtn} onPress={onClose}>
            Got it
          </V2Button>
         </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * Integration-safe fallback: exactly two candidates that share one identical structure SVG.
 * Only the finish (`expression`) differs — the geometry is never regenerated per candidate.
 */
const initialCandidates = (draft: CreationDraft): AnchorCandidate[] => {
  const structureSvg = structureSvgForDraft(draft) ?? '';
  const chosen = draft.expression ?? 'original';
  const alternate: AnchorExpression = chosen === 'original' ? 'foil' : 'original';
  return [
    { id: `${draft.draftId}-candidate-1`, structureSvg, expression: chosen },
    { id: `${draft.draftId}-candidate-2`, structureSvg, expression: alternate },
  ];
};

function DrawStructure({ onComplete }: { onComplete: (paths: DrawnPath[]) => void }) {
  const savedPaths = useCreationStore((state) => state.draft?.drawnPaths ?? []);
  const letters = useCreationStore((state) => state.draft?.distilledLetters ?? []);
  const [paths, setPaths] = useState<DrawnPath[]>(savedPaths);
  const [current, setCurrent] = useState<Array<{ x: number; y: number }>>([]);
  const currentRef = useRef<Array<{ x: number; y: number }>>([]);
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      currentRef.current = [point];
      setCurrent([point]);
    },
    onPanResponderMove: (event) => {
      const point = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      currentRef.current = [...currentRef.current, point];
      setCurrent(currentRef.current);
    },
    onPanResponderRelease: () => {
      if (currentRef.current.length > 1) setPaths((previous) => [...previous, { points: currentRef.current, stroke: colors.text.primary, strokeWidth: 3 }]);
      currentRef.current = [];
      setCurrent([]);
    },
  })).current;
  const rendered = [...paths, current.length > 1 ? { points: current, stroke: colors.text.primary, strokeWidth: 3 } : null].filter(Boolean) as DrawnPath[];
  return (
    <View style={styles.stack}>
      <Text style={styles.eyebrow}>DISTILLED LETTERS</Text>
      <Text style={styles.letters}>{letters.join('  ')}</Text>
      <V2Surface padded={false} style={styles.canvasSurface}>
        <View style={styles.canvas} accessibilityLabel="Drawing canvas. Draw your structure using the distilled letters." {...responder.panHandlers}>
          <Svg width="100%" height="100%" viewBox="0 0 320 320">
            {rendered.map((path, index) => <Path key={index} d={pointsToPath(path.points)} stroke={path.stroke} strokeWidth={path.strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />)}
          </Svg>
        </View>
      </V2Surface>
      <View style={styles.row}>
        <V2Button variant="secondary" size="compact" style={styles.rowButton} onPress={() => setPaths((previous) => previous.slice(0, -1))} accessibilityLabel="Undo last stroke">Undo</V2Button>
        <V2Button variant="secondary" size="compact" style={styles.rowButton} onPress={() => setPaths([])} accessibilityLabel="Clear drawing">Reset</V2Button>
      </View>
      <V2Button size="large" disabled={!paths.length} onPress={() => onComplete(paths)} accessibilityLabel="Use this drawn structure">Use this structure</V2Button>
    </View>
  );
}

export function V2CreationFlow({ saveAnchor, onContinue, generateCandidates }: V2CreationFlowProps) {
  const draft = useCreationStore((state) => state.draft);
  const start = useCreationStore((state) => state.start);
  const setIntention = useCreationStore((state) => state.setIntention);
  const distill = useCreationStore((state) => state.distill);
  const selectStructure = useCreationStore((state) => state.selectStructure);
  const setDrawnPaths = useCreationStore((state) => state.setDrawnPaths);
  const selectExpression = useCreationStore((state) => state.selectExpression);
  const setStep = useCreationStore((state) => state.setStep);
  const setGenerationState = useCreationStore((state) => state.setGenerationState);
  const setCandidates = useCreationStore((state) => state.setCandidates);
  const selectCandidate = useCreationStore((state) => state.selectCandidate);
  const beginSave = useCreationStore((state) => state.beginSave);
  const completeSave = useCreationStore((state) => state.completeSave);
  const failSave = useCreationStore((state) => state.failSave);
  const reduceMotion = useV2ReduceMotion();
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!draft) {
      start();
      track('v2_creation_started');
    }
  }, [draft, start]);

  const structureSvg = useMemo(() => (draft ? structureSvgForDraft(draft) : undefined), [draft]);
  if (!draft) return null;

  const category = draft.category;
  const accent = getCategoryColor(category);
  const step = draft.currentStep;

  const intentionTrimmed = draft.intention ? draft.intention.trim() : '';
  const wordCount = intentionTrimmed ? intentionTrimmed.split(/\s+/).length : 0;
  const isIntentionReady = intentionTrimmed.length > 2;
  const isIntentionTooLong = wordCount > 14;
  const intentionCategoryKey = draft.category?.toLowerCase() ?? 'focus';
  const intentionExample = INTENTION_EXAMPLES[intentionCategoryKey] ?? INTENTION_EXAMPLES.focus;
  const guidance: Record<string, PrincipleState> = { ...assessIntention(draft.intention ?? '') };
  const metPrinciples = (['short', 'present'] as const).filter((id) => guidance[id] === 'met');

  const goBack = () => {
    const target = backStep[step];
    if (target) {
      setIntegrationError(null);
      setStep(target);
    }
  };
  const goToDistillation = () => {
    distill();
    if (useCreationStore.getState().draft?.formationError) return;
    track('v2_creation_intention_completed');
  };
  /** Distillation is complete only once the user has watched the letters settle. */
  const goToStructure = () => {
    track('v2_creation_distillation_completed');
    setStep('structure');
  };
  const chooseStructure = (structure: CanonicalStructure) => {
    v2Haptics.selection();
    selectStructure(structure);
    track('v2_creation_structure_selected', { structure });
  };
  const runGeneration = async () => {
    setIntegrationError(null);
    setGenerationState('generating');
    track('v2_creation_generation_started');
    try {
      const candidates = generateCandidates
        ? await generateCandidates({ ...draft, structureSvg })
        : initialCandidates({ ...draft, structureSvg });
      if (candidates.length !== 2) throw new Error('Generation must return exactly two candidates.');
      setCandidates(candidates);
      v2Haptics.confirmation();
      track('v2_creation_generation_completed', { candidate_count: candidates.length });
    } catch {
      setGenerationState('error');
      setIntegrationError('Generation could not finish. Your draft is still intact.');
    }
  };
  const save = async () => {
    const requestId = beginSave();
    const current = useCreationStore.getState().draft;
    const candidate = current?.candidates?.find((item) => item.id === current.selectedCandidateId);
    if (!requestId || !current || !candidate) return;
    if (!saveAnchor) {
      failSave();
      setIntegrationError('Saving requires the integration branch to supply the existing Anchor persistence adapter.');
      return;
    }
    try {
      const result = await saveAnchor({ draft: current, candidate, idempotencyKey: requestId });
      completeSave(result.anchorId);
      v2Haptics.completion();
      track('v2_creation_saved');
    } catch {
      failSave();
      setIntegrationError('Your Anchor was not saved. You can retry without losing this draft.');
    }
  };
  const continueWith = (type: CreationContinuation['type']) => {
    if (!draft.persistedAnchorId) return;
    onContinue?.({ type, anchorId: draft.persistedAnchorId });
    track('v2_creation_continuation_selected', { continuation: type });
  };

  return (
    <V2Screen
      scroll
      keyboardAvoiding={step === 'intention'}
      // Intention is a text-entry step: taps on the CTA / info row must land while the keyboard is up,
      // and the content fills the viewport so Continue rests on the bottom safe area.
      keyboardShouldPersistTaps={step === 'intention' ? 'handled' : undefined}
      keyboardDismissMode={step === 'intention' ? (Platform.OS === 'ios' ? 'interactive' : 'on-drag') : undefined}
      contentContainerStyle={step === 'intention' ? styles.intentionContent : undefined}
      testID={`v2-creation-${step}`}
    >
      {backStep[step] ? (
        <View style={styles.top}>
          <V2IconButton icon={<ArrowLeft size={20} color={colors.text.primary} />} accessibilityLabel="Go back" onPress={goBack} />
        </View>
      ) : null}

      {step === 'intention' && (
        <View style={[styles.flow, styles.intentionFlow]}>
          <View style={styles.heroBlock}>
            {!isFocused && <Text style={styles.eyebrow}>INTENTION</Text>}
            <View accessible accessibilityRole="header" accessibilityLabel="Every Anchor starts here.">
              <Text style={[styles.heroHeadline, isFocused && styles.heroHeadlineFocused]} accessible={false}>
                Every Anchor starts
              </Text>
              <InkUnderline>
                <Text style={[styles.heroHeadline, isFocused && styles.heroHeadlineFocused]} accessible={false}>here.</Text>
              </InkUnderline>
            </View>
            <Text style={styles.heroSubhead}>Write one clear intention.</Text>
          </View>

          <View style={styles.inputBlock}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.fieldLabel}>YOUR INTENTION</Text>
              <Text
                style={[styles.charCounter, draft.intention.length >= CREATION_MAX_INTENTION_LENGTH - 10 && styles.charCounterNear]}
                accessibilityLabel={`${draft.intention.length} of ${CREATION_MAX_INTENTION_LENGTH} characters`}
              >
                {draft.intention.length}/{CREATION_MAX_INTENTION_LENGTH}
              </Text>
            </View>
            <View style={[styles.intentionSurface, isFocused && styles.intentionSurfaceFocused]}>
              <TextInput
                value={draft.intention}
                onChangeText={(text) => setIntention(sanitizeIntention(text))}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="I am fully present with my work."
                placeholderTextColor={colors.text.disabled}
                multiline
                maxLength={CREATION_MAX_INTENTION_LENGTH}
                returnKeyType="done"
                submitBehavior="blurAndSubmit"
                autoCapitalize="sentences"
                selectionColor={colors.text.primary}
                style={styles.intentionInput}
                accessibilityLabel="Your intention"
                testID="intention-input"
              />
            </View>

            {!intentionTrimmed && (
              <View style={styles.hintBlock}>
                <View style={styles.hintRow}>
                  <Text style={styles.hintTag}>Instead of </Text>
                  <Text style={styles.hintQuoteBad}>“{intentionExample.before}”</Text>
                </View>
                <View style={styles.hintRow}>
                  <Text style={styles.hintTagTry}>TRY </Text>
                  <Text style={styles.hintQuoteGood}>“{intentionExample.after}”</Text>
                </View>
              </View>
            )}

            {!!intentionTrimmed && isIntentionTooLong && (
              <Text style={styles.hintGuidance}>Keep it short enough to hold in mind.</Text>
            )}
          </View>

          <View style={styles.intentionSpacer} />

          <View style={styles.intentionBottom}>
            <Pressable
              style={styles.spfBlock}
              onPress={() => setSheetOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`About these principles: short, present, felt.${metPrinciples.length ? ` Looks good: ${metPrinciples.join(', ')}.` : ''}`}
              testID="intention-principles-row"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <View style={styles.spfHeadingRow}>
                <View style={styles.spfList}>
                  {(['short', 'present', 'felt'] as const).map((id, index) => {
                    const met = guidance[id] === 'met';
                    return (
                      <React.Fragment key={id}>
                        {index > 0 ? <Text style={styles.spfDot}>·</Text> : null}
                        <View style={styles.spfItem}>
                          <Text style={[styles.principleLabel, !met && styles.principleLabelQuiet]}>{id.toUpperCase()}</Text>
                          {met ? (
                            <View style={styles.spfCheck}>
                              <Check size={11} color={colors.text.primary} strokeWidth={2.5} />
                            </View>
                          ) : null}
                        </View>
                      </React.Fragment>
                    );
                  })}
                </View>
                <View style={styles.spfInfoIcon}>
                  <Info size={14} color={colors.text.secondary} />
                </View>
              </View>
              <Text style={styles.spfHint}>Three rules for a stronger intention.</Text>
            </Pressable>

            {draft.formationError ? <V2InlineError message={draft.formationError} /> : null}

            <V2Button
              size="large"
              style={styles.ctaButton}
              disabled={!isIntentionReady}
              onPress={goToDistillation}
              accessibilityLabel="Continue to distillation"
            >
              Continue →
            </V2Button>
          </View>

          <PrinciplesSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} />
        </View>
      )}

      {step === 'distillation' && <Distillation draft={draft} reduceMotion={reduceMotion} onContinue={goToStructure} />}

      {step === 'structure' && (
        <View style={styles.flow}>
          <Text style={styles.eyebrow}>CHOOSE STRUCTURE</Text>
          <Text style={styles.title}>Give the form its character</Text>
          <Text style={styles.body}>Each option uses the same distilled letters.</Text>
          {(['focused', 'contained', 'raw', 'drawn'] as CanonicalStructure[]).map((structure) => {
            const preview = structure === 'drawn' ? undefined : structureSvgForDraft({ ...draft, structureType: structure });
            const selected = draft.structureType === structure;
            return (
              <Pressable
                key={structure}
                onPress={() => chooseStructure(structure)}
                style={[styles.choice, selected && { borderColor: accent, backgroundColor: getCategorySoftTint(category) }]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${STRUCTURE_LABELS[structure]} structure. ${STRUCTURE_DESCRIPTIONS[structure]}`}
              >
                <AnchorArt svg={preview} category={category} size="thumbnail" label={`${STRUCTURE_LABELS[structure]} preview using your distilled letters`} />
                <View style={styles.choiceText}>
                  <Text style={styles.choiceTitle}>{STRUCTURE_LABELS[structure]}</Text>
                  <Text style={styles.choiceDescription}>{STRUCTURE_DESCRIPTIONS[structure]}</Text>
                </View>
              </Pressable>
            );
          })}
          <V2Button size="large" disabled={!draft.structureType} onPress={() => setStep(draft.structureType === 'drawn' ? 'draw' : 'expression')}>Continue</V2Button>
        </View>
      )}

      {step === 'draw' && (
        <View style={styles.flow}>
          <Text style={styles.eyebrow}>DRAW YOUR STRUCTURE</Text>
          <Text style={styles.title}>Make the form your own</Text>
          <Text style={styles.body}>Warm paper. Restrained ink. Your source letters stay visible.</Text>
          <DrawStructure onComplete={(paths) => { setDrawnPaths(paths); v2Haptics.confirmation(); track('v2_creation_drawn_completed'); }} />
        </View>
      )}

      {step === 'expression' && (
        <View style={styles.flow}>
          <Text style={styles.eyebrow}>REFINE EXPRESSION</Text>
          <Text style={styles.title}>How it appears</Text>
          <Text style={styles.body}>Structure is what this Anchor is. Expression is how it appears.</Text>
          <View style={styles.previewCenter}>
            <AnchorArt svg={structureSvg} category={category} expression={draft.expression} size="large" label="Anchor expression preview" />
          </View>
          <Text style={styles.structureLock}>Structure preserved · Expression changes appearance only.</Text>
          <View style={styles.expressionGrid}>
            {ANCHOR_EXPRESSIONS.map((expression) => {
              const selected = draft.expression === expression;
              return (
                <Pressable
                  key={expression}
                  onPress={() => { v2Haptics.selection(); selectExpression(expression); track('v2_creation_expression_selected', { expression }); }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${EXPRESSION_LABELS[expression]}. ${expressionCopy[expression]}`}
                  style={[styles.expressionOption, selected && { borderColor: accent, backgroundColor: getCategorySoftTint(category) }]}
                >
                  <AnchorArt svg={structureSvg} category={category} expression={expression} size="thumbnail" label={`${EXPRESSION_LABELS[expression]} finish preview`} />
                  <Text style={styles.choiceTitle}>{EXPRESSION_LABELS[expression]}</Text>
                  <Text style={styles.choiceDescription}>{expressionCopy[expression]}</Text>
                </Pressable>
              );
            })}
          </View>
          <V2Button size="large" disabled={!draft.expression} onPress={runGeneration}>Generate two forms</V2Button>
        </View>
      )}

      {step === 'generation' && (
        <View style={styles.flow}>
          <Text style={styles.eyebrow}>ANCHOR GENERATION</Text>
          <Text style={styles.title}>Shaping your expression</Text>
          {draft.generationState === 'generating' ? (
            <V2ActivityIndicator label="Generating your Anchor" />
          ) : (
            <View style={styles.previewCenter}>
              <AnchorArt svg={structureSvg} category={category} expression={draft.expression} size="large" label="Anchor structure preserved during generation" />
            </View>
          )}
          {integrationError ? <V2InlineError message={integrationError} onRetry={runGeneration} /> : null}
          {draft.generationState !== 'generating' && !integrationError ? (
            <V2Button size="large" onPress={runGeneration}>{draft.generationState === 'error' ? 'Retry generation' : 'Generate two forms'}</V2Button>
          ) : null}
        </View>
      )}

      {step === 'candidates' && (
        <View style={styles.flow}>
          <Text style={styles.eyebrow}>CHOOSE YOUR ANCHOR</Text>
          <Text style={styles.title}>Two expressions. One structure.</Text>
          {draft.candidates?.map((candidate) => {
            const selected = draft.selectedCandidateId === candidate.id;
            return (
              <Pressable
                key={candidate.id}
                onPress={() => { v2Haptics.selection(); selectCandidate(candidate.id); track('v2_creation_candidate_selected'); }}
                style={[styles.candidate, selected && { borderColor: accent, backgroundColor: getCategorySoftTint(category) }]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${EXPRESSION_LABELS[candidate.expression]} candidate`}
              >
                <AnchorArt svg={candidate.structureSvg} category={category} expression={candidate.expression} size="medium" label={`${EXPRESSION_LABELS[candidate.expression]} candidate preview`} />
                <Text style={styles.choiceTitle}>{EXPRESSION_LABELS[candidate.expression]}</Text>
              </Pressable>
            );
          })}
          <V2Button size="large" disabled={!draft.selectedCandidateId} onPress={save}>Save Anchor</V2Button>
        </View>
      )}

      {step === 'save' && (
        <View style={styles.flow}>
          <Text style={styles.eyebrow}>SAVE ANCHOR</Text>
          <Text style={styles.title}>Ready when you are</Text>
          {integrationError ? <V2InlineError message={integrationError} onRetry={save} /> : null}
          <V2Button size="large" loading={draft.saveState === 'saving'} onPress={save}>{draft.saveState === 'error' ? 'Retry save' : 'Save Anchor'}</V2Button>
        </View>
      )}

      {step === 'continue' && (
        <View style={styles.flow}>
          <Text style={styles.eyebrow}>ANCHOR SAVED</Text>
          <Text style={styles.title}>Where would you like to go?</Text>
          <Text style={styles.body}>Your Anchor is complete. Continue in the way that fits now.</Text>
          <V2Button size="large" onPress={() => continueWith('home')}>Return to Anchor</V2Button>
          <V2Button variant="secondary" onPress={() => continueWith('vision')}>Add a Vision</V2Button>
          <V2Button variant="secondary" onPress={() => continueWith('chart')}>Create a Chart</V2Button>
          <V2Button variant="secondary" onPress={() => continueWith('vision_and_chart')}>Add Vision and Chart</V2Button>
        </View>
      )}
    </V2Screen>
  );
}

/** Gap between letters once they have closed up, in the compacted row. */
const COMPACT_TRACKING = 14;

/**
 * One character of the intention. It is never replaced or re-mounted: the same view either
 * fades away (if it is removed) or travels to its slot in the settled sequence (if it
 * survives), which is what makes the sentence and the letters one object instead of two.
 */
function DistillationLetter({
  cell,
  stage,
  target,
  reduceMotion,
  onMeasure,
}: {
  cell: DistillationCell;
  stage: DistillationStage;
  /** Present once the row has been measured; this is what the compaction travels along. */
  target?: CompactionTarget;
  reduceMotion: boolean;
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

  const animatedStyle = useAnimatedStyle(() => {
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

  return (
    <Animated.Text
      onLayout={handleLayout}
      style={[styles.phraseChar, cell.keep && styles.phraseCharKept, animatedStyle]}
    >
      {cell.char}
    </Animated.Text>
  );
}

/** Optional, never forced: the three-line mechanism plus the user's own worked example. */
function DistillationSheet({
  visible,
  onClose,
  intention,
  letters,
}: {
  visible: boolean;
  onClose: () => void;
  intention: string;
  letters: string[];
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheetContainer} onPress={(e) => e.stopPropagation()}>
          <SafeAreaView edges={['bottom']} style={styles.sheetInner}>
            <View style={styles.sheetHandle} />
            <Pressable style={styles.sheetCloseBtn} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" hitSlop={8}>
              <X size={15} color={colors.text.secondary} />
            </Pressable>
            <Text style={styles.sheetTitle} accessibilityRole="header">{DISTILLATION_COPY.howThisWorks}</Text>
            <Text style={styles.sheetItemBody}>{DISTILLATION_COPY.sheetIntro}</Text>
            <View style={styles.mechanismList}>
              {DISTILLATION_COPY.mechanism.map((mechanismStep, index) => (
                <View key={mechanismStep} style={styles.mechanismRow}>
                  <Text style={styles.mechanismIndex}>{index + 1}</Text>
                  <Text style={styles.mechanismStep}>{mechanismStep}</Text>
                </View>
              ))}
            </View>
            {intention && letters.length ? (
              <View style={styles.worked}>
                <Text style={styles.workedLabel}>Your intention</Text>
                <Text style={styles.workedIntention}>{intention}</Text>
                <Text style={styles.workedLabel}>Your letters</Text>
                <Text style={styles.workedLetters}>{letters.join('  ')}</Text>
              </View>
            ) : null}
            <V2Button size="large" style={styles.sheetDismissBtn} onPress={onClose}>
              Got it
            </V2Button>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/**
 * Letter Distillation — one continuous reduction of the phrase the user just wrote.
 *
 * The intention arrives whole, the vowels go, the repeats go, and the letters left standing
 * physically travel together into the sequence the Anchor is built from. Nothing crossfades
 * into a separately-rendered result: the characters on screen at the end are the same views
 * that spelled the sentence at the start, so the causal link is impossible to miss.
 *
 * Both the classification and the letters come from the production distillation algorithm
 * (`@/utils/sigil/distillation`) — this step computes no letters of its own, and the
 * sequence it settles on is exactly what `structureSvgForDraft` is handed next.
 */
function Distillation({ draft, reduceMotion, onContinue }: { draft: CreationDraft; reduceMotion: boolean; onContinue: () => void }) {
  const intention = draft.normalizedIntention ?? '';
  const model = useMemo(() => buildDistillationRenderModel(intention), [intention]);
  const letters = draft.distilledLetters ?? [];

  const [stage, setStage] = useState<DistillationStage>('whole');
  const [targets, setTargets] = useState<Map<number, CompactionTarget> | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { keptCount, lastStaggerIndex } = model;

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
   * is only solvable once every piece of both has landed — hence a recompute per arrival
   * rather than a single measure pass.
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
  // Reduced motion never measures a travel, so it presents the sequence as a settled line.
  const presentAsRow = settled && (reduceMotion || !targets);
  const enter = reduceMotion ? undefined : FadeIn.duration(DISTILL_TIMING.caption);
  const lettersLabel = `Distilled letters: ${letters.join(', ')}`;
  const status = settled ? DISTILLATION_COPY.status.compact : DISTILLATION_COPY.status[stage];

  const ruleStyle = useAnimatedStyle(() => {
    const visible = stage === 'compact' || stage === 'settled' ? 1 : 0;
    if (reduceMotion) return { opacity: visible };
    return { opacity: withTiming(visible, { duration: DISTILL_TIMING.compact, easing: DISTILL_EASING }) };
  }, [stage, reduceMotion]);

  return (
    <View style={styles.flow}>
      <Text style={styles.eyebrow}>{DISTILLATION_COPY.eyebrow}</Text>

      {/* One headline at a time: the old one leaves before the new one fades in, and the
          slot holds a two-line height so the swap never nudges the letters below it. */}
      <View style={styles.titleSlot}>
        <Animated.Text key={settled ? 'settled' : 'transforming'} entering={enter} style={styles.title}>
          {settled ? DISTILLATION_COPY.titleSettled : DISTILLATION_COPY.titleTransforming}
        </Animated.Text>
      </View>

      {/* No card: the words themselves are the hero, on the same cream canvas, at the same
          margins and in the same type the intention was written in. */}
      <View style={styles.distillStage} onLayout={onStageLayout}>
        {presentAsRow ? (
          <Animated.Text entering={enter} style={styles.settledRow} accessibilityLabel={lettersLabel}>
            {letters.join('  ')}
          </Animated.Text>
        ) : (
          <View style={styles.phrase} accessible accessibilityLabel={settled ? lettersLabel : intention} testID="distillation-phrase">
            {model.words.map((word, wordIndex) => (
              <View key={wordIndex} style={styles.phraseWord} onLayout={onWordLayout(wordIndex)}>
                {word.cells.map((cell, cellIndex) => (
                  <DistillationLetter
                    key={cellIndex}
                    cell={cell}
                    stage={stage}
                    target={targets?.get(cell.keptIndex)}
                    reduceMotion={reduceMotion}
                    onMeasure={onLetterMeasure}
                  />
                ))}
              </View>
            ))}
          </View>
        )}
      </View>

      {/* The one restrained handmade mark: a pencil rule that arrives as the letters land. */}
      <Animated.View
        style={[styles.rule, ruleStyle]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      {settled ? (
        <Animated.View entering={enter} style={styles.settledCaption}>
          <Text style={styles.settledLabel}>{DISTILLATION_COPY.settledLabel}</Text>
          <Text style={styles.settledCopy}>{DISTILLATION_COPY.settledCopy}</Text>
        </Animated.View>
      ) : (
        <Text style={styles.distillStatus} accessibilityLiveRegion="polite" testID="distillation-status">
          {status}
        </Text>
      )}

      <V2Button
        size="large"
        style={styles.ctaButton}
        disabled={!settled}
        onPress={onContinue}
        accessibilityLabel={settled ? DISTILLATION_COPY.cta : 'Distilling your intention'}
        testID="distillation-continue"
      >
        {settled ? DISTILLATION_COPY.cta : DISTILLATION_COPY.ctaPending}
      </V2Button>

      {settled ? (
        <Animated.View entering={enter} style={styles.distillSecondary}>
          <Pressable onPress={() => setSheetOpen(true)} accessibilityRole="button" accessibilityLabel={DISTILLATION_COPY.howThisWorks}>
            <Text style={styles.distillLink}>{DISTILLATION_COPY.howThisWorks}</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      <DistillationSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} intention={intention} letters={letters} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { alignSelf: 'flex-start', marginBottom: spacing[2] },
  flow: { gap: spacing[4], paddingBottom: spacing[6] },
  stack: { gap: spacing[3] },
  eyebrow: { ...typography.labelSM, color: colors.text.secondary },
  title: { ...typography.displayMedium, color: colors.text.primary },
  body: { ...typography.bodyLG, color: colors.text.secondary },
  writingSurface: { minHeight: 168, padding: spacing[4] },
  input: { ...typography.headingMD, color: colors.text.primary, minHeight: 128, textAlignVertical: 'top' },
  // Letter Distillation. Two reserved slots — a two-line headline and a stage tall enough
  // for the wrapped phrase — so neither the headline swap nor the compaction shifts layout.
  titleSlot: { minHeight: typography.displayMedium.lineHeight * 2 },
  distillStage: { minHeight: 136, justifyContent: 'center' },
  phrase: { flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', justifyContent: 'center' },
  // A word stays one unbreakable unit, so wrapping happens between words and never inside one.
  phraseWord: { flexDirection: 'row', marginRight: spacing[2] },
  phraseChar: { ...typography.headingXL, color: colors.text.tertiary },
  phraseCharKept: { color: colors.text.primary },
  settledRow: { ...typography.headingXL, color: colors.text.primary, textAlign: 'center', letterSpacing: 2 },
  rule: { alignSelf: 'center', width: 64, height: 1, backgroundColor: colors.border.strong },
  distillStatus: { ...typography.labelSM, color: colors.text.secondary, textAlign: 'center' },
  settledCaption: { gap: spacing[2], alignItems: 'center' },
  settledLabel: { ...typography.labelSM, color: colors.text.secondary },
  settledCopy: { ...typography.bodyMD, color: colors.text.secondary, textAlign: 'center' },
  distillSecondary: { alignItems: 'center' },
  distillLink: { ...typography.labelMD, color: colors.text.secondary, textDecorationLine: 'underline' },
  mechanismList: { gap: spacing[2], marginTop: spacing[3] },
  mechanismRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[3] },
  mechanismIndex: { ...typography.labelSM, color: colors.text.tertiary, width: 14 },
  mechanismStep: { ...typography.bodyMD, color: colors.text.primary, flex: 1 },
  worked: { gap: spacing[1], marginTop: spacing[4], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.border.subtle },
  workedLabel: { ...typography.labelSM, color: colors.text.tertiary, marginTop: spacing[2] },
  workedIntention: { ...typography.bodyMD, color: colors.text.primary, fontStyle: 'italic' },
  workedLetters: { ...typography.headingSM, color: colors.text.primary, letterSpacing: 2 },
  letters: { ...typography.headingXL, color: colors.text.primary, textAlign: 'center', letterSpacing: 2 },
  previewCenter: { alignItems: 'center', paddingVertical: spacing[3] },
  structureLock: { ...typography.bodySM, color: colors.text.secondary, textAlign: 'center' },
  choice: { minHeight: 96, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border.subtle, backgroundColor: colors.surface, padding: spacing[3], flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  choiceText: { flex: 1, gap: spacing[1] },
  choiceTitle: { ...typography.headingSM, color: colors.text.primary },
  choiceDescription: { ...typography.bodySM, color: colors.text.secondary },
  artWrap: { alignItems: 'center', justifyContent: 'center' },
  artEmpty: { height: 104, width: 104, padding: spacing[2], alignItems: 'center', justifyContent: 'center', backgroundColor: colors.grouped, borderRadius: radii.md },
  artEmptyThumb: { height: 64, width: 64 },
  artEmptyText: { ...typography.caption, color: colors.text.disabled, textAlign: 'center' },
  canvasSurface: { overflow: 'hidden' },
  canvas: { aspectRatio: 1, backgroundColor: colors.surface },
  row: { flexDirection: 'row', gap: spacing[3] },
  rowButton: { flex: 1 },
  expressionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  expressionOption: { width: '48%', minHeight: 132, alignItems: 'center', gap: spacing[1], paddingVertical: spacing[3], paddingHorizontal: spacing[2], borderWidth: 1, borderColor: colors.border.subtle, borderRadius: radii.lg, backgroundColor: colors.surface },
  candidate: { borderWidth: 1, borderColor: colors.border.subtle, backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing[4], alignItems: 'center', gap: spacing[2] },
  heroBlock: { gap: spacing[2] },
  heroHeadline: { ...typography.headingXL, fontSize: 32, lineHeight: 38, letterSpacing: -1.1, color: colors.text.primary },
  heroHeadlineFocused: { fontSize: 24, lineHeight: 30, letterSpacing: -0.8 },
  heroSubhead: { ...typography.bodyMD, color: colors.text.secondary, marginTop: 2 },
  inputBlock: { gap: spacing[3] },
  fieldLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { ...typography.labelSM, color: colors.text.secondary },
  charCounter: { ...typography.caption, color: colors.text.secondary, fontVariant: ['tabular-nums'] },
  charCounterNear: { color: colors.text.primary },
  // A refined writing surface: warm fill, subtle hairline neutral border, no heavy shadow, no glass, no gold.
  intentionSurface: {
    height: 236,
    minHeight: 220,
    maxHeight: 250,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border.subtle,
    backgroundColor: colors.surface,
    padding: spacing[4],
  },
  intentionSurfaceFocused: {
    borderColor: colors.border.default,
  },
  intentionInput: {
    fontFamily: typography.body,
    fontSize: 18,
    lineHeight: 26,
    color: colors.text.primary,
    flex: 1,
    minHeight: 180,
    textAlignVertical: 'top',
    padding: 0,
  },
  hintBlock: { marginTop: spacing[1], gap: 4 },
  hintRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline' },
  hintTag: { ...typography.bodySM, color: colors.text.secondary },
  hintQuoteBad: { ...typography.bodySM, color: colors.text.secondary, fontStyle: 'italic' },
  hintTagTry: { ...typography.labelSM, color: colors.text.secondary },
  hintQuoteGood: { ...typography.bodySM, color: colors.text.primary, fontFamily: typography.bodyBold },
  hintGuidance: { ...typography.bodySM, color: colors.text.secondary, fontStyle: 'italic', marginTop: spacing[2] },
  // Content fills the viewport with balanced breathing room and comfortable safe-area margin.
  intentionContent: { flexGrow: 1, paddingBottom: spacing[7] },
  intentionFlow: { flex: 1, gap: spacing[5], paddingBottom: 0 },
  intentionSpacer: { flex: 1, minHeight: spacing[5], maxHeight: 60 },
  intentionBottom: { gap: spacing[4], paddingBottom: spacing[4] },
  spfBlock: { alignSelf: 'flex-start', gap: 4, paddingVertical: spacing[1] },
  spfHeadingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  spfList: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  spfItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  spfCheck: { marginLeft: 1 },
  spfDot: { ...typography.labelSM, color: colors.text.disabled },
  spfInfoIcon: { marginLeft: 2, alignItems: 'center', justifyContent: 'center' },
  spfHint: { ...typography.caption, color: colors.text.secondary },
  principleLabel: { ...typography.labelSM, color: colors.text.primary },
  principleLabelQuiet: { color: colors.text.secondary },
  ctaButton: { height: 56, borderRadius: 16 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(23, 23, 20, 0.38)', justifyContent: 'flex-end' },
  sheetContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  sheetInner: { gap: spacing[4], position: 'relative' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border.default, alignSelf: 'center', marginBottom: spacing[2] },
  sheetCloseBtn: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { ...typography.headingMD, color: colors.text.primary },
  sheetItem: { gap: 4 },
  sheetItemLabel: { ...typography.labelSM, color: colors.text.secondary },
  sheetItemBody: { ...typography.bodyMD, color: colors.text.primary },
  sheetExample: { marginTop: spacing[1], gap: 4 },
  sheetDismissBtn: { height: 52, borderRadius: 16, marginTop: spacing[2] },
});
