import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Svg, { Path, SvgXml } from 'react-native-svg';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { RootStackParamList, AnchorCategory, SigilVariant } from '@/types';
import { colors, typography } from '@/theme';
import { ZenBackground } from '@/components/common';
import { BackChevronIcon, CloseIcon } from '@/components/icons';
import { useAuthStore } from '@/stores/authStore';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAudio } from '@/hooks/useAudio';
import { usePostPrimeTraceStore } from '@/stores/postPrimeTraceStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTeachingStore } from '@/stores/teachingStore';
import { AnalyticsService } from '@/services/AnalyticsService';
import {
  TRACE_HINT_FIRST_TIME,
  TRACE_HINT_FIRST_TIME_EXHAUSTION_ID,
  TRACE_HINT_HESITATION,
  TRACE_HINT_RETURNING_BASE,
  TRACE_HINT_UNDO_SPAM,
  type TraceHintTrigger,
  type TraceHintVariant,
} from '@/constants/traceHints';
import { stableIndex } from '@/utils/hash';
import { isCompactPhoneViewport } from '@/utils/layout';
import { useFirstAnchorFlowStore } from '@/stores/firstAnchorFlowStore';
import { useReduceMotionEnabled } from '@/hooks/useReduceMotionEnabled';

type ManualReinforcementRouteProp = RouteProp<RootStackParamList, 'ManualReinforcement'>;
type ManualReinforcementNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ManualReinforcement'
>;

const HESITATION_DELAY_MS = 5000;
const UNDO_SPAM_WINDOW_MS = 15000;
const UNDO_SPAM_THRESHOLD = 2;

const gilt = colors.anchor15.gilt;
const giltBright = colors.anchor15.giltBright;
const ash = colors.anchor15.ash;
const bone = colors.anchor15.bone;
const boneSoft = 'rgba(244, 239, 230, 0.68)';
const boneFaint = 'rgba(244, 239, 230, 0.42)';
const goldLine = colors.anchor15.goldLine;
const hairlineGold = colors.anchor15.hairlineGold;
const hairline = colors.anchor15.hairline;

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  pathData: string;
}

interface TraceHintState {
  hint: TraceHintVariant;
  trigger: TraceHintTrigger;
}

function IconUndo({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M9 7L4 12l5 5" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 12h11a5 5 0 010 10h-1" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconClear({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path d="M5 6h14M9 6V4h6v2m-8 0 1 14h8l1-14" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/**
 * ManualReinforcementScreen
 *
 * Step 4 in the new architecture: Manual reinforcement (guided tracing).
 *
 * User traces over the faint base structure to "reinforce" it with their
 * intentional energy. Implements soft constraints with real-time feedback:
 * - Glow effect when strokes are close to the base structure
 * - Fidelity score tracking (overlap percentage) drives the guide's brighten-
 *   as-you-go feedback
 * - Option to skip (with encouragement)
 *
 * Next: LockStructureScreen (structure confirmation & celebration)
 */
export default function ManualReinforcementScreen() {
  const route = useRoute<ManualReinforcementRouteProp>();
  const navigation = useNavigation<ManualReinforcementNavigationProp>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { playSound } = useAudio();
  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const activePostPrimeFlow = usePostPrimeTraceStore((state) => state.activeFlow);
  const finishPostPrimeTraceFlow = usePostPrimeTraceStore((state) => state.finishFlow);
  const recordTraceSkipped = useSettingsStore((state) => state.recordTraceSkipped);
  const resetTraceSkipStreak = useSettingsStore((state) => state.resetTraceSkipStreak);
  const setTraceDefaultEnabled = useSettingsStore((state) => state.setTraceDefaultEnabled);
  const reduceMotion = useReduceMotionEnabled();

  const isPostPrimeTrace = route.params.source === 'post_prime_trace';
  const postPrimeAnchor = getAnchorById(
    isPostPrimeTrace ? route.params.anchorId : ''
  );
  const postPrimeSigilSvg = postPrimeAnchor
    ? postPrimeAnchor.reinforcedSigilSvg ?? postPrimeAnchor.baseSigilSvg
    : '';
  const creationParams = !isPostPrimeTrace ? route.params : null;
  const intentionText = isPostPrimeTrace
    ? postPrimeAnchor?.intentionText ?? ''
    : creationParams?.intentionText ?? '';
  const category: AnchorCategory = isPostPrimeTrace
    ? postPrimeAnchor?.category ?? 'custom'
    : creationParams?.category ?? 'custom';
  const distilledLetters = isPostPrimeTrace
    ? postPrimeAnchor?.distilledLetters ?? []
    : creationParams?.distilledLetters ?? [];
  const baseSigilSvg = isPostPrimeTrace
    ? postPrimeSigilSvg
    : creationParams?.baseSigilSvg ?? '';
  const structureVariant: SigilVariant = isPostPrimeTrace
    ? postPrimeAnchor?.structureVariant ?? 'balanced'
    : creationParams?.structureVariant ?? 'balanced';
  const activePostPrimeFlowId =
    isPostPrimeTrace && activePostPrimeFlow?.anchorId === route.params.anchorId
      ? activePostPrimeFlow.flowId
      : null;
  const isCompactLayout = isCompactPhoneViewport(width, height);
  const horizontalPadding = isCompactLayout ? 22 : 28;
  const canvasSize = Math.min(
    width - horizontalPadding * 2,
    height * (isCompactLayout ? 0.38 : 0.44)
  );
  const liveStrokeWidth = Math.max(4, (canvasSize / 300) * 5.5);

  // Drawing state
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [fidelityScore, setFidelityScore] = useState(0);
  const [strokeCount, setStrokeCount] = useState(0);
  const [hasStartedDrawing, setHasStartedDrawing] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showTraceDefaultPrompt, setShowTraceDefaultPrompt] = useState(false);
  const [showAboutTracing, setShowAboutTracing] = useState(false);
  const [showStructureSet, setShowStructureSet] = useState(false);
  const pendingSkipTimeSpentMsRef = useRef<number | null>(null);
  const startTime = useRef(Date.now());

  const userSeed = useAuthStore((state) => state.user?.id ?? 'anon');
  const hasTracedBefore = useTeachingStore((state) => state.userFlags.hasTracedBefore);
  const setUserFlag = useTeachingStore((state) => state.setUserFlag);
  const recordTraceHintSeen = useTeachingStore((state) => state.recordTraceHintSeen);
  const exhaustTraceHint = useTeachingStore((state) => state.exhaustTraceHint);
  const isTraceHintExhausted = useTeachingStore((state) => state.isTraceHintExhausted);

  const hasStartedDrawingRef = useRef(false);
  const overrideAppliedRef = useRef(false);
  const undoPressTimesRef = useRef<number[]>([]);
  const trackedShownRef = useRef<Record<string, true>>({});
  const trackedTriggersRef = useRef<Partial<Record<TraceHintTrigger, true>>>({});
  const recordedFirstTimeSeenRef = useRef(false);
  const resolvedPostPrimeTraceRef = useRef(false);

  const baseHintSeed = useMemo(() => {
    const anchorSeed = `${category}:${structureVariant}:${distilledLetters.join('')}`;
    return `${anchorSeed}:${userSeed}:trace_hint`;
  }, [category, structureVariant, distilledLetters, userSeed]);

  const shouldShowFirstTimeHint =
    !hasTracedBefore && !isTraceHintExhausted(TRACE_HINT_FIRST_TIME_EXHAUSTION_ID);

  const [hintState, setHintState] = useState<TraceHintState>(() => {
    const trigger: TraceHintTrigger = shouldShowFirstTimeHint ? 'first_time' : 'returning';
    const variants = shouldShowFirstTimeHint ? TRACE_HINT_FIRST_TIME : TRACE_HINT_RETURNING_BASE;
    const selectedHint = variants[stableIndex(`${baseHintSeed}:${trigger}`, variants.length)];

    return {
      hint: selectedHint,
      trigger,
    };
  });

  // Convert points array to SVG path data
  const pointsToPathData = (points: Point[]): string => {
    if (points.length === 0) return '';

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  };

  // Calculate fidelity score (simplified - in production, use proper SVG overlap detection)
  const calculateFidelity = useCallback((newStrokes: Stroke[]): number => {
    // Simplified fidelity calculation based on stroke count and coverage
    // In production, this should use proper SVG path intersection algorithms
    const coverage = Math.min(newStrokes.length * 15, 100);
    return Math.round(coverage);
  }, []);

  // Use refs to track current stroke without causing re-renders
  const currentStrokeRef = useRef<Point[]>([]);
  const updateCounterRef = useRef(0);

  const trackHint = useCallback(
    (hint: TraceHintVariant, trigger: TraceHintTrigger) => {
      const shownKey = `${hint.id}:${trigger}`;
      if (!trackedShownRef.current[shownKey]) {
        trackedShownRef.current[shownKey] = true;
        AnalyticsService.track('trace_hint_shown', {
          hintId: hint.id,
          tone: hint.tone,
          trigger,
        });
      }

      if (!trackedTriggersRef.current[trigger]) {
        trackedTriggersRef.current[trigger] = true;
        AnalyticsService.track('trace_hint_triggered', {
          triggerType: trigger,
        });
      }

      if (trigger === 'first_time' && !recordedFirstTimeSeenRef.current) {
        recordedFirstTimeSeenRef.current = true;
        recordTraceHintSeen(TRACE_HINT_FIRST_TIME_EXHAUSTION_ID);
      }
    },
    [recordTraceHintSeen]
  );

  const applyHintOverride = useCallback(
    (
      trigger: Extract<TraceHintTrigger, 'hesitation' | 'undo_spam'>,
      variants: readonly TraceHintVariant[]
    ) => {
      if (overrideAppliedRef.current) {
        return;
      }

      const selectedHint = variants[stableIndex(`${baseHintSeed}:${trigger}`, variants.length)];
      overrideAppliedRef.current = true;
      setHintState((currentState) => {
        if (currentState.hint.id === selectedHint.id && currentState.trigger === trigger) {
          return currentState;
        }
        return { hint: selectedHint, trigger };
      });
    },
    [baseHintSeed]
  );

  useEffect(() => {
    hasStartedDrawingRef.current = hasStartedDrawing;
  }, [hasStartedDrawing]);

  useEffect(() => {
    if (isPostPrimeTrace) {
      return;
    }

    trackHint(hintState.hint, hintState.trigger);
  }, [hintState, isPostPrimeTrace, trackHint]);

  useEffect(() => {
    if (isPostPrimeTrace) {
      return;
    }

    if (!canvasReady || hasStartedDrawing || overrideAppliedRef.current) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (hasStartedDrawingRef.current || overrideAppliedRef.current) {
        return;
      }
      applyHintOverride('hesitation', TRACE_HINT_HESITATION);
    }, HESITATION_DELAY_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [canvasReady, hasStartedDrawing, applyHintOverride, isPostPrimeTrace]);

  const resolvePostPrimeTrace = useCallback(
    (result: 'completed' | 'skipped') => {
      if (!isPostPrimeTrace) {
        return;
      }

      if (resolvedPostPrimeTraceRef.current) {
        return;
      }

      resolvedPostPrimeTraceRef.current = true;

      if (activePostPrimeFlowId) {
        finishPostPrimeTraceFlow(activePostPrimeFlowId, result);
      }

      navigation.goBack();
    },
    [activePostPrimeFlowId, finishPostPrimeTraceFlow, isPostPrimeTrace, navigation]
  );

  useEffect(() => {
    return () => {
      if (!isPostPrimeTrace || resolvedPostPrimeTraceRef.current || !activePostPrimeFlowId) {
        return;
      }

      finishPostPrimeTraceFlow(activePostPrimeFlowId, 'skipped');
    };
  }, [activePostPrimeFlowId, finishPostPrimeTraceFlow, isPostPrimeTrace]);

  // Handlers that will be called from UI thread
  const handleGestureStart = (x: number, y: number) => {
    currentStrokeRef.current = [{ x, y }];
    updateCounterRef.current = 0;
    setIsDrawing(true);
    setCurrentStroke([{ x, y }]);

    if (!hasStartedDrawingRef.current) {
      hasStartedDrawingRef.current = true;
      setHasStartedDrawing(true);
    }
  };

  const handleGestureUpdate = (x: number, y: number) => {
    currentStrokeRef.current.push({ x, y });

    // Only update visual state every 3rd point to reduce re-renders
    updateCounterRef.current++;
    if (updateCounterRef.current % 3 === 0) {
      setCurrentStroke([...currentStrokeRef.current]);
    }
  };

  const handleGestureEnd = () => {
    const points = currentStrokeRef.current;

    if (points.length > 1) {
      const newStroke: Stroke = {
        points: [...points],
        pathData: pointsToPathData(points),
      };

      const updatedStrokes = [...strokes, newStroke];
      setStrokes(updatedStrokes);
      setStrokeCount(updatedStrokes.length);

      // Calculate new fidelity score
      const newFidelity = calculateFidelity(updatedStrokes);
      setFidelityScore(newFidelity);

      if (isPostPrimeTrace) {
        void playSound('letter-drop', 0.65);
      }
    }

    currentStrokeRef.current = [];
    setCurrentStroke([]);
    setIsDrawing(false);
  };

  // Handle drawing gestures
  const panGesture = Gesture.Pan()
    .onStart((event) => {
      runOnJS(handleGestureStart)(event.x, event.y);
    })
    .onUpdate((event) => {
      runOnJS(handleGestureUpdate)(event.x, event.y);
    })
    .onEnd(() => {
      runOnJS(handleGestureEnd)();
    });

  // Convert user strokes to SVG string
  const strokesToSvg = (): string => {
    const paths = strokes.map(
      (stroke) => `<path d="${stroke.pathData}" stroke="#D9B36C" stroke-width="${liveStrokeWidth}" fill="none" />`
    );

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvasSize} ${canvasSize}">
        ${paths.join('\n')}
      </svg>
    `.trim();
  };

  const completeTrace = useCallback(() => {
    const timeSpentMs = Date.now() - startTime.current;
    const reinforcedSvg = strokesToSvg();
    resetTraceSkipStreak();

    if (!isPostPrimeTrace && strokeCount > 0) {
      setUserFlag('hasTracedBefore', true);
      exhaustTraceHint(TRACE_HINT_FIRST_TIME_EXHAUSTION_ID);
    }

    if (isPostPrimeTrace) {
      void playSound('forge-seal');
      resolvePostPrimeTrace('completed');
      return;
    }

    useFirstAnchorFlowStore.getState().updateDraft({ traceSvg: reinforcedSvg });
    navigation.navigate('StyleSelection', {
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      reinforcedSigilSvg: reinforcedSvg,
      structureVariant,
      reinforcementMetadata: {
        completed: true,
        skipped: false,
        strokeCount,
        fidelityScore,
        timeSpentMs,
        completedAt: new Date(),
      },
    });
  }, [
    baseSigilSvg,
    category,
    distilledLetters,
    fidelityScore,
    intentionText,
    isPostPrimeTrace,
    navigation,
    resetTraceSkipStreak,
    resolvePostPrimeTrace,
    setUserFlag,
    exhaustTraceHint,
    strokeCount,
    structureVariant,
  ]);

  const [continuing, setContinuing] = useState(false);

  const handleComplete = () => {
    if (strokeCount === 0 || continuing) return;
    setContinuing(true);
    setShowStructureSet(true);
    setTimeout(completeTrace, reduceMotion ? 0 : 520);
  };

  const continueAfterSkip = useCallback((timeSpentMs: number) => {
    if (isPostPrimeTrace) {
      resolvePostPrimeTrace('skipped');
      return;
    }

    useFirstAnchorFlowStore.getState().updateDraft({ traceSvg: undefined });
    navigation.navigate('StyleSelection', {
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      reinforcedSigilSvg: undefined,
      structureVariant,
      reinforcementMetadata: {
        completed: false,
        skipped: true,
        strokeCount: 0,
        fidelityScore: 0,
        timeSpentMs,
      },
    });
  }, [
    baseSigilSvg,
    category,
    distilledLetters,
    intentionText,
    isPostPrimeTrace,
    navigation,
    resolvePostPrimeTrace,
    structureVariant,
  ]);

  const handleSkip = () => {
    if (continuing || showTraceDefaultPrompt) return;
    const timeSpentMs = Date.now() - startTime.current;
    const nextSkipStreak = recordTraceSkipped();

    if (nextSkipStreak === 3) {
      pendingSkipTimeSpentMsRef.current = timeSpentMs;
      setShowTraceDefaultPrompt(true);
      return;
    }

    setContinuing(true);
    continueAfterSkip(timeSpentMs);
  };

  const handleDisableTraceDefault = () => {
    const timeSpentMs = pendingSkipTimeSpentMsRef.current ?? Date.now() - startTime.current;
    pendingSkipTimeSpentMsRef.current = null;
    setShowTraceDefaultPrompt(false);
    setTraceDefaultEnabled(false);
    resetTraceSkipStreak();
    AnalyticsService.track('trace_default_disabled', { source: 'adaptive_prompt' });
    setContinuing(true);
    continueAfterSkip(timeSpentMs);
  };

  const handleKeepTraceDefault = () => {
    const timeSpentMs = pendingSkipTimeSpentMsRef.current ?? Date.now() - startTime.current;
    pendingSkipTimeSpentMsRef.current = null;
    setShowTraceDefaultPrompt(false);
    resetTraceSkipStreak();
    setContinuing(true);
    continueAfterSkip(timeSpentMs);
  };

  const handleClearLast = () => {
    if (strokes.length > 0) {
      const updatedStrokes = strokes.slice(0, -1);
      setStrokes(updatedStrokes);
      setStrokeCount(updatedStrokes.length);
      setFidelityScore(calculateFidelity(updatedStrokes));

      const now = Date.now();
      undoPressTimesRef.current = undoPressTimesRef.current
        .filter((timestamp) => now - timestamp <= UNDO_SPAM_WINDOW_MS)
        .concat(now);

      if (undoPressTimesRef.current.length >= UNDO_SPAM_THRESHOLD) {
        applyHintOverride('undo_spam', TRACE_HINT_UNDO_SPAM);
      }
    }
  };

  const clearAllConfirmed = () => {
    setStrokes([]);
    setStrokeCount(0);
    setFidelityScore(0);
    setShowClearConfirm(false);
  };

  // Clearing a single (or zero) stroke happens directly; two or more strokes
  // require the inline confirmation row before they're discarded.
  const requestClear = () => {
    if (strokes.length >= 2) {
      setShowClearConfirm(true);
    } else {
      clearAllConfirmed();
    }
  };

  const cancelClear = () => setShowClearConfirm(false);

  // Guide brightens toward Bright Gilt as the fidelity/coverage estimate rises.
  const guideResolvedOpacity = useSharedValue(0);
  useEffect(() => {
    guideResolvedOpacity.value = withTiming(showStructureSet ? 1 : fidelityScore / 100, {
      duration: reduceMotion ? 0 : 450,
      easing: Easing.out(Easing.cubic),
    });
  }, [fidelityScore, showStructureSet, reduceMotion, guideResolvedOpacity]);
  const guideResolvedStyle = useAnimatedStyle(() => ({ opacity: guideResolvedOpacity.value }));

  const touchGlowOpacity = useSharedValue(0);
  useEffect(() => {
    touchGlowOpacity.value = withTiming(isDrawing ? 1 : 0, { duration: reduceMotion ? 0 : 150 });
  }, [isDrawing, reduceMotion, touchGlowOpacity]);
  const touchGlowStyle = useAnimatedStyle(() => ({ opacity: touchGlowOpacity.value }));
  const touchPos = currentStroke.length > 0 ? currentStroke[currentStroke.length - 1] : null;

  if (isPostPrimeTrace && !postPrimeAnchor) {
    return (
      <View style={styles.container}>
        <ZenBackground variant="sanctuary" />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.missingAnchorWrap}>
            <Text style={styles.title}>Trace unavailable</Text>
            <Text style={styles.body}>We couldn&apos;t load your anchor for retracing.</Text>
            <Pressable
              style={({ pressed }) => [styles.nextBtn, pressed && styles.nextBtnPressed]}
              onPress={() => resolvePostPrimeTrace('skipped')}
              accessibilityRole="button"
              accessibilityLabel="Return"
            >
              <Text style={styles.nextBtnText}>Return</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ZenBackground variant="sanctuary" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            onPress={() => navigation.goBack()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back to structure options"
          >
            <BackChevronIcon size={16} color={boneSoft} />
          </Pressable>
          <Text style={styles.stepTag}>{isPostPrimeTrace ? 'Trace' : 'Structure'}</Text>
        </View>

        <View
          style={[styles.scrollContent, { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 12 }]}
        >
          <View style={styles.textZone}>
            <View style={styles.eyebrowRow}>
              <View style={styles.eyebrowRule} />
              <Text style={styles.eyebrow}>Structure</Text>
            </View>
            <Text style={styles.title}>
              {isPostPrimeTrace ? 'Trace to deepen' : 'Trace your structure'}
            </Text>
            <Text style={styles.body}>
              {isPostPrimeTrace ? 'Refine and deepen.' : 'Follow the form once before it becomes your Anchor.'}
            </Text>
          </View>

          {!isPostPrimeTrace && shouldShowFirstTimeHint ? (
            <View style={styles.teachBanner}>
              <Text style={styles.teachBannerText}>
                Tracing is optional. It doesn&rsquo;t make one Anchor stronger than another.
              </Text>
            </View>
          ) : null}

          <View style={[styles.canvasFrame, { width: canvasSize, height: canvasSize }]}>
            <View style={styles.canvasGlow} pointerEvents="none" />

            {/* Faint base guide — the real generated structure, not a placeholder */}
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
              <View style={{ opacity: 0.32 }}>
                <SvgXml xml={baseSigilSvg} width="100%" height="100%" color={gilt} />
              </View>
              <Animated.View style={[StyleSheet.absoluteFillObject, guideResolvedStyle]}>
                <SvgXml xml={baseSigilSvg} width="100%" height="100%" color={giltBright} />
              </Animated.View>
            </View>

            <GestureDetector gesture={panGesture}>
              <View
                style={styles.canvasTouchSurface}
                onLayout={() => {
                  if (!canvasReady) {
                    setCanvasReady(true);
                  }
                }}
              >
                <Svg width={canvasSize} height={canvasSize} style={styles.svg}>
                  {strokes.map((stroke, index) => (
                    <React.Fragment key={index}>
                      <Path
                        d={stroke.pathData}
                        stroke={giltBright}
                        strokeOpacity={0.35}
                        strokeWidth={liveStrokeWidth + 6}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Path
                        d={stroke.pathData}
                        stroke={giltBright}
                        strokeWidth={liveStrokeWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </React.Fragment>
                  ))}

                  {currentStroke.length > 0 && (
                    <React.Fragment>
                      <Path
                        d={pointsToPathData(currentStroke)}
                        stroke={giltBright}
                        strokeOpacity={0.35}
                        strokeWidth={liveStrokeWidth + 6}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <Path
                        d={pointsToPathData(currentStroke)}
                        stroke={giltBright}
                        strokeWidth={liveStrokeWidth}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </React.Fragment>
                  )}
                </Svg>
              </View>
            </GestureDetector>

            {touchPos ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.touchGlow,
                  touchGlowStyle,
                  { left: touchPos.x - 23, top: touchPos.y - 23 },
                ]}
              />
            ) : null}

            {!hasStartedDrawing && !isPostPrimeTrace ? (
              <Text style={styles.emptyPrompt} pointerEvents="none">Trace anywhere on the form.</Text>
            ) : null}

            <View style={[styles.structureSetLabel, showStructureSet && styles.structureSetLabelVisible]} pointerEvents="none">
              <Text style={styles.structureSetText}>Structure Set</Text>
            </View>
          </View>

          {!isPostPrimeTrace ? (
            <View style={styles.headerTeachRow}>
              <Text style={styles.headerTeach}>
                Move slowly along the gold lines. Overlap is okay.{' '}
              </Text>
              <Pressable
                onPress={() => setShowAboutTracing(true)}
                hitSlop={14}
                style={styles.principlesQ}
                accessibilityRole="button"
                accessibilityLabel="About tracing"
              >
                <Text style={styles.principlesQText}>?</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.toolRow}>
            <Pressable
              style={styles.toolBtn}
              onPress={handleClearLast}
              disabled={strokes.length === 0}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Undo last trace stroke"
              accessibilityState={{ disabled: strokes.length === 0 }}
            >
              <IconUndo color={strokes.length === 0 ? boneFaint : boneSoft} />
              <Text style={[styles.toolLabel, strokes.length === 0 && styles.toolLabelDisabled]}>Undo</Text>
            </Pressable>

            <Pressable
              style={styles.toolBtn}
              onPress={requestClear}
              disabled={strokes.length === 0}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Clear tracing"
              accessibilityState={{ disabled: strokes.length === 0 }}
            >
              <IconClear color={strokes.length === 0 ? boneFaint : boneSoft} />
              <Text style={[styles.toolLabel, strokes.length === 0 && styles.toolLabelDisabled]}>Clear</Text>
            </Pressable>
          </View>

          {showClearConfirm ? (
            <View style={styles.clearConfirm}>
              <Text style={styles.clearConfirmText}>Clear your tracing?</Text>
              <View style={styles.clearConfirmActions}>
                <Pressable onPress={cancelClear} hitSlop={14} accessibilityRole="button" accessibilityLabel="Cancel">
                  <Text style={styles.clearConfirmActionText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={clearAllConfirmed} hitSlop={14} accessibilityRole="button" accessibilityLabel="Clear">
                  <Text style={[styles.clearConfirmActionText, styles.clearConfirmDanger]}>Clear</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {showTraceDefaultPrompt ? (
            <View style={styles.traceDefaultPrompt}>
              <Text style={styles.traceDefaultPromptText}>
                Skip tracing by default? You can turn it back on in Settings.
              </Text>
              <View style={styles.traceDefaultPromptActions}>
                <Pressable
                  style={({ pressed }) => [styles.nextBtnSmall, pressed && styles.nextBtnPressed]}
                  onPress={handleDisableTraceDefault}
                  accessibilityRole="button"
                  accessibilityLabel="Yes, skip by default"
                >
                  <Text style={styles.nextBtnSmallText}>Yes, skip by default</Text>
                </Pressable>
                <Pressable
                  onPress={handleKeepTraceDefault}
                  accessibilityRole="button"
                  accessibilityLabel="No, keep asking"
                  style={styles.traceDefaultPromptSecondary}
                >
                  <Text style={styles.traceDefaultPromptSecondaryText}>No, keep asking</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          <View style={{ flex: 1 }} />

          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 18) }]}>
            <Pressable
              onPress={handleComplete}
              disabled={strokeCount === 0 || continuing}
              style={({ pressed }) => [
                styles.nextBtn,
                (strokeCount === 0 || continuing) && styles.nextBtnDisabled,
                pressed && strokeCount > 0 && !continuing && styles.nextBtnPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isPostPrimeTrace ? 'Complete trace' : 'Continue'}
              accessibilityState={{ disabled: strokeCount === 0 || continuing }}
            >
              <Text style={styles.nextBtnText}>
                {isPostPrimeTrace ? 'Complete trace' : 'Continue →'}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSkip}
              disabled={showTraceDefaultPrompt || continuing}
              hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={isPostPrimeTrace ? 'Skip' : 'Skip Tracing'}
              accessibilityState={{ disabled: showTraceDefaultPrompt || continuing }}
              style={styles.skipLink}
            >
              <Text style={styles.skipLinkText}>
                {isPostPrimeTrace ? 'Skip' : 'Skip Tracing'}
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {showAboutTracing ? (
        <View style={styles.sheetRoot}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setShowAboutTracing(false)} accessibilityLabel="Dismiss" />
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 40 }]} accessibilityViewIsModal>
            <View style={styles.sheetHandle} />
            <Pressable
              onPress={() => setShowAboutTracing(false)}
              hitSlop={8}
              style={styles.sheetClose}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <CloseIcon size={12} color={boneFaint} />
            </Pressable>
            <Text style={styles.sheetTitle}>About Tracing</Text>
            <View style={[styles.sheetItem, styles.sheetItemFirst]}>
              <Text style={styles.sheetItemTitle}>
                Tracing is optional. It doesn&rsquo;t make one Anchor stronger than another.
              </Text>
            </View>
            <View style={styles.sheetItem}>
              <Text style={styles.sheetItemTitle}>
                It gives you a moment to move through the form before it becomes your Anchor.
              </Text>
            </View>
            <Pressable
              onPress={() => setShowAboutTracing(false)}
              style={({ pressed }) => [styles.sheetDismiss, pressed && styles.nextBtnPressed]}
              accessibilityRole="button"
              accessibilityLabel="Got it"
            >
              <Text style={styles.sheetDismissText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.anchor15.navy,
  },
  safeArea: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: hairlineGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnPressed: {
    borderColor: goldLine,
  },
  stepTag: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 2,
    color: ash,
    textTransform: 'uppercase',
  },
  scrollContent: {
    flex: 1,
  },
  textZone: {
    marginTop: 12,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  eyebrowRule: {
    width: 20,
    height: 1,
    backgroundColor: goldLine,
  },
  eyebrow: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 2.2,
    color: ash,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic',
    fontWeight: '500',
    fontSize: 25,
    lineHeight: 32,
    color: bone,
    letterSpacing: 0.15,
    marginBottom: 14,
  },
  body: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 16,
    color: boneSoft,
    lineHeight: 25.6,
  },
  teachBanner: {
    marginTop: 14,
    padding: 13,
    borderRadius: 12,
    backgroundColor: 'rgba(217, 179, 108, 0.07)',
    borderWidth: 1,
    borderColor: hairline,
  },
  teachBannerText: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 12.5,
    lineHeight: 19.4,
    color: boneSoft,
  },
  canvasFrame: {
    alignSelf: 'center',
    marginTop: 16,
    borderRadius: 20,
    backgroundColor: '#0A0F14',
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.32)',
    overflow: 'hidden',
    position: 'relative',
  },
  canvasGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.anchor15.steel,
    opacity: 0.28,
  },
  canvasTouchSurface: {
    ...StyleSheet.absoluteFillObject,
  },
  svg: {
    backgroundColor: 'transparent',
  },
  touchGlow: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: 'rgba(242, 223, 168, 0.28)',
  },
  emptyPrompt: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '46%',
    textAlign: 'center',
    color: boneFaint,
    fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic',
    fontSize: 15,
  },
  structureSetLabel: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8, 13, 19, 0.35)',
    opacity: 0,
  },
  structureSetLabelVisible: {
    opacity: 1,
  },
  structureSetText: {
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 2.88,
    textTransform: 'uppercase',
    color: giltBright,
  },
  headerTeachRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTeach: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 12.5,
    lineHeight: 19.4,
    color: ash,
    textAlign: 'center',
  },
  principlesQ: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  principlesQText: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 10,
    color: gilt,
  },
  toolRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 16,
  },
  toolBtn: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: 12,
  },
  toolLabel: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 9,
    fontWeight: '500',
    letterSpacing: 1.26,
    textTransform: 'uppercase',
    color: boneSoft,
  },
  toolLabelDisabled: {
    color: boneFaint,
  },
  clearConfirm: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(15, 20, 25, 0.9)',
    borderWidth: 1,
    borderColor: goldLine,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearConfirmText: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 13,
    color: boneSoft,
  },
  clearConfirmActions: {
    flexDirection: 'row',
    gap: 14,
  },
  clearConfirmActionText: {
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: ash,
  },
  clearConfirmDanger: {
    color: giltBright,
  },
  traceDefaultPrompt: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: goldLine,
    backgroundColor: 'rgba(10, 13, 18, 0.86)',
    padding: 16,
  },
  traceDefaultPromptText: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 13,
    lineHeight: 19,
    color: bone,
    textAlign: 'center',
    marginBottom: 14,
  },
  traceDefaultPromptActions: {
    gap: 8,
  },
  nextBtnSmall: {
    minHeight: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(217, 179, 108, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  nextBtnSmallText: {
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontWeight: '600',
    fontSize: 12,
    letterSpacing: 1.2,
    color: giltBright,
    textTransform: 'uppercase',
  },
  traceDefaultPromptSecondary: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  traceDefaultPromptSecondaryText: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 13,
    color: ash,
  },
  bottomBar: {
    paddingTop: 18,
    alignItems: 'center',
    gap: 4,
  },
  nextBtn: {
    width: '100%',
    height: 56,
    borderRadius: 999,
    backgroundColor: 'rgba(217, 179, 108, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnPressed: {
    backgroundColor: 'rgba(217, 179, 108, 0.16)',
    borderColor: 'rgba(217, 179, 108, 0.48)',
  },
  nextBtnDisabled: {
    opacity: 0.36,
  },
  nextBtnText: {
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 2.52,
    color: giltBright,
    textTransform: 'uppercase',
  },
  skipLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  skipLinkText: {
    fontFamily: typography.fontFamily.instrument,
    fontSize: 12.5,
    color: ash,
  },
  missingAnchorWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  sheetRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 9, 13, 0.7)',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: goldLine,
    backgroundColor: colors.anchor15.veil,
    paddingHorizontal: 26,
    paddingTop: 14,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 99,
    backgroundColor: 'rgba(244, 239, 230, 0.18)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetClose: {
    position: 'absolute',
    top: 14,
    right: 20,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: hairlineGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontFamily: typography.fontFamily.ritual,
    fontSize: 11,
    letterSpacing: 2.42,
    textTransform: 'uppercase',
    color: ash,
    textAlign: 'center',
    marginBottom: 18,
  },
  sheetItem: {
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: hairlineGold,
  },
  sheetItemFirst: {
    borderTopWidth: 0,
    paddingTop: 0,
  },
  sheetItemTitle: {
    fontFamily: typography.fontFamily.voiceItalic,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 22.7,
    color: bone,
  },
  sheetDismiss: {
    width: '100%',
    height: 48,
    borderRadius: 999,
    marginTop: 22,
    backgroundColor: 'rgba(217, 179, 108, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(217, 179, 108, 0.34)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetDismissText: {
    fontFamily: typography.fontFamily.ritualSemiBold,
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 2.08,
    color: giltBright,
    textTransform: 'uppercase',
  },
});
