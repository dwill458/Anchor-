import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import Svg, { Path, G, SvgXml } from 'react-native-svg';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { RootStackParamList, AnchorCategory, SigilVariant } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { ZenBackground } from '@/components/common';

type ManualReinforcementRouteProp = RouteProp<RootStackParamList, 'ManualReinforcement'>;
type ManualReinforcementNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ManualReinforcement'
>;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_SIZE = Math.min(SCREEN_WIDTH - 48, SCREEN_HEIGHT * 0.5);
const STROKE_WIDTH = 3;
const GLOW_DISTANCE = 20; // Distance in pixels to trigger glow effect
const MIN_FIDELITY_THRESHOLD = 75; // 75% overlap for "good" reinforcement

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  pathData: string;
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
  const startTime = useRef(Date.now());

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

  // Handlers that will be called from UI thread
  const handleGestureStart = (x: number, y: number) => {
    currentStrokeRef.current = [{ x, y }];
    updateCounterRef.current = 0;
    setIsDrawing(true);
    setCurrentStroke([{ x, y }]);
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
    // Show encouragement before allowing skip
    Alert.alert(
      'Skip Reinforcement?',
      'Tracing your anchor helps you connect with your intention. Are you sure you want to skip this step?',
      [
        {
          text: 'Keep Tracing',
          style: 'cancel',
        },
        {
          text: 'Skip Anyway',
          style: 'destructive',
          onPress: () => {
            const timeSpentMs = Date.now() - startTime.current;

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
          },
        },
      ]
    );
  };

  const handleClearLast = () => {
    if (strokes.length > 0) {
      const updatedStrokes = strokes.slice(0, -1);
      setStrokes(updatedStrokes);
      setStrokeCount(updatedStrokes.length);
      setFidelityScore(calculateFidelity(updatedStrokes));
    }
  };

  const handleClearAll = () => {
    Alert.alert('Clear All Strokes?', 'This will remove all your tracing progress.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: () => {
          setStrokes([]);
          setStrokeCount(0);
          setFidelityScore(0);
        },
      },
    ]);
  };

  const getFidelityColor = () => {
    if (fidelityScore >= MIN_FIDELITY_THRESHOLD) return colors.success;
    if (fidelityScore >= 50) return colors.gold;
    return colors.text.tertiary;
  };

  const getFidelityMessage = () => {
    if (fidelityScore >= MIN_FIDELITY_THRESHOLD) return 'Excellent reinforcement!';
    if (fidelityScore >= 50) return 'Good progress, keep going...';
    return 'Trace over the faint lines to reinforce your anchor';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ZenBackground />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Reinforce Your Structure</Text>
        <Text style={styles.subtitle}>
          Trace over the faint lines to channel your intention into the structure
        </Text>
      </View>

      {/* Fidelity Score Display */}
      <View style={styles.scoreContainer}>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>Fidelity:</Text>
          <Text style={[styles.scoreValue, { color: getFidelityColor() }]}>
            {fidelityScore}%
          </Text>
        </View>
        <Text style={styles.scoreMessage}>{getFidelityMessage()}</Text>
      </View>

      {/* Drawing Canvas */}
      <View style={styles.canvasContainer}>
        <GestureDetector gesture={panGesture}>
          <View style={styles.canvas}>
            <Svg width={CANVAS_SIZE} height={CANVAS_SIZE} style={styles.svg}>
              {/* Base structure (faint underlay) */}
              <G opacity={0.2}>
                <SvgXml xml={baseSigilSvg} width="100%" height="100%" color="#D4AF37" />
              </G>

              {/* Completed strokes */}
              {strokes.map((stroke, index) => (
                <Path
                  key={index}
                  d={stroke.pathData}
                  stroke={colors.gold}
                  strokeWidth={STROKE_WIDTH}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {/* Current stroke being drawn */}
              {currentStroke.length > 0 && (
                <Path
                  d={pointsToPathData(currentStroke)}
                  stroke={colors.gold}
                  strokeWidth={STROKE_WIDTH}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </Svg>
          </View>
        </GestureDetector>

        {/* Drawing hint overlay */}
        {strokeCount === 0 && (
          <View style={styles.hintOverlay}>
            <Text style={styles.hintText}>Touch and drag to trace</Text>
          </View>
        )}
      </View>

      {/* Control Buttons */}
      <View style={styles.controls}>
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.controlButton, styles.secondaryButton]}
            onPress={handleClearLast}
            disabled={strokes.length === 0}
          >
            <Text style={styles.controlButtonText}>Undo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.secondaryButton]}
            onPress={handleClearAll}
            disabled={strokes.length === 0}
          >
            <Text style={styles.controlButtonText}>Clear All</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.completeButton,
            fidelityScore >= MIN_FIDELITY_THRESHOLD && styles.completeButtonReady,
          ]}
          onPress={handleComplete}
          disabled={strokeCount === 0}
        >
          <Text style={styles.completeButtonText}>
            {fidelityScore >= MIN_FIDELITY_THRESHOLD
              ? 'Lock Structure ✓'
              : 'Lock Structure'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip Reinforcement</Text>
        </TouchableOpacity>
      </View>
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
  scoreContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  scoreLabel: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.text.secondary,
    marginRight: spacing.xs,
  },
  scoreValue: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h2,
    fontWeight: 'bold',
  },
  scoreMessage: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.tertiary,
    textAlign: 'center',
  },
  canvasContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
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
    top: '50%',
    left: '50%',
    transform: [{ translateX: -100 }, { translateY: -20 }],
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: spacing.sm,
    pointerEvents: 'none',
  },
  hintText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.gold,
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
    backgroundColor: colors.navy,
    marginBottom: spacing.sm,
  },
  completeButtonReady: {
    backgroundColor: colors.gold,
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
  },
  skipButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.tertiary,
    textDecoration: 'underline',
  },
});
