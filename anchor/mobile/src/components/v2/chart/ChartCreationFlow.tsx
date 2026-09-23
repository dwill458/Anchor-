import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowRight, ArrowUpRight, Star, X } from 'lucide-react-native';
import { V2Button } from '@/components/v2/primitives/V2Button';
import { CHART_COPY, chartCategoryPrompt, reviewSupportCopy } from '@/constants/v2/chartCopy';
import {
  chartV2Api,
  classifyChartError,
  freshKey,
  type ChartAdjustmentReason,
  type ChartProposal,
  type ChartRequestError,
} from '@/services/v2/chartV2Api';
import { trackChart } from '@/hooks/v2/chart/useAnchorChart';
import type { CourseDetail } from '@/types/chart';
import { colors, getCategoryTextColor, radii, spacing, typography } from '@/theme/v2';
import { ChartAdjustPanel, type ChartAdjustRequest } from './ChartAdjustPanel';
import {
  ChartCreamPanel,
  ChartEyebrow,
  ChartInkButton,
  ChartInkScreen,
  ChartTextArea,
  ChartTopBar,
  type ChartIdentity,
} from './ChartChrome';
import { ChartGenerationStage } from './ChartGenerationStage';
import { ChartLandscape, type ChartAnchorArt, type ChartMarker } from './ChartLandscape';
import { ChartRouteEditor, type DraftWaypoint } from './ChartRouteEditor';
import { CHART_WINDOWS } from './chartRouteGeometry';

export type ChartCreationVision = {
  imageUrl: string | null;
  description: string | null;
  title: string | null;
};

export type ChartCreationPhase = Phase;

type Phase =
  | 'intro'
  | 'context'
  | 'generating'
  | 'followup'
  | 'review'
  | 'adjusting'
  | 'failed'
  | 'revealed';

type Props = {
  anchorId: string;
  identity: ChartIdentity;
  anchorArt: ChartAnchorArt | null;
  vision: ChartCreationVision | null;
  reducedMotion: boolean;
  onBack: () => void;
  onOpenVision: () => void;
  /** Persisted Chart; the caller publishes it to the shared cache. */
  onCreated: (chart: CourseDetail) => void;
  onExplore: () => void;
  /** Open at a given phase with a given proposal (fixture previews and tests). */
  initialPhase?: Phase;
  initialProposal?: ChartProposal | null;
  testID?: string;
};

export function toDraft(proposal: ChartProposal): DraftWaypoint[] {
  return proposal.waypoints.map((waypoint) => ({
    key: waypoint.clientKey,
    title: waypoint.title,
    rationale: waypoint.rationale,
    kind: waypoint.kind,
    metricLabel: waypoint.metricLabel,
    metricTarget: waypoint.metricTarget,
    metricBaseline: waypoint.metricBaseline,
  }));
}

/** A plain outline when no route could be generated at all. The person names it. */
export function manualOutline(intention: string): DraftWaypoint[] {
  const destination = intention.replace(/[.!]+$/, '').trim().slice(0, 60);
  const blank = (key: string): DraftWaypoint => ({
    key,
    title: '',
    rationale: null,
    kind: 'MILESTONE',
    metricLabel: null,
    metricTarget: null,
    metricBaseline: null,
  });
  return [blank('manual-1'), blank('manual-2'), { ...blank('manual-3'), title: destination }];
}

function markersFor(draft: DraftWaypoint[], currentIndex = -1): ChartMarker[] {
  return draft.map((waypoint, index) => ({
    id: waypoint.key,
    number: index + 1,
    state: index === currentIndex ? 'current' : 'upcoming',
    accessibilityLabel: `Waypoint ${index + 1} of ${draft.length}: ${waypoint.title || 'unnamed'}`,
  }));
}

function errorCopy(error: ChartRequestError | null): string {
  if (!error) return CHART_COPY.errors.generation;
  if (error.kind === 'offline') return CHART_COPY.errors.offline;
  if (error.kind === 'rate_limited') return CHART_COPY.errors.rateLimited;
  if (error.kind === 'disabled') return CHART_COPY.errors.disabled;
  if (error.kind === 'anchor_released') return CHART_COPY.errors.released;
  return CHART_COPY.errors.generation;
}

export function ChartCreationFlow({
  anchorId,
  identity,
  anchorArt,
  vision,
  reducedMotion,
  onBack,
  onOpenVision,
  onCreated,
  onExplore,
  initialPhase = 'intro',
  initialProposal = null,
  testID,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [startingContext, setStartingContext] = useState('');
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [proposal, setProposal] = useState<ChartProposal | null>(initialProposal);
  const [draft, setDraft] = useState<DraftWaypoint[]>(() => (initialProposal ? toDraft(initialProposal) : []));
  const [oneMove, setOneMove] = useState(initialProposal?.suggestedOneMove?.title ?? '');
  const [destination, setDestination] = useState(initialProposal?.destination ?? '');
  const [needsNaming, setNeedsNaming] = useState(false);
  const [revised, setRevised] = useState(false);
  const [error, setError] = useState<ChartRequestError | null>(null);
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generationMarkers, setGenerationMarkers] = useState<ChartMarker[] | null>(null);
  // One key per creation attempt, so a retried submit cannot create two Charts.
  const createKey = useRef(freshKey(`chart-create:${anchorId}`));
  const planStarted = useRef<number>(0);
  const categoryText = getCategoryTextColor(identity.category, colors.ink.base, colors.ink.text.primary);

  const hasVision = Boolean(vision && (vision.imageUrl || vision.description));
  // Short screens give the route list the room; the heading steps down a size.
  const compact = height < 760;

  const acceptProposal = useCallback(
    (next: ChartProposal) => {
      setProposal(next);
      setDraft(toDraft(next));
      setDestination(next.destination);
      setOneMove(next.suggestedOneMove?.title ?? '');
      setNeedsNaming(next.generation.needsNaming);
      trackChart('chart_generation_succeeded', {
        source: next.generation.source,
        fallbackUsed: next.generation.fallbackUsed,
        waypointCount: next.waypoints.length,
        complexity: next.complexity,
        latencyMs: Date.now() - planStarted.current,
      });
      if (next.generation.fallbackUsed) trackChart('chart_fallback_used', { stage: 'generation' });
    },
    []
  );

  const runPlan = useCallback(
    async (answer: { question: string; answer: string } | null) => {
      setPhase('generating');
      setGenerationMarkers(null);
      setError(null);
      planStarted.current = Date.now();
      trackChart('chart_generation_started', { hasVision, followUp: Boolean(answer) });
      try {
        const response = await chartV2Api.plan(anchorId, {
          idempotencyKey: freshKey(`chart-plan:${anchorId}`),
          startingContext: startingContext.trim() || null,
          followUp: answer,
        });
        if (response.status === 'needs_context') {
          setFollowUpQuestion(response.followUpQuestion);
          setFollowUpAnswer('');
          setPhase('followup');
          return;
        }
        acceptProposal(response.proposal);
        setGenerationMarkers(markersFor(toDraft(response.proposal)));
      } catch (caught) {
        const classified = classifyChartError(caught);
        trackChart('chart_generation_failed', { kind: classified.kind });
        setError(classified);
        setPhase('failed');
      }
    },
    [acceptProposal, anchorId, hasVision, startingContext]
  );

  const startManual = () => {
    setProposal(null);
    setDraft(manualOutline(identity.intention));
    setDestination(identity.intention.replace(/[.!]+$/, '').trim().slice(0, 140));
    setOneMove('');
    setNeedsNaming(true);
    setRevised(false);
    trackChart('chart_generation_manual', {});
    setPhase('review');
  };

  const submitAdjust = async ({ reason, detail }: ChartAdjustRequest) => {
    setAdjusting(true);
    setAdjustError(null);
    try {
      const response = await chartV2Api.adjust(anchorId, {
        idempotencyKey: freshKey(`chart-adjust:${anchorId}`),
        reason: reason as ChartAdjustmentReason,
        detail,
        startingContext: startingContext.trim() || null,
        draft: {
          destination: destination || identity.intention.slice(0, 140),
          waypoints: draft
            .filter((waypoint) => waypoint.title.trim())
            .map((waypoint) => ({
              title: waypoint.title,
              kind: waypoint.kind,
              metricTarget: waypoint.metricTarget,
              metricLabel: waypoint.metricLabel,
            })),
        },
      });
      if (response.status === 'proposal') {
        acceptProposal(response.proposal);
        setRevised(true);
        trackChart('chart_route_adjusted', { reason, stage: 'review', hasDetail: Boolean(detail) });
        setPhase('review');
      }
    } catch (caught) {
      const classified = classifyChartError(caught);
      setAdjustError(classified.kind === 'offline' ? CHART_COPY.errors.offline : CHART_COPY.errors.adjust);
    } finally {
      setAdjusting(false);
    }
  };

  const save = async () => {
    const waypoints = draft.filter((waypoint) => waypoint.title.trim());
    if (waypoints.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const chart = await chartV2Api.create(anchorId, {
        idempotencyKey: createKey.current,
        destinationText: (destination || identity.intention).slice(0, 140),
        startingContext: startingContext.trim() || null,
        proposalId: proposal?.proposalId ?? null,
        complexity: proposal?.complexity ?? null,
        waypoints: waypoints.map((waypoint) => ({
          title: waypoint.title.trim(),
          rationale: waypoint.rationale,
          kind: waypoint.kind,
          metricLabel: waypoint.metricLabel,
          metricTarget: waypoint.metricTarget,
          metricBaseline: waypoint.metricBaseline,
        })),
        oneMove: oneMove.trim() ? { title: oneMove.trim(), rationale: proposal?.suggestedOneMove?.rationale ?? null } : null,
      });
      trackChart('chart_route_reviewed', {
        waypointCount: waypoints.length,
        proposedCount: proposal?.waypoints.length ?? 0,
        edited: JSON.stringify(waypoints.map((w) => w.title)) !== JSON.stringify(proposal?.waypoints.map((w) => w.title) ?? []),
      });
      trackChart('chart_created', {
        courseId: chart.id,
        waypointCount: waypoints.length,
        source: proposal ? proposal.generation.source : 'manual',
        hasVision,
        hasOneMove: Boolean(oneMove.trim()),
      });
      onCreated(chart);
      setPhase('revealed');
    } catch (caught) {
      const classified = classifyChartError(caught);
      if (classified.code === 'ACTIVE_COURSE_EXISTS') {
        // Another device (or a lost response) already saved this Anchor's Chart.
        onExplore();
        return;
      }
      setSaveError(classified.kind === 'offline' ? CHART_COPY.errors.saveSupport : CHART_COPY.errors.save);
    } finally {
      setSaving(false);
    }
  };

  const goBack = useCallback(() => {
    switch (phase) {
      case 'context':
        setPhase('intro');
        return true;
      case 'followup':
      case 'failed':
        setPhase('context');
        return true;
      case 'adjusting':
        setPhase('review');
        return true;
      case 'review':
        setPhase('context');
        return true;
      case 'generating':
        return true; // Let the reveal finish; the request is already in flight.
      default:
        onBack();
        return true;
    }
  }, [onBack, phase]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => subscription.remove();
  }, [goBack]);

  const namedCount = draft.filter((waypoint) => waypoint.title.trim()).length;
  const destinationLabel = destination || identity.intention;
  const reviewSupport = needsNaming ? CHART_COPY.review.outline : revised ? CHART_COPY.adjust.reviewSupport : reviewSupportCopy(draft.length);

  const title =
    phase === 'intro'
      ? CHART_COPY.title
      : phase === 'generating'
        ? CHART_COPY.generation.headerTitle
        : phase === 'review'
          ? CHART_COPY.review.headerTitle
          : phase === 'adjusting'
            ? CHART_COPY.adjust.headerTitle
            : phase === 'revealed'
              ? CHART_COPY.revealed.headerTitle
              : CHART_COPY.creation.headerTitle;

  const revealedMarkers = useMemo(
    () => (phase === 'revealed' ? markersFor(draft.filter((waypoint) => waypoint.title.trim()), 0) : []),
    [draft, phase]
  );

  return (
    <ChartInkScreen testID={testID ?? 'chart-creation'}>
      <ChartTopBar title={title} onBack={phase === 'generating' ? undefined : goBack} identity={identity} />

      {phase === 'intro' ? (
        <View style={styles.flex} testID="chart-empty-state">
          <View style={styles.hero}>
            <Text accessibilityRole="header" style={styles.display}>
              {CHART_COPY.empty.headline}
            </Text>
            <Text style={styles.support}>{CHART_COPY.empty.support}</Text>
          </View>
          <View style={styles.flexEnd}>
            <ChartLandscape
              width={width}
              category={identity.category}
              window={CHART_WINDOWS.full}
              showRoute={false}
              scrimTop
              scrimBottom={colors.canvas}
              accessibilityLabel="A landscape with a path toward the horizon"
              style={styles.introLandscape}
            />
            <ChartCreamPanel style={{ paddingBottom: insets.bottom + spacing[4] }}>
              <View style={styles.reinforcingIcon}>
                <Star size={14} color={colors.semantic.warning} fill={colors.semantic.warning} />
              </View>
              <ChartEyebrow tone="cream">{CHART_COPY.labels.reinforcing}</ChartEyebrow>
              <Text style={styles.reinforcing} numberOfLines={3}>
                {identity.intention}
              </Text>
              <V2Button
                size="large"
                onPress={() => {
                  trackChart('chart_creation_started', { hasVision });
                  setPhase('context');
                }}
                iconRight={<ArrowRight size={18} color={colors.text.inverse} />}
                testID="chart-create-cta"
                accessibilityLabel={CHART_COPY.empty.cta}
                style={styles.cta}
              >
                {CHART_COPY.empty.cta}
              </V2Button>
            </ChartCreamPanel>
          </View>
        </View>
      ) : null}

      {phase === 'context' || phase === 'followup' || phase === 'failed' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing[6] }]}
            keyboardShouldPersistTaps="handled"
          >
            {phase === 'context' && hasVision && vision ? (
              <View style={styles.visionCard} testID="chart-vision-context">
                <ChartEyebrow tone="cream">{CHART_COPY.labels.alreadySeen}</ChartEyebrow>
                <Text accessibilityRole="header" style={styles.visionHeadline}>
                  {CHART_COPY.creation.visionHeadline}
                </Text>
                <Text style={styles.visionSupport}>{CHART_COPY.creation.visionSupport}</Text>
                {vision.imageUrl ? (
                  <Image
                    source={{ uri: vision.imageUrl }}
                    style={styles.visionImage}
                    accessibilityIgnoresInvertColors
                    accessibilityLabel="Your Vision"
                  />
                ) : null}
                {vision.description ? (
                  <Text style={styles.visionDescription} numberOfLines={4}>
                    {vision.description}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={CHART_COPY.creation.viewVision}
                  onPress={onOpenVision}
                  style={({ pressed }) => [styles.visionLink, pressed && styles.pressed]}
                >
                  <Text style={styles.visionLinkText}>{CHART_COPY.creation.viewVision}</Text>
                  <ArrowUpRight size={14} color={colors.text.primary} />
                </Pressable>
              </View>
            ) : null}

            {phase === 'context' ? (
              <View style={styles.section} testID="chart-starting-context">
                <Text accessibilityRole="header" style={hasVision ? styles.question : styles.display}>
                  {CHART_COPY.creation.startQuestion}
                </Text>
                <Text style={styles.support}>
                  {hasVision ? CHART_COPY.creation.startSupportWithVision : CHART_COPY.creation.startSupportWithoutVision}
                </Text>
                {!hasVision ? <Text style={[styles.lens, { color: categoryText }]}>{chartCategoryPrompt(identity.category)}</Text> : null}
                <ChartTextArea
                  value={startingContext}
                  onChangeText={setStartingContext}
                  placeholder={CHART_COPY.creation.startPlaceholder}
                  maxLength={500}
                  accessibilityLabel={CHART_COPY.creation.startQuestion}
                  testID="chart-starting-input"
                />
                <ChartInkButton
                  label={CHART_COPY.creation.continue}
                  variant="outline"
                  disabled={startingContext.trim().length < 3}
                  onPress={() => {
                    trackChart('chart_context_submitted', { hasVision, length: startingContext.trim().length });
                    void runPlan(null);
                  }}
                  icon={<ArrowRight size={18} color={colors.ink.text.primary} />}
                  testID="chart-context-continue"
                />
              </View>
            ) : null}

            {phase === 'followup' && followUpQuestion ? (
              <View style={styles.section} testID="chart-follow-up">
                <Text accessibilityRole="header" style={styles.display}>
                  {CHART_COPY.followUp.headline}
                </Text>
                <Text style={styles.support}>{CHART_COPY.followUp.support}</Text>
                <Text style={styles.question}>{followUpQuestion}</Text>
                <ChartTextArea
                  value={followUpAnswer}
                  onChangeText={setFollowUpAnswer}
                  placeholder={CHART_COPY.followUp.placeholder}
                  maxLength={500}
                  accessibilityLabel={followUpQuestion}
                  autoFocus
                  testID="chart-follow-up-input"
                />
                <ChartInkButton
                  label={CHART_COPY.creation.continue}
                  variant="outline"
                  disabled={followUpAnswer.trim().length < 2}
                  onPress={() => void runPlan({ question: followUpQuestion, answer: followUpAnswer.trim() })}
                  icon={<ArrowRight size={18} color={colors.ink.text.primary} />}
                  testID="chart-follow-up-continue"
                />
              </View>
            ) : null}

            {phase === 'failed' ? (
              <View style={styles.section} testID="chart-generation-failed">
                <Text accessibilityRole="header" style={styles.question}>
                  {errorCopy(error)}
                </Text>
                <Text style={styles.support}>{CHART_COPY.errors.generationSupport}</Text>
                <ChartInkButton
                  label={CHART_COPY.errors.retry}
                  onPress={() => void runPlan(null)}
                  testID="chart-generation-retry"
                  disabled={error?.kind === 'disabled' || error?.kind === 'anchor_released'}
                />
                <ChartInkButton
                  label={CHART_COPY.errors.manual}
                  variant="outline"
                  onPress={startManual}
                  testID="chart-generation-manual"
                  disabled={error?.kind === 'disabled' || error?.kind === 'anchor_released'}
                />
              </View>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}

      {phase === 'generating' ? (
        <View style={styles.flex}>
          <View style={styles.hero}>
            <Text accessibilityRole="header" style={styles.display}>
              {CHART_COPY.generation.headline}
            </Text>
            <Text style={styles.support}>{CHART_COPY.generation.support}</Text>
          </View>
          <View style={styles.flex} onLayout={() => undefined}>
            <ChartGenerationStage
              width={width}
              height={Math.max(360, height * 0.62)}
              category={identity.category}
              anchorArt={anchorArt}
              destinationImageUrl={vision?.imageUrl ?? null}
              destinationLabel={hasVision ? null : destinationLabel}
              markers={generationMarkers}
              reducedMotion={reducedMotion}
              onRevealed={() => setPhase('review')}
              testID="chart-generation"
            />
          </View>
        </View>
      ) : null}

      {phase === 'review' || phase === 'adjusting' ? (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <View style={styles.hero}>
            <Text accessibilityRole="header" style={[styles.display, compact && styles.displayCompact]}>
              {phase === 'adjusting'
                ? CHART_COPY.adjust.headline
                : revised
                  ? CHART_COPY.adjust.review
                  : CHART_COPY.review.headline}
            </Text>
            <Text style={[styles.support, compact && styles.supportCompact]}>
              {phase === 'adjusting' ? CHART_COPY.adjust.support : reviewSupport}
            </Text>
          </View>
          <ChartCreamPanel style={styles.reviewPanel}>
            <ScrollView
              contentContainerStyle={{ paddingBottom: spacing[4] }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {phase === 'adjusting' ? (
                <ChartAdjustPanel onSubmit={submitAdjust} loading={adjusting} error={adjustError} testID="chart-adjust-panel" />
              ) : (
                <>
                  {proposal?.guidance && !needsNaming ? <Text style={styles.guidance}>{proposal.guidance}</Text> : null}
                  <ChartRouteEditor
                    waypoints={draft}
                    onChange={setDraft}
                    onEdit={(kind) => trackChart(kind === 'add' ? 'chart_waypoint_added' : 'chart_waypoint_edited', { stage: 'review', kind })}
                    testID="chart-route-editor"
                  />
                  <View style={styles.oneMove}>
                    <ChartEyebrow tone="cream">{CHART_COPY.review.oneMoveHint}</ChartEyebrow>
                    <View style={styles.oneMoveRow}>
                      <TextInput
                        value={oneMove}
                        onChangeText={setOneMove}
                        placeholder={CHART_COPY.active.noMove}
                        placeholderTextColor={colors.text.tertiary}
                        maxLength={120}
                        accessibilityLabel="Your first move"
                        style={styles.oneMoveInput}
                        testID="chart-review-one-move"
                      />
                      {oneMove ? (
                        <Pressable accessibilityRole="button" accessibilityLabel="Clear first move" hitSlop={8} onPress={() => setOneMove('')}>
                          <X size={16} color={colors.text.secondary} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  <Text style={styles.evolve}>{CHART_COPY.review.evolve}</Text>
                  {saveError ? (
                    <Text style={styles.saveError} accessibilityLiveRegion="polite">
                      {saveError}
                    </Text>
                  ) : null}
                </>
              )}
            </ScrollView>
            {phase === 'review' ? (
              <View style={[styles.reviewActions, { paddingBottom: insets.bottom + spacing[3] }]}>
                <V2Button
                  variant="secondary"
                  size="large"
                  onPress={() => setPhase('adjusting')}
                  style={styles.actionHalf}
                  testID="chart-review-adjust"
                  accessibilityLabel={CHART_COPY.review.adjust}
                  disabled={saving}
                >
                  {CHART_COPY.review.adjust}
                </V2Button>
                <V2Button
                  size="large"
                  onPress={() => void save()}
                  loading={saving}
                  disabled={namedCount === 0 || (needsNaming && namedCount < draft.length)}
                  iconRight={<ArrowRight size={18} color={colors.text.inverse} />}
                  style={styles.actionHalf}
                  testID="chart-review-confirm"
                  accessibilityLabel={CHART_COPY.review.confirm}
                >
                  {CHART_COPY.review.confirm}
                </V2Button>
              </View>
            ) : (
              <View style={{ height: insets.bottom }} />
            )}
          </ChartCreamPanel>
        </KeyboardAvoidingView>
      ) : null}

      {phase === 'revealed' ? (
        <View style={styles.flex} testID="chart-revealed">
          <View style={styles.hero}>
            <Text accessibilityRole="header" style={styles.display}>
              {CHART_COPY.revealed.headline}
            </Text>
            <Text style={styles.support}>{CHART_COPY.revealed.support}</Text>
          </View>
          <View style={styles.flexEnd}>
            <ChartLandscape
              width={width}
              category={identity.category}
              window={CHART_WINDOWS.full}
              markers={revealedMarkers}
              anchorArt={anchorArt}
              destinationImageUrl={vision?.imageUrl ?? null}
              destinationLabel={destinationLabel}
              thereCaption={CHART_COPY.labels.there}
              hereCaption="START"
              scrimTop
              scrimBottom={colors.ink.base}
              accessibilityLabel={`Your route has ${revealedMarkers.length} waypoints to ${destinationLabel}`}
              style={styles.revealLandscape}
            />
            <View style={[styles.revealFooter, { paddingBottom: insets.bottom + spacing[4] }]}>
              <ChartInkButton
                label={CHART_COPY.revealed.cta}
                variant="outline"
                onPress={onExplore}
                icon={<ArrowRight size={18} color={colors.ink.text.primary} />}
                testID="chart-explore"
              />
            </View>
          </View>
        </View>
      ) : null}
    </ChartInkScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexEnd: { flex: 1, justifyContent: 'flex-end' },
  hero: { paddingHorizontal: spacing[5], paddingTop: spacing[3], gap: spacing[2], zIndex: 1 },
  display: { ...typography.displayMedium, fontSize: 34, lineHeight: 38, color: colors.ink.text.primary },
  support: { ...typography.bodyLG, color: colors.ink.text.secondary },
  guidance: { ...typography.bodySM, color: colors.text.secondary, marginTop: spacing[2], marginBottom: spacing[1] },
  displayCompact: { fontSize: 28, lineHeight: 32 },
  supportCompact: { ...typography.bodyMD },
  lens: { ...typography.labelLG },
  question: { ...typography.headingLG, color: colors.ink.text.primary },
  introLandscape: { position: 'absolute', left: 0, bottom: 0 },
  revealLandscape: { position: 'absolute', left: 0, bottom: 0 },
  reinforcingIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.grouped,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  reinforcing: { ...typography.headingSM, color: colors.text.primary, marginTop: spacing[1] },
  cta: { marginTop: spacing[4] },
  scroll: { paddingHorizontal: spacing[5], paddingTop: spacing[3], gap: spacing[6] },
  section: { gap: spacing[3] },
  visionCard: { backgroundColor: colors.canvas, borderRadius: radii.xl, padding: spacing[5], gap: spacing[2] },
  visionHeadline: { ...typography.headingXL, color: colors.text.primary },
  visionSupport: { ...typography.bodyMD, color: colors.text.secondary },
  visionImage: { width: '100%', aspectRatio: 1.6, borderRadius: radii.md, marginTop: spacing[2] },
  visionDescription: { ...typography.bodyMD, color: colors.text.primary },
  visionLink: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    paddingHorizontal: spacing[4],
    borderRadius: radii.pill,
    backgroundColor: colors.grouped,
  },
  visionLinkText: { ...typography.labelMD, color: colors.text.primary },
  reviewPanel: { flex: 1, marginTop: spacing[4], paddingTop: spacing[2] },
  reviewActions: { flexDirection: 'row', gap: spacing[3], paddingTop: spacing[3] },
  actionHalf: { flex: 1 },
  oneMove: { marginTop: spacing[5], gap: spacing[2] },
  oneMoveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radii.md,
    paddingHorizontal: spacing[3],
    backgroundColor: colors.surface,
  },
  oneMoveInput: { flex: 1, ...typography.bodyMD, color: colors.text.primary, minHeight: 46 },
  evolve: { ...typography.bodySM, color: colors.text.secondary, marginTop: spacing[4] },
  saveError: { ...typography.bodySM, color: colors.semantic.error, marginTop: spacing[2] },
  revealFooter: { paddingHorizontal: spacing[5], paddingTop: spacing[3] },
  pressed: { opacity: 0.8 },
});
