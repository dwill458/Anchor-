import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Svg, { Path, G, SvgXml } from 'react-native-svg';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { RootStackParamList, AnchorCategory, SigilVariant } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { ZenBackground, UndertoneLine } from '@/components/common';
import { useAuthStore } from '@/stores/authStore';
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

type ManualReinforcementRouteProp = RouteProp<RootStackParamList, 'ManualReinforcement'>;
type ManualReinforcementNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ManualReinforcement'
>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_SIZE = Math.min(SCREEN_WIDTH - 48, SCREEN_HEIGHT * 0.5);
const STROKE_WIDTH = 3;
const GLOW_DISTANCE = 20; // Distance in pixels to trigger glow effect
const HESITATION_DELAY_MS = 5000;
const UNDO_SPAM_WINDOW_MS = 15000;
const UNDO_SPAM_THRESHOLD = 2;

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

/**
 * ManualReinforcementScreen
 *
 * Step 4 in the new architecture: Manual reinforcement (guided tracing).
 *
 * User traces over the faint base structure to "reinforce" it with their
 * intentional energy. Implements soft constraints with real-time feedback:
 * - Glow effect when strokes are close to the base structure
 * - Fidelity score tracking (overlap percentage)
 * - Option to skip (with encouragement)
 *
 * Next: LockStructureScreen (structure confirmation & celebration)
 */
export default function ManualReinforcementScreen() {
  const route = useRoute<ManualReinforcementRouteProp>();
  const navigation = useNavigation<ManualReinforcementNavigationProp>();

  const {
    intentionText,
    category,
    distilledLetters,
    baseSigilSvg,
    structureVariant,
  } = route.params;

  // Drawing state
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [fidelityScore, setFidelityScore] = useState(0);
  const [strokeCount, setStrokeCount] = useState(0);
  const [hasStartedDrawing, setHasStartedDrawing] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
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
    trackHint(hintState.hint, hintState.trigger);
  }, [hintState, trackHint]);

  useEffect(() => {
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
  }, [canvasReady, hasStartedDrawing, applyHintOverride]);

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
      (stroke) => `<path d="${stroke.pathData}" stroke="#D4AF37" stroke-width="${STROKE_WIDTH}" fill="none" />`
    );

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}">
        ${paths.join('\n')}
      </svg>
    `.trim();
  };

  const handleComplete = () => {
    const timeSpentMs = Date.now() - startTime.current;
    const reinforcedSvg = strokesToSvg();

    if (strokeCount > 0) {
      setUserFlag('hasTracedBefore', true);
      exhaustTraceHint(TRACE_HINT_FIRST_TIME_EXHAUSTION_ID);
    }

    navigation.navigate('LockStructure', {
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
  };

  const handleSkip = () => {
    setShowSkipModal(true);
  };

  const handleConfirmSkip = () => {
    const timeSpentMs = Date.now() - startTime.current;

    setShowSkipModal(false);
    navigation.navigate('LockStructure', {
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
  };

  const handleCancelSkip = () => {
    setShowSkipModal(false);
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

  const handleClearAll = () => {
    Alert.alert('Clear All Strokes?', 'This will remove all your tracing progress.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start Over',
        style: 'destructive',
        onPress: () => {
          setStrokes([]);
          setStrokeCount(0);
          setFidelityScore(0);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ZenBackground />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Trace Your Structure</Text>
        <Text style={styles.subtitle}>
          Move slowly over the lines. Let your hand remember.
        </Text>
      </View>

      {/* Drawing Canvas */}
      <View style={styles.canvasContainer}>
        <GestureDetector gesture={panGesture}>
          <View
            style={styles.canvas}
            onLayout={() => {
              if (!canvasReady) {
                setCanvasReady(true);
              }
            }}
          >
            <Svg width={CANVAS_SIZE} height={CANVAS_SIZE} style={styles.svg}>
              {/* Base structure (faint underlay) */}
              <G opacity={0.3}>
                <SvgXml xml={baseSigilSvg} width="100%" height="100%" color="#D4AF37" />
              </G>

              {/* Completed strokes */}
              {strokes.map((stroke, index) => (
                <Path
                  key={index}
                  d={stroke.pathData}
                  stroke="rgba(212, 175, 55, 0.85)"
                  strokeWidth={STROKE_WIDTH + 1}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {/* Current stroke being drawn */}
              {currentStroke.length > 0 && (
                <Path
                  d={pointsToPathData(currentStroke)}
                  stroke="rgba(212, 175, 55, 0.85)"
                  strokeWidth={STROKE_WIDTH + 1}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </Svg>
          </View>
        </GestureDetector>

        <View style={styles.hintOverlay}>
          <View style={styles.hintLine}>
            <UndertoneLine text={hintState.hint.copy} variant="default" />
          </View>
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.controlButton, styles.secondaryButton]}
            onPress={handleClearLast}
            disabled={strokes.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Undo"
            accessibilityState={{ disabled: strokes.length === 0 }}
          >
            <Text style={styles.controlButtonText}>Undo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.secondaryButton]}
            onPress={handleClearAll}
            disabled={strokes.length === 0}
            accessibilityRole="button"
            accessibilityLabel="Start over"
            accessibilityState={{ disabled: strokes.length === 0 }}
          >
            <Text style={styles.controlButtonText}>Start Over</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.completeButton}
          onPress={handleComplete}
          disabled={strokeCount === 0}
          accessibilityRole="button"
          accessibilityLabel="Lock Structure"
          accessibilityState={{ disabled: strokeCount === 0 }}
        >
          <Text style={styles.completeButtonText}>Lock Structure</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          accessibilityRole="button"
          accessibilityLabel="Continue without tracing"
        >
          <Text style={styles.skipButtonText}>Continue without tracing</Text>
        </TouchableOpacity>
      </View>

      {/* Skip Confirmation Modal */}
      <Modal
        visible={showSkipModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleCancelSkip}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Continue Without Tracing</Text>
            <Text style={styles.modalBody}>
              Some find tracing deepens their focus. It's completely optional.
            </Text>

            <TouchableOpacity
              style={styles.modalPrimaryButton}
              onPress={handleCancelSkip}
              accessibilityRole="button"
              accessibilityLabel="Stay and Trace"
            >
              <Text style={styles.modalPrimaryButtonText}>Stay and Trace</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalSecondaryButton}
              onPress={handleConfirmSkip}
              accessibilityRole="button"
              accessibilityLabel="Continue"
            >
              <Text style={styles.modalSecondaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: typography.fonts.heading,
    fontSize: 28,
    color: colors.gold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  canvasContainer: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
    position: 'relative',
  },
  canvas: {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    backgroundColor: colors.background.card,
    borderRadius: spacing.md,
    borderWidth: 2,
    borderColor: colors.gold,
    overflow: 'hidden',
  },
  svg: {
    backgroundColor: 'transparent',
  },
  hintOverlay: {
    position: 'absolute',
    bottom: -spacing.lg - 8,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  hintLine: {
    width: CANVAS_SIZE,
    paddingHorizontal: spacing.sm,
  },
  controls: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  controlButton: {
    flex: 1,
    height: 44,
    borderRadius: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.navy,
  },
  controlButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  completeButton: {
    height: 56,
    borderRadius: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.gold,
    marginBottom: spacing.sm,
  },
  completeButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    fontWeight: '600',
    color: colors.charcoal,
  },
  skipButton: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: spacing.sm,
  },
  skipButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 20, 30, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: 'rgba(40, 40, 50, 1)',
    borderRadius: 16,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  modalTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: 20,
    color: '#E8E8E8',
    textAlign: 'center',
    marginBottom: 16,
  },
  modalBody: {
    fontFamily: typography.fonts.body,
    fontSize: 15,
    color: '#9B9B9B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalPrimaryButton: {
    backgroundColor: colors.gold,
    height: 52,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalPrimaryButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  modalSecondaryButton: {
    backgroundColor: 'transparent',
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSecondaryButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    fontWeight: '400',
    color: '#9B9B9B',
  },
});
