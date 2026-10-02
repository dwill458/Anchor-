// DEFERRED: StructureForge (Focused/Contained/Raw/Drawn) and ManualReinforcement (trace) no longer
// sit between distillation and style — see DECISION D1 below. Their screens stay registered.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, Image, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { DailyReminderPrompt } from '@/components/notifications';
import { isAnchorV2Enabled } from '@/config/v2FeatureFlag';
import { PAPER_ART_SHARE } from '@/components/v2/creation/creationMotion';
import { handOffToHome, prepareHomeArrival } from '@/navigation/v2/creationHandoff';
import { useAudio } from '@/hooks/useAudio';
import { useCreationReduceMotion } from '@/hooks/useReduceMotionEnabled';
import { useSaveAnchor } from '@/hooks/useSaveAnchor';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import {
  AnchorGenerationService,
  type AnchorGenerationResult,
  type GenerationFailureKind,
} from '@/services/AnchorGenerationService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { FrictionAnalytics } from '@/services/FrictionAnalytics';
import { useTempStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useCreationPrefsStore } from '@/stores/creationPrefsStore';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';
import { colors } from '@/theme/colors';
import type { RootStackParamList } from '@/types';
import type { DrawnPoint } from '@/utils/sigil/drawnGeometry';
import { totalStrokeLength } from '@/utils/sigil/drawnGeometry';
import { safeHaptics } from '@/utils/haptics';
import type { RefineStyleOption } from '../constants/refineStyles';
import { ChooseScene } from './components/ChooseScene';
import { DrawControls, DrawPad, MIN_DRAWN_LENGTH } from './components/DrawControls';
import { FLOW_LABELS, FlowHeader } from './components/FlowHeader';
import { FormFailure, SlowRetry } from './components/FormStatus';
import { IntentionGhost } from './components/IntentionGhost';
import { StyleScene } from './components/StyleScene';
import {
  DRAW_RISE_SECONDS,
  FORM_RETRY_AFTER,
  FORM_PROGRESS_P80_SECONDS,
  FORM_SLOW_CAPTION_AFTER,
  INK_BOUNDARY,
  MIN_HAPTIC_GAP_MS,
  type CreationMode,
} from './creationFlowConfig';
import {
  getChipStyleIds,
  getDefaultStyleId,
  getStyleById,
} from './creationStyles';
import { FlowCanvas, type FlowFrameSource } from './FlowCanvas';
import { useFlowFonts } from './flowFonts';
import { useFlowLayout } from './flowLayout';
import { normalizeGeneratedForms, type GeneratedForm } from './generatedForms';
import { clamp, smooth } from './motion';
import { FpsProbe } from './components/FpsProbe';
import { estimatedFormProgress } from './formProgress';
import { useIntentionHandoffStore } from './intentionHandoff';
import { trace } from '@/utils/dev/creationTrace';
import { buildSceneContext } from './sceneContext';
import { MEDALLION } from './sealMath';
import {
  INK_HIDDEN,
  autoBoundary,
  drawBoundary,
  sweepBoundary,
} from './scenes/InkBoundary';
import { mapLetterEventTimes } from './useCreationTimeline';
import { useChooseController } from './useChooseController';
import { useStyleStep } from './useStyleStep';

type FlowNavigation = StackNavigationProp<RootStackParamList, 'AnchorCreationFlow'>;
type FlowRoute = RouteProp<RootStackParamList, 'AnchorCreationFlow'>;

type Phase = 'auto' | 'draw' | 'style' | 'form' | 'sweep' | 'choose';

/** Design-space styling for the overlay container. */
const DESIGN = { width: 390, height: 844 } as const;

type BeatId = 'intention_handoff' | 'distill' | 'map' | 'forget' | 'style' | 'form' | 'choose' | 'seal';

/**
 * The one-screen creation flow: intention -> distill -> map -> forget -> style -> form -> choose
 * -> seal, as a single continuous transformation on a cream page with a rising ink band.
 *
 * Structure: a Skia canvas paints beats 2-6 (and the draw pad's strokes); React views paint the
 * header, the style chips, the images and the seal. A small phase machine, advanced by the
 * canvas's own animation frame, decides which is in charge.
 *
 * DECISION D1: structure is fixed to 'balanced' ("Focused"); there is no trace step during
 * creation, and `reinforcementMetadata` stays undefined. Post-practice tracing is untouched.
 * DECISION D2: after the seal animation the post-save routing is exactly AnchorReveal's.
 * DECISION D4: nothing is generated until a style is committed (see creationFlowConfig).
 */
export default function AnchorCreationFlowScreen() {
  const navigation = useNavigation<FlowNavigation>();
  const route = useRoute<FlowRoute>();
  const params = route.params;
  const insets = useSafeAreaInsets();
  const layout = useFlowLayout();
  const fonts = useFlowFonts();
  const reduceMotion = useCreationReduceMotion();
  const { playSound } = useAudio();

  const anchorCount = useAuthStore((s) => s.anchorCount);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const { hasActiveEntitlement, entitlementReady } = useTrialStatus();
  const lastStyleId = useCreationPrefsStore((s) => s.lastStyleId);
  const rotationCounter = useCreationPrefsStore((s) => s.rotationCounter);
  const setTempEnhancedImage = useTempStore((s) => s.setTempEnhancedImage);

  const mode: CreationMode = anchorCount > 0 ? 'repeat' : 'first';
  const isDrawn = params.source === 'drawn';

  // ---- scene context ------------------------------------------------------------------------

  const [drawnStrokes, setDrawnStrokes] = useState<DrawnPoint[][] | undefined>(undefined);

  // `measureInWindow` origins differ between screens on Android edge-to-edge (the window starts
  // below the status bar), so the field's frame is made relative to THIS screen's own root.
  const rootRef = useRef<View>(null);
  const [rootOrigin, setRootOrigin] = useState<{ x: number; y: number } | null>(null);
  const rootOriginRef = useRef(rootOrigin);
  rootOriginRef.current = rootOrigin;
  const wantsGlide = Boolean(params.fieldFrame) && params.entry === 'glide';
  const measureRoot = useCallback(() => {
    const root = rootRef.current;
    if (!root || typeof root.measureInWindow !== 'function') {
      setRootOrigin({ x: 0, y: 0 });
      return;
    }
    root.measureInWindow((x, y) => setRootOrigin({ x: x || 0, y: y || 0 }));
  }, []);

  /** The Intention field's glyph origin, converted into design px relative to this root. */
  const field = useMemo(() => {
    const frame = params.fieldFrame;
    if (!frame || !wantsGlide || !rootOrigin) return undefined;
    const lineHeight = frame.lineHeight / layout.scale;
    return {
      x: (frame.x - rootOrigin.x - layout.offsetX) / layout.scale,
      // Baseline of the first line, from the field's top.
      y: (frame.y - rootOrigin.y - layout.offsetY) / layout.scale + lineHeight * 0.78,
      width: frame.width / layout.scale,
      lineHeight,
    };
  }, [layout.offsetX, layout.offsetY, layout.scale, params.fieldFrame, rootOrigin, wantsGlide]);

  const built = useMemo(() => {
    // Wait for the root's origin when gliding, so the very first frame is already aligned.
    if (!fonts || (wantsGlide && !rootOrigin)) return null;
    return buildSceneContext({
      intentionText: params.intentionText,
      category: params.category,
      source: params.source,
      entry: field ? 'glide' : 'fade',
      mode,
      reduceMotion,
      measure: fonts.measure,
      field,
      drawnStrokes,
    });
  }, [drawnStrokes, field, fonts, mode, params.category, params.intentionText, params.source, reduceMotion, rootOrigin, wantsGlide]);

  const builtRef = useRef(built);
  builtRef.current = built;

  // ---- phase machine ------------------------------------------------------------------------

  const [phase, setPhaseState] = useState<Phase>('auto');
  const phaseRef = useRef<Phase>('auto');
  const setPhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const tRef = useRef(0);
  const lastNowRef = useRef(0);
  const styleURef = useRef(0);
  const drawRiseRef = useRef(0);
  const formTfRef = useRef(0);
  const sweepURef = useRef(0);
  const displayProgressRef = useRef(0);
  const drawDoneRef = useRef(false);
  const padRef = useRef<{ strokes: DrawnPoint[][]; current: DrawnPoint[] | null }>({ strokes: [], current: null });
  const [padVersion, setPadVersion] = useState(0);
  const firedEventsRef = useRef<Set<string>>(new Set());
  const lastHapticRef = useRef(0);
  const ghostVisibleRef = useRef(true);
  const [ghostVisible, setGhostVisible] = useState(true);
  const mountedRef = useRef(true);

  // The canvas owns the typed words from its first drawn frame: the Intention field underneath
  // stops drawing them on that same frame, so they are never on screen twice.
  const claimIntentionGlyphs = useCallback(() => {
    if (field) useIntentionHandoffStore.getState().claim();
  }, [field]);
  useEffect(() => () => useIntentionHandoffStore.getState().release(), []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Header shared values — updated every frame without re-rendering.
  const headerFade = useSharedValue(1);
  const headerFadeStyle = useAnimatedStyle(() => ({ opacity: headerFade.value }));
  const headerBeat = useSharedValue(1);
  const headerProgress = useSharedValue(0);
  const headerLabelAlpha = useSharedValue(0);
  const [headerLabel, setHeaderLabel] = useState<string>(isDrawn ? FLOW_LABELS.draw : FLOW_LABELS.distill);
  const headerLabelRef = useRef(headerLabel);

  const showLabel = useCallback((label: string) => {
    if (headerLabelRef.current === label) return;
    headerLabelRef.current = label;
    setHeaderLabel(label);
  }, []);

  // ---- analytics per beat -------------------------------------------------------------------

  const currentBeatRef = useRef<BeatId | null>(null);
  const enterBeat = useCallback((beat: BeatId) => {
    if (currentBeatRef.current === beat) return;
    if (currentBeatRef.current) {
      FrictionAnalytics.stepCompleted('anchor_creation', currentBeatRef.current, { source: 'creation_flow' });
    }
    currentBeatRef.current = beat;
    FrictionAnalytics.stepViewed('anchor_creation', beat, { source: 'creation_flow', mode, creation_source: params.source });
  }, [mode, params.source]);

  // ---- haptics / sound ----------------------------------------------------------------------

  const tick = useCallback((style: Haptics.ImpactFeedbackStyle) => {
    const now = Date.now();
    if (now - lastHapticRef.current < MIN_HAPTIC_GAP_MS) return;
    lastHapticRef.current = now;
    void safeHaptics.impact(style);
  }, []);

  const mapEventTimes = useMemo(
    () => (built ? mapLetterEventTimes(built.context.timeline, built.context.map?.points.length ?? 0) : []),
    [built]
  );

  // ---- generation ---------------------------------------------------------------------------

  type Generation =
    | { status: 'idle' }
    | { status: 'running' }
    | { status: 'failed'; kind: GenerationFailureKind }
    | { status: 'done' };
  const [generation, setGeneration] = useState<Generation>({ status: 'idle' });
  const generationRef = useRef<{ result: AnchorGenerationResult | null; attempt: number; abort: AbortController | null; style: RefineStyleOption | null }>({
    result: null,
    attempt: 1,
    abort: null,
    style: null,
  });
  /** 100 once the request resolved, 0 otherwise; the hairline between is time-based. */
  const targetProgressRef = useRef(0);
  const [forms, setForms] = useState<GeneratedForm[]>([]);
  const [styleName, setStyleName] = useState('');

  useEffect(
    () => () => {
      generationRef.current.abort?.abort();
      setTempEnhancedImage(null);
    },
    [setTempEnhancedImage]
  );

  const runGeneration = useCallback(async () => {
    const flow = builtRef.current;
    const style = generationRef.current.style;
    if (!flow || !style) return;

    generationRef.current.abort?.abort();
    const controller = new AbortController();
    generationRef.current.abort = controller;
    generationRef.current.result = null;
    targetProgressRef.current = 0;
    displayProgressRef.current = 0;
    formTfRef.current = 0;
    setGeneration({ status: 'running' });

    try {
      const result = await AnchorGenerationService.generate({
        sigilSvg: flow.baseSigilSvg,
        styleChoice: style.generationStyle,
        intentionText: params.intentionText,
        category: params.category,
        generationAttempt: generationRef.current.attempt,
        userId: user?.id,
        hasReinforcedSvg: false,
        signal: controller.signal,
      });
      if (!mountedRef.current || controller.signal.aborted) return;
      generationRef.current.result = result;
      targetProgressRef.current = 100;
      setForms(normalizeGeneratedForms(result.variations));
      setStyleName(style.displayName);
      useFirstAnchorFlowStore.getState().updateDraft({ generationStatus: 'complete' });
      setGeneration({ status: 'done' });
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted) return;
      targetProgressRef.current = 0;
      displayProgressRef.current = 0;
      useFirstAnchorFlowStore.getState().updateDraft({ generationStatus: 'error' });
      setGeneration({
        status: 'failed',
        kind: (error as { kind?: GenerationFailureKind }).kind ?? 'generic',
      });
    }
  }, [params.category, params.intentionText, user?.id]);

  /** Returns false when a gate (sign-in, entitlement) stopped the request. */
  const commitStyle = useCallback(
    (styleId: string): boolean => {
      const style = getStyleById(styleId);
      const flow = builtRef.current;
      if (!style || !flow) return false;

      // Guards carried over from the generating screen.
      const isFirstAnchor = anchorCount === 0;
      if (!isFirstAnchor && !isAuthenticated) {
        Alert.alert('Account Required', 'Sign in before generating AI artwork.', [
          { text: 'Sign In', onPress: () => navigation.replace('Login', {}) },
          { text: 'Go Back', style: 'cancel', onPress: () => navigation.goBack() },
        ]);
        return false;
      }
      if (!isFirstAnchor && !entitlementReady) return false;
      if (!isFirstAnchor && !hasActiveEntitlement) {
        navigation.navigate('Paywall', { source: 'gated_feature', preferredPlanId: 'annual' });
        return false;
      }

      useFirstAnchorFlowStore.getState().updateDraft({
        selectedStyleId: style.id,
        generationStatus: 'generating',
        structure: isDrawn ? 'drawn' : 'balanced',
        drawingSvg: isDrawn ? flow.baseSigilSvg : undefined,
      });
      useCreationPrefsStore.getState().setLastStyleId(style.id);
      FrictionAnalytics.stepCompleted('anchor_creation', 'style_selection', {
        style_id: style.id,
        category: params.category,
        creation_source: params.source,
      });
      tick(Haptics.ImpactFeedbackStyle.Light);

      generationRef.current.style = style;
      generationRef.current.attempt = 1;
      formTfRef.current = 0;
      setPhase('form');
      void runGeneration();
      return true;
    },
    [
      anchorCount,
      entitlementReady,
      hasActiveEntitlement,
      isAuthenticated,
      isDrawn,
      navigation,
      params.category,
      params.source,
      runGeneration,
      setPhase,
      tick,
    ]
  );

  const retryGeneration = useCallback(() => {
    generationRef.current.attempt += 1;
    FrictionAnalytics.flowRetry('anchor_creation', 'ai_generating', {
      style_id: generationRef.current.style?.generationStyle,
      category: params.category,
    });
    void runGeneration();
  }, [params.category, runGeneration]);

  const backToStyle = useCallback(() => {
    generationRef.current.abort?.abort();
    setGeneration({ status: 'idle' });
    styleURef.current = 0;
    setPhase('style');
  }, [setPhase]);

  // ---- the style step -----------------------------------------------------------------------

  const defaultStyleId = useMemo(
    () => getDefaultStyleId(params.category, params.intentionText, lastStyleId),
    [lastStyleId, params.category, params.intentionText]
  );
  // The chips are fixed for this visit: computed once from the counter as it stood on entry.
  const initialChips = useRef(getChipStyleIds(defaultStyleId, rotationCounter)).current;

  const styleStep = useStyleStep({
    defaultStyleId,
    initialChipIds: initialChips,
    countdownSeconds: built?.context.timeline.styleCountdown ?? 4,
    active: phase === 'style',
    onCommit: commitStyle,
    onSelect: () => tick(Haptics.ImpactFeedbackStyle.Light),
  });

  // ---- draw path ----------------------------------------------------------------------------

  const drawnLength = useMemo(() => {
    const all = padRef.current.current ? [...padRef.current.strokes, padRef.current.current] : padRef.current.strokes;
    return totalStrokeLength(all);
    // padVersion bumps whenever the strokes change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [padVersion]);

  const finishDrawing = useCallback(() => {
    const strokes = padRef.current.strokes.filter((s) => s.length >= 2);
    if (strokes.length === 0 || totalStrokeLength(strokes) < MIN_DRAWN_LENGTH) return;
    drawDoneRef.current = true;
    tick(Haptics.ImpactFeedbackStyle.Light);
    setDrawnStrokes(strokes);
    setPhase('auto');
  }, [setPhase, tick]);

  // ---- seal & save --------------------------------------------------------------------------

  // The V2 navigator has none of the legacy post-save routes (SaveProgress, PrimeYourAnchor,
  // WallpaperPrompt, ChargeSetup): there, a saved anchor flies into Home like any other.
  const isV2 = isAnchorV2Enabled(
    process.env.EXPO_PUBLIC_ANCHOR_V2_ENABLED,
    __DEV__,
    process.env.EXPO_PUBLIC_APP_ENV
  );
  /** The chosen Form's image, captured at the instant the seal lands. */
  const sealedImageRef = useRef<string | undefined>(undefined);
  /**
   * Where the sealed medallion sits in window coordinates, so Home can fly the mark out of it.
   * Home's rects describe the mark inside its paper disc, so the medallion (the disc) is scaled by
   * the same artwork share. Null (no flight, a soft fade instead) until the root has been measured.
   */
  const medallionMarkRect = useCallback(() => {
    const origin = rootOriginRef.current;
    if (!origin) return null;
    const disc = MEDALLION.size * layout.scale;
    const side = disc * PAPER_ART_SHARE;
    const centerX = origin.x + layout.offsetX + MEDALLION.centerX * layout.scale;
    const centerY = origin.y + layout.offsetY + MEDALLION.centerY * layout.scale;
    return { x: centerX - side / 2, y: centerY - side / 2, width: side, height: side };
  }, [layout.offsetX, layout.offsetY, layout.scale]);

  const { saveAnchor, reminderCardVisible, handleReminderDismiss } = useSaveAnchor(
    {
      intentionText: params.intentionText,
      category: params.category,
      distilledLetters: built?.distilledLetters ?? params.distilledLetters,
      baseSigilSvg: built?.baseSigilSvg ?? '',
      structureVariant: 'balanced',
    },
    isV2
      ? {
          onSaved: ({ anchorId, input }) => {
            trace('saveAnchor resolve (onSaved)', { imageUrlLength: input.enhancedImageUrl?.length ?? 0 });
            const handoff = {
              anchorId,
              svg: input.baseSigilSvg,
              category: input.category,
              // The chosen Form is a finished image; the line itself is the "original" mark.
              expression: 'original' as const,
              // The Form captured at the seal is the source of truth; the saved input is a backstop.
              imageUrl: sealedImageRef.current || input.enhancedImageUrl || undefined,
            };
            // The header and its progress line dissolve with the hand-off, not after it.
            headerFade.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.quad) });
            prepareHomeArrival(handoff);
            void handOffToHome(
              navigation as unknown as Parameters<typeof handOffToHome>[0],
              { ...handoff, markRect: medallionMarkRect() },
              { reduceMotion }
            );
          },
        }
      : {}
  );

  const savePromiseRef = useRef<ReturnType<typeof saveAnchor> | null>(null);
  const [saveWaiting, setSaveWaiting] = useState(false);

  const onHoldComplete = useCallback(
    (pageIndex: number) => {
      const flow = builtRef.current;
      const form = forms[pageIndex];
      const generated = generationRef.current.result;
      const style = generationRef.current.style;
      if (!flow || !form || !generated || !style) return;

      void playSound('forge-seal');
      sealedImageRef.current = form.uri || undefined;
      if (__DEV__ && form.uri && !form.uri.startsWith('data:')) {
        Image.getSize(
          form.uri,
          (width, height) => trace('chosen image size', { width, height }),
          () => undefined
        );
      }

      // Heavy inline images travel through the temp store, never through navigation params.
      if (form.isHeavyInline) setTempEnhancedImage(form.uri);

      // Same metadata the variation picker records for the chosen Form.
      const enhancementMetadata = {
        styleApplied: style.generationStyle,
        modelUsed: generated.modelUsed || 'unknown-model',
        provider: generated.provider || 'unknown',
        controlMethod: generated.controlMethod || 'lineart',
        generationTimeMs: generated.generationTimeMs || 0,
        promptUsed: generated.prompt || '',
        negativePrompt: generated.negativePrompt || '',
        appliedAt: new Date(),
        variationId: form.variationId || undefined,
        reuseRequestId: generated.reuseRequestId || undefined,
        reusedFromPool: form.reusedFromPool || false,
      };

      useFirstAnchorFlowStore.getState().updateDraft({
        selectedExpressionId: form.variationId || `form-${pageIndex + 1}`,
      });
      FrictionAnalytics.stepCompleted('anchor_creation', 'variation_picker', {
        selected_index: pageIndex,
        variation_count: forms.length,
        heavy_inline: form.isHeavyInline,
      });
      ErrorTrackingService.addBreadcrumb('Variation selected', 'ai.variation_picker', {
        selected_index: pageIndex,
        heavy_inline: form.isHeavyInline,
      });
      enterBeat('seal');

      // Saving runs while the seal plays; the screen waits for both before leaving.
      savePromiseRef.current = saveAnchor({
        enhancedImageUrl: form.uri,
        enhancementMetadata,
        distilledLetters: flow.distilledLetters,
        baseSigilSvg: flow.baseSigilSvg,
      });
    },
    [enterBeat, forms, playSound, saveAnchor, setTempEnhancedImage]
  );

  const chooseRef = useRef<ReturnType<typeof useChooseController> | null>(null);

  const onSealAnimationDone = useCallback(() => {
    const pending = savePromiseRef.current;
    if (!pending) return;
    // The medallion holds still; only a slow save earns a hairline.
    const waitTimer = setTimeout(() => {
      if (mountedRef.current) setSaveWaiting(true);
    }, 1500);

    void pending.then((outcome) => {
      clearTimeout(waitTimer);
      if (!mountedRef.current) return;
      setSaveWaiting(false);
      if (outcome.status === 'saved') {
        useCreationPrefsStore.getState().incrementRotation();
        outcome.proceed();
      } else {
        // A gate (paywall, daily cap) took over: let the person choose again.
        savePromiseRef.current = null;
        chooseRef.current?.reset();
      }
    });
  }, []);

  const choose = useChooseController({
    onHoldComplete,
    onSealAnimationDone,
    reduceMotion,
  });
  chooseRef.current = choose;

  // ---- the frame source ---------------------------------------------------------------------

  const chooseOpacity = useSharedValue(0);
  const chooseFade = useAnimatedStyle(() => ({ opacity: chooseOpacity.value }));

  const getFrame = useCallback((): FlowFrameSource => {
    const flow = builtRef.current;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const dt = lastNowRef.current ? clamp((now - lastNowRef.current) / 1000, 0, 0.05) : 0;
    lastNowRef.current = now;

    if (!flow) return { frame: { kind: 'none' }, boundary: INK_HIDDEN, key: 'empty' };
    const ctx = flow.context;
    const tl = ctx.timeline;
    const rm = ctx.reduceMotion;

    switch (phaseRef.current) {
      case 'auto': {
        const prev = tRef.current;
        const next = prev + dt;
        tRef.current = next;

        // Events on the timeline.
        if (prev < 0.03 && next >= 0.03) tick(Haptics.ImpactFeedbackStyle.Light);
        mapEventTimes.forEach((time, i) => {
          if (prev < time && next >= time) {
            void playSound('letter-drop');
            tick(Haptics.ImpactFeedbackStyle.Light);
            firedEventsRef.current.add(`map-${i}`);
          }
        });

        // Header.
        let beat = 1;
        let u = 0;
        if (next < tl.handoff) {
          beat = 1;
          u = next / tl.handoff;
          headerLabelAlpha.value = rm ? 1 : smooth(0.45, 0.9, u);
          showLabel(isDrawn ? FLOW_LABELS.draw : FLOW_LABELS.distill);
          enterBeat('intention_handoff');
        } else if (!isDrawn && next < tl.start.map) {
          beat = 2;
          u = (next - tl.start.distill) / tl.distill;
          headerLabelAlpha.value = 1;
          showLabel(FLOW_LABELS.distill);
          enterBeat('distill');
        } else if (!isDrawn && next < tl.start.forget) {
          beat = 3;
          u = (next - tl.start.map) / tl.map;
          showLabel(FLOW_LABELS.map);
          enterBeat('map');
        } else {
          beat = 4;
          u = clamp((next - tl.start.forget) / tl.forget);
          showLabel(FLOW_LABELS.forget);
          enterBeat('forget');
        }
        headerBeat.value = beat;
        headerProgress.value = clamp(u);

        if (ghostVisibleRef.current && next > 0.7) {
          ghostVisibleRef.current = false;
          setGhostVisible(false);
        }

        // Hand-offs.
        if (isDrawn && !drawDoneRef.current && next >= tl.handoff) {
          tRef.current = tl.handoff;
          drawRiseRef.current = 0;
          setPhase('draw');
          return { frame: { kind: 'auto', t: tl.handoff }, boundary: autoBoundary(ctx, tl.handoff) };
        }
        if (next >= tl.styleAt) {
          tRef.current = tl.styleAt;
          styleURef.current = 0;
          setPhase('style');
        }

        return { frame: { kind: 'auto', t: tRef.current }, boundary: autoBoundary(ctx, tRef.current) };
      }

      case 'draw': {
        drawRiseRef.current = Math.min(1, drawRiseRef.current + dt / DRAW_RISE_SECONDS);
        const riseU = rm ? 1 : drawRiseRef.current;
        headerBeat.value = 2;
        headerProgress.value = riseU;
        headerLabelAlpha.value = 1;
        showLabel(FLOW_LABELS.draw);
        const pad = padRef.current;
        return {
          frame: { kind: 'draw', pad: { strokes: pad.strokes, current: pad.current, riseU } },
          boundary: drawBoundary(riseU, rm),
        };
      }

      case 'style': {
        styleURef.current = Math.min(1, styleURef.current + dt / 0.6);
        headerBeat.value = 5;
        headerProgress.value = styleURef.current;
        headerLabelAlpha.value = 1;
        showLabel(FLOW_LABELS.style);
        enterBeat('style');
        return {
          frame: { kind: 'style', styleU: rm ? 1 : styleURef.current },
          boundary: INK_BOUNDARY.held,
          key: styleURef.current >= 1 ? 'style-rest' : undefined,
        };
      }

      case 'form': {
        formTfRef.current += dt;
        const tf = formTfRef.current;
        const gen = generationRef.current;
        // Time-based, so the hairline always moves; it completes (quickly) on resolve.
        const resolved = targetProgressRef.current >= 100;
        const target = resolved ? 1 : estimatedFormProgress(tf, FORM_PROGRESS_P80_SECONDS);
        const shown = displayProgressRef.current;
        displayProgressRef.current = Math.max(shown, shown + (target - shown) * (1 - Math.exp(-dt * (resolved ? 8 : 4))));
        if (resolved) displayProgressRef.current = Math.max(displayProgressRef.current, 0.995);

        headerBeat.value = 6;
        headerProgress.value = displayProgressRef.current;
        headerLabelAlpha.value = 1;
        showLabel(FLOW_LABELS.form);
        enterBeat('form');

        if (gen.result && tf >= tl.formMin) {
          sweepURef.current = 0;
          chooseOpacity.value = 0;
          setPhase('sweep');
        }

        return {
          frame: {
            kind: 'form',
            form: {
              tf,
              progress: displayProgressRef.current,
              slow: tf > FORM_SLOW_CAPTION_AFTER,
              fade: 1,
            },
          },
          boundary: INK_BOUNDARY.held,
        };
      }

      case 'sweep': {
        sweepURef.current = Math.min(1, sweepURef.current + dt / tl.sweep);
        const u = sweepURef.current;
        headerBeat.value = 7;
        headerProgress.value = u;
        showLabel(FLOW_LABELS.choose);
        enterBeat('choose');
        chooseOpacity.value = rm ? (u >= 1 ? 1 : 0) : smooth(0.5, 1, u);
        if (u >= 1) {
          chooseOpacity.value = 1;
          setPhase('choose');
        }
        return {
          frame: {
            kind: 'form',
            form: { tf: formTfRef.current, progress: 1, slow: false, fade: 1 - smooth(0, 0.35, u) },
          },
          boundary: sweepBoundary(u, rm),
        };
      }

      case 'choose':
      default:
        return { frame: { kind: 'none' }, boundary: INK_HIDDEN, key: 'choose-rest' };
    }
  }, [
    chooseOpacity,
    enterBeat,
    headerBeat,
    headerLabelAlpha,
    headerProgress,
    isDrawn,
    mapEventTimes,
    playSound,
    setPhase,
    showLabel,
    tick,
  ]);

  // ---- header while choosing/sealing --------------------------------------------------------

  useEffect(() => {
    if (phase !== 'choose') return;
    headerBeat.value = choose.holdActive || choose.phase !== 'choosing' ? 8 : 7;
    headerProgress.value = 1;
    showLabel(choose.holdActive || choose.phase !== 'choosing' ? FLOW_LABELS.seal : FLOW_LABELS.choose);
  }, [choose.holdActive, choose.phase, headerBeat, headerProgress, phase, showLabel]);

  // ---- back ---------------------------------------------------------------------------------

  const sealing = choose.phase !== 'choosing';
  const goBack = useCallback(() => {
    if (sealing) return;
    generationRef.current.abort?.abort();
    navigation.goBack();
  }, [navigation, sealing]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (sealing) return true;
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack, sealing]);

  // ---- draw handlers ------------------------------------------------------------------------

  const onStrokeStart = useCallback((point: DrawnPoint) => {
    padRef.current.current = [point];
    setPadVersion((v) => v + 1);
  }, []);
  const onStrokeMove = useCallback((point: DrawnPoint) => {
    padRef.current.current?.push(point);
  }, []);
  const onStrokeEnd = useCallback(() => {
    const stroke = padRef.current.current;
    padRef.current.current = null;
    if (stroke && stroke.length >= 2) padRef.current.strokes = [...padRef.current.strokes, stroke];
    setPadVersion((v) => v + 1);
  }, []);
  const undoStroke = useCallback(() => {
    padRef.current.strokes = padRef.current.strokes.slice(0, -1);
    setPadVersion((v) => v + 1);
  }, []);
  const clearStrokes = useCallback(() => {
    padRef.current.strokes = [];
    padRef.current.current = null;
    setPadVersion((v) => v + 1);
  }, []);

  // ---- render -------------------------------------------------------------------------------

  const heroStrokes = built?.context.hero.strokes ?? [];
  const showStyle = phase === 'style';
  const showDraw = phase === 'draw';
  const showChoose = phase === 'sweep' || phase === 'choose';
  const slowRetryVisible =
    phase === 'form' && generation.status === 'running' && formTfRef.current > FORM_RETRY_AFTER;

  // Keep the header off the status bar on devices where the design's 34 px would collide.
  const headerShift = Math.max(0, (insets.top - (layout.offsetY + 30 * layout.scale)) / layout.scale);

  return (
    <View ref={rootRef} onLayout={measureRoot} style={styles.root} testID="anchor-creation-flow" collapsable={false}>
      <StatusBar style="dark" />

      {built && fonts ? (
        <FlowCanvas
          fonts={fonts}
          context={built.context}
          layout={layout}
          getFrame={getFrame}
          onFirstFrame={claimIntentionGlyphs}
        />
      ) : null}

      {/* The Intention screen's chrome, fading away as the words glide. */}
      {built && ghostVisible && field ? (
        <IntentionGhost
          fieldHeight={params.fieldFrame?.height ?? 80}
          count={params.intentionText.length}
          reduceMotion={reduceMotion}
        />
      ) : null}

      <View
        style={[
          styles.design,
          {
            left: layout.offsetX,
            top: layout.offsetY,
            transform: [{ scale: layout.scale }],
          },
        ]}
        pointerEvents="box-none"
      >
        <Animated.View style={[{ transform: [{ translateY: headerShift }] }, headerFadeStyle]} pointerEvents="box-none">
          <FlowHeader
            beat={headerBeat}
            progress={headerProgress}
            labelAlpha={headerLabelAlpha}
            label={headerLabel}
            onBack={goBack}
            backDisabled={sealing}
          />
        </Animated.View>

        {showStyle && built ? (
          <View style={StyleSheet.absoluteFill} onTouchStart={styleStep.markTouched} pointerEvents="box-none">
            <StyleScene
              step={styleStep}
              strokes={heroStrokes}
              reduceMotion={reduceMotion}
              onOpenAll={styleStep.openSheet}
              onPick={() => undefined}
            />
          </View>
        ) : null}

        {showDraw ? (
          <>
            <DrawPad
              enabled={drawRiseRef.current > 0.6 || reduceMotion}
              onStrokeStart={onStrokeStart}
              onStrokeMove={onStrokeMove}
              onStrokeEnd={onStrokeEnd}
            />
            <DrawControls
              hasStrokes={padRef.current.strokes.length > 0}
              canFinish={drawnLength >= MIN_DRAWN_LENGTH}
              onUndo={undoStroke}
              onClear={clearStrokes}
              onDone={finishDrawing}
            />
          </>
        ) : null}

        {phase === 'form' && generation.status === 'failed' ? (
          <FormFailure kind={generation.kind} onRetry={retryGeneration} onBackToStyle={backToStyle} />
        ) : null}
        {slowRetryVisible ? <SlowRetry onRetry={retryGeneration} /> : null}

        {showChoose && forms.length > 0 ? (
          <Animated.View style={[StyleSheet.absoluteFill, chooseFade]} pointerEvents="box-none">
            <ChooseScene
              controller={choose}
              forms={forms}
              styleName={styleName}
              reduceMotion={reduceMotion}
              showSheen={phase === 'choose'}
              holdHint={choose.holdActive ? 'holding' : 'idle'}
            />
          </Animated.View>
        ) : null}

        {saveWaiting ? <View style={styles.saveHairline} accessibilityLabel="Saving" /> : null}
      </View>

      <FpsProbe />
      <DailyReminderPrompt visible={reminderCardVisible} variant="first_anchor" onDismiss={handleReminderDismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.creation.cream },
  design: {
    position: 'absolute',
    width: DESIGN.width,
    height: DESIGN.height,
    transformOrigin: 'top left',
  },
  saveHairline: {
    position: 'absolute',
    left: DESIGN.width / 2 - 60,
    width: 120,
    top: 410,
    height: 1,
    backgroundColor: colors.creation.ink,
    opacity: 0.5,
  },
});
