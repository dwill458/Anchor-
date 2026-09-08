import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';

import { CircularAnchorRenderer, V2Button, V2IconButton, V2Screen, V2Surface } from '@/components/v2';
import { V2ActivityIndicator, V2InlineError } from '@/components/v2/feedback/V2Feedback';
import { AnalyticsService } from '@/services/AnalyticsService';
import { colors, getCategoryColor, getCategorySoftTint, radii, spacing, typography } from '@/theme/v2';
import { useV2ReduceMotion, v2Haptics } from '@/hooks/v2';
import {
  ANCHOR_EXPRESSIONS,
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
  const goBack = () => {
    const target = backStep[step];
    if (target) {
      setIntegrationError(null);
      setStep(target);
    }
  };
  const goToStructure = () => {
    distill();
    if (useCreationStore.getState().draft?.formationError) return;
    track('v2_creation_intention_completed');
    track('v2_creation_distillation_completed');
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
    <V2Screen scroll keyboardAvoiding={step === 'intention'} testID={`v2-creation-${step}`}>
      {backStep[step] ? (
        <View style={styles.top}>
          <V2IconButton icon={<ArrowLeft size={20} color={colors.text.primary} />} accessibilityLabel="Go back" onPress={goBack} />
        </View>
      ) : null}

      {step === 'intention' && (
        <View style={styles.flow}>
          <Text style={styles.eyebrow}>NEW ANCHOR</Text>
          <Text style={styles.title}>What are you ready to hold?</Text>
          <Text style={styles.body}>Keep it short, present, and felt.</Text>
          <V2Surface style={styles.writingSurface}>
            <TextInput
              value={draft.intention}
              onChangeText={setIntention}
              placeholder="I finish what matters."
              placeholderTextColor={colors.text.disabled}
              multiline
              style={styles.input}
              accessibilityLabel="Your intention"
            />
          </V2Surface>
          {draft.formationError ? <V2InlineError message={draft.formationError} /> : null}
          <V2Button size="large" disabled={!draft.intention.trim()} onPress={goToStructure}>Distill intention</V2Button>
        </View>
      )}

      {step === 'distillation' && <Distillation draft={draft} reduceMotion={reduceMotion} onContinue={() => setStep('structure')} />}

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

function Distillation({ draft, reduceMotion, onContinue }: { draft: CreationDraft; reduceMotion: boolean; onContinue: () => void }) {
  const [phase, setPhase] = useState(reduceMotion ? 2 : 0);
  useEffect(() => {
    if (reduceMotion) { setPhase(2); return; }
    const first = setTimeout(() => setPhase(1), 700);
    const second = setTimeout(() => setPhase(2), 1400);
    return () => { clearTimeout(first); clearTimeout(second); };
  }, [reduceMotion]);
  const message = phase === 0 ? 'Vowels fall away' : phase === 1 ? 'Repeated letters settle' : 'The remaining order becomes your source material';
  return (
    <View style={styles.flow}>
      <Text style={styles.eyebrow}>LETTER DISTILLATION</Text>
      <Text style={styles.title}>The form beneath the words</Text>
      <V2Surface style={styles.distillSurface}>
        <Text style={styles.sourceText}>{draft.normalizedIntention}</Text>
        <Text style={styles.distillStage} accessibilityLiveRegion="polite">{message}</Text>
        <View style={styles.rule} />
        <Text
          style={[styles.letters, phase < 2 && styles.lettersResolving]}
          accessibilityLabel={`Distilled letters: ${(draft.distilledLetters ?? []).join(', ')}`}
        >
          {(draft.distilledLetters ?? []).join('  ')}
        </Text>
      </V2Surface>
      <V2Button size="large" onPress={onContinue}>Choose structure</V2Button>
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
  distillSurface: { alignItems: 'center', gap: spacing[4], paddingVertical: spacing[7] },
  sourceText: { ...typography.bodyLG, color: colors.text.primary, textAlign: 'center', fontStyle: 'italic' },
  distillStage: { ...typography.labelSM, color: colors.text.secondary, textAlign: 'center' },
  rule: { width: 48, height: 1, backgroundColor: colors.border.strong },
  letters: { ...typography.headingXL, color: colors.text.primary, textAlign: 'center', letterSpacing: 2 },
  lettersResolving: { opacity: 0.62 },
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
});
