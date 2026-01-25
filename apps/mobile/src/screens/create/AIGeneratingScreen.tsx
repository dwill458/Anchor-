import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, AIStyle } from '@/types';
import { API_URL } from '@/config';
import { useAuthStore } from '@/stores/authStore';
import { logger } from '@/utils/logger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_ANDROID = Platform.OS === 'android';

// Design System Colors (Zen Architect)
const colors = {
  navy: '#0F1419',
  charcoal: '#1A1A1D',
  gold: '#D4AF37',
  bone: '#F5F5DC',
  silver: '#C0C0C0',
  deepPurple: '#3E2C5B',
  bronze: '#CD7F32',
};

type AIGeneratingRouteProp = RouteProp<RootStackParamList, 'AIGenerating'>;
type AIGeneratingNavigationProp = StackNavigationProp<RootStackParamList, 'AIGenerating'>;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Style-specific refinement phrases for ritual experience
 */
const STYLE_REFINEMENT_PHRASES: Record<AIStyle, string> = {
  minimal_line: 'Clarifying lines and balance',
  ink_brush: 'Introducing flow and motion',
  sacred_geometry: 'Aligning structure and proportion',
  watercolor: 'Blending tone and atmosphere',
  gold_leaf: 'Layering luminous essence',
  cosmic: 'Attuning celestial energies',
};

/**
 * Progress phases for ritual progression
 */
const PROGRESS_PHASES = {
  beginning: { threshold: 0, label: 'Beginning' },
  aligning: { threshold: 30, label: 'Aligning' },
  finalizing: { threshold: 80, label: 'Finalizing' },
};

export default function AIGeneratingScreen() {
  const route = useRoute<AIGeneratingRouteProp>();
  const navigation = useNavigation<AIGeneratingNavigationProp>();
  const user = useAuthStore((state) => state.user);

  const {
    intentionText,
    category,
    distilledLetters,
    baseSigilSvg,
    reinforcedSigilSvg,
    structureVariant,
    styleChoice,
    reinforcementMetadata,
  } = route.params;

  const [progress, setProgress] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;

  // Get the current progress phase label
  const getProgressPhase = () => {
    if (progress >= PROGRESS_PHASES.finalizing.threshold) {
      return PROGRESS_PHASES.finalizing.label;
    } else if (progress >= PROGRESS_PHASES.aligning.threshold) {
      return PROGRESS_PHASES.aligning.label;
    } else {
      return PROGRESS_PHASES.beginning.label;
    }
  };

  // Get style-specific refinement phrase
  const refinementPhrase = STYLE_REFINEMENT_PHRASES[styleChoice] || 'Refining your expression';

  /**
   * Render style-specific refinement seal
   * Each style has a unique visual representation and animation
   */
  const renderRefinementSeal = () => {
    const baseOpacity = 0.5;

    switch (styleChoice) {
      case 'minimal_line':
        // Minimal: Clean concentric circles with subtle snapping alignment
        return (
          <Svg width={120} height={120} viewBox="0 0 120 120">
            {/* Outer circle */}
            <Circle
              cx="60"
              cy="60"
              r="50"
              stroke={colors.gold}
              strokeWidth="2"
              fill="none"
              opacity={0.4}
            />
            {/* Middle circle */}
            <Circle
              cx="60"
              cy="60"
              r="35"
              stroke={colors.gold}
              strokeWidth="2"
              fill="none"
              opacity={0.5}
            />
            {/* Inner circle */}
            <Circle
              cx="60"
              cy="60"
              r="20"
              stroke={colors.gold}
              strokeWidth="2.5"
              fill="none"
              opacity={0.6}
            />
            {/* Center dot */}
            <AnimatedCircle
              cx="60"
              cy="60"
              r="4"
              fill={colors.gold}
              opacity={sparkleOpacity}
            />
          </Svg>
        );

      case 'ink_brush':
        // Ink Brush: Organic flowing strokes with motion
        return (
          <Svg width={120} height={120} viewBox="0 0 120 120">
            {/* Flowing brush circle with varying thickness */}
            <Circle
              cx="60"
              cy="60"
              r="45"
              stroke={colors.gold}
              strokeWidth="3"
              fill="none"
              opacity={baseOpacity}
              strokeDasharray="5,3"
            />
            {/* Inner flowing strokes */}
            <AnimatedG opacity={glowOpacity}>
              <Path
                d="M 35 60 Q 60 35, 85 60 Q 60 85, 35 60"
                stroke={colors.gold}
                strokeWidth="2"
                fill="none"
              />
              <Path
                d="M 40 60 Q 60 45, 80 60 Q 60 75, 40 60"
                stroke={colors.gold}
                strokeWidth="1.5"
                fill="none"
                opacity={0.6}
              />
            </AnimatedG>
          </Svg>
        );

      case 'sacred_geometry':
        // Sacred Geometry: Precise geometric patterns with alignment
        // Sacred Geometry: Merkaba / Star of David visualization
        return (
          <Svg width={120} height={120} viewBox="0 0 120 120">
            {/* Outer circle */}
            <Circle
              cx="60"
              cy="60"
              r="50"
              stroke={colors.gold}
              strokeWidth="1"
              fill="none"
              opacity={0.3}
            />

            {/* Star of David (Merkaba Projection) */}
            <AnimatedG opacity={glowOpacity}>
              {/* Upward Triangle */}
              <Path
                d="M 60 15 L 99 82 L 21 82 Z"
                stroke={colors.gold}
                strokeWidth="2"
                fill="none"
              />
              {/* Downward Triangle */}
              <Path
                d="M 60 105 L 21 38 L 99 38 Z"
                stroke={colors.gold}
                strokeWidth="2"
                fill="none"
              />
            </AnimatedG>

            {/* Central 3D Connection Point (Merkaba Core) */}
            <AnimatedCircle
              cx="60"
              cy="60"
              r="4"
              fill={colors.gold}
              opacity={sparkleOpacity}
            />

            {/* Connecting lines for 3D effect */}
            <Path
              d="M 60 60 L 60 15 M 60 60 L 99 82 M 60 60 L 21 82"
              stroke={colors.gold}
              strokeWidth="1"
              opacity={0.4}
            />
            <Path
              d="M 60 60 L 60 105 M 60 60 L 21 38 M 60 60 L 99 38"
              stroke={colors.gold}
              strokeWidth="1"
              opacity={0.4}
            />
          </Svg>
        );

      case 'watercolor':
        // Watercolor: Flowing liquid forms and organic ripples
        return (
          <Svg width={120} height={120} viewBox="0 0 120 120">
            {/* Deep water background flow */}
            <AnimatedG opacity={glowOpacity}>
              <Path
                d="M 0 60 C 30 40, 90 80, 120 60"
                stroke={colors.gold}
                strokeWidth="8"
                fill="none"
                opacity={0.1}
              />
              <Path
                d="M 0 75 C 40 55, 80 95, 120 75"
                stroke={colors.gold}
                strokeWidth="6"
                fill="none"
                opacity={0.15}
              />
            </AnimatedG>

            {/* Middle stream currents */}
            <Path
              d="M 10 55 Q 35 35, 60 55 T 110 55"
              stroke={colors.gold}
              strokeWidth="2"
              fill="none"
              opacity={0.4}
            />
            <Path
              d="M 10 65 Q 35 45, 60 65 T 110 65"
              stroke={colors.gold}
              strokeWidth="2"
              fill="none"
              opacity={0.3}
            />
            <Path
              d="M 10 75 Q 35 55, 60 75 T 110 75"
              stroke={colors.gold}
              strokeWidth="1.5"
              fill="none"
              opacity={0.2}
            />

            {/* Water Pouring into Paint Vessel */}
            <AnimatedG>
              {/* The Stream (Vertical flow) */}
              <AnimatedPath
                d="M 60 20 C 62 40, 58 50, 60 72"
                stroke={colors.gold}
                strokeWidth="3"
                fill="none"
                opacity={sparkleOpacity}
                strokeLinecap="round"
              />

              {/* Water Surface / Splash */}
              <AnimatedCircle
                cx="60"
                cy="72"
                r="12"
                fill={colors.gold}
                opacity={0.3}
                transform={[{ scale: pulseAnim }]}
              />

              {/* The Vessel / Paint Pot */}
              <Path
                d="M 40 72 Q 40 95, 60 95 Q 80 95, 80 72 L 80 65 Q 60 65, 40 65 Z"
                stroke={colors.gold}
                strokeWidth="2"
                fill="none"
                strokeLinejoin="round"
                opacity={0.6}
              />

              {/* Vessel Rim Detail */}
              <Path
                d="M 40 72 Q 60 82, 80 72"
                stroke={colors.gold}
                strokeWidth="1"
                fill="none"
                opacity={0.4}
              />
            </AnimatedG>

            {/* Outer Ripple Rings */}
            <Circle
              cx="60"
              cy="65"
              r="40"
              stroke={colors.gold}
              strokeWidth="1"
              fill="none"
              opacity={0.1}
              strokeDasharray="10,5"
            />
          </Svg>
        );

      case 'gold_leaf':
        // Gold Leaf: Illuminated circle with luxurious glow
        return (
          <Svg width={120} height={120} viewBox="0 0 120 120">
            {/* Outer ornate circle */}
            <Circle
              cx="60"
              cy="60"
              r="50"
              stroke={colors.gold}
              strokeWidth="2.5"
              fill="none"
              opacity={0.5}
            />
            {/* Decorative inner ring */}
            <Circle
              cx="60"
              cy="60"
              r="40"
              stroke={colors.gold}
              strokeWidth="1"
              strokeDasharray="4,4"
              fill="none"
              opacity={0.4}
            />
            {/* Center medallion */}
            <AnimatedCircle
              cx="60"
              cy="60"
              r="25"
              stroke={colors.gold}
              strokeWidth="3"
              fill="none"
              opacity={glowOpacity}
            />
            {/* Inner glow */}
            <AnimatedCircle
              cx="60"
              cy="60"
              r="12"
              fill={colors.gold}
              opacity={sparkleOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 0.5],
              })}
            />
          </Svg>
        );

      case 'cosmic':
        // Cosmic: Ethereal orbital patterns with celestial energy
        return (
          <Svg width={120} height={120} viewBox="0 0 120 120">
            {/* Outer orbit */}
            <AnimatedCircle
              cx="60"
              cy="60"
              r="50"
              stroke={colors.gold}
              strokeWidth="1.5"
              strokeDasharray="6,6"
              fill="none"
              opacity={glowOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.5],
              })}
            />
            {/* Middle orbit */}
            <AnimatedCircle
              cx="60"
              cy="60"
              r="35"
              stroke={colors.gold}
              strokeWidth="1.5"
              strokeDasharray="4,4"
              fill="none"
              opacity={sparkleOpacity}
            />
            {/* Inner core */}
            <AnimatedCircle
              cx="60"
              cy="60"
              r="18"
              fill={colors.gold}
              opacity={glowOpacity.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 0.4],
              })}
            />
            {/* Center star */}
            <AnimatedCircle
              cx="60"
              cy="60"
              r="6"
              fill={colors.bone}
              opacity={sparkleOpacity}
            />
          </Svg>
        );

      default:
        // Fallback: Simple refined circle
        return (
          <Svg width={120} height={120} viewBox="0 0 120 120">
            <Circle
              cx="60"
              cy="60"
              r="50"
              stroke={colors.gold}
              strokeWidth="2"
              fill="none"
              opacity={0.4}
            />
            <AnimatedCircle
              cx="60"
              cy="60"
              r="30"
              stroke={colors.gold}
              strokeWidth="2.5"
              fill="none"
              opacity={sparkleOpacity}
            />
          </Svg>
        );
    }
  };

  const generateControlNetVariations = async () => {
    console.log('[AIGenerating] generateControlNetVariations called', { isGenerating, user: user?.id });

    if (isGenerating) {
      console.log('[AIGenerating] Already generating, skipping');
      return;
    }

    // Use fallback userId for development if user is not authenticated
    const userId = user?.id || `dev-user-${Date.now()}`;
    console.log('[AIGenerating] Using userId:', userId);

    setIsGenerating(true);
    let progressInterval: ReturnType<typeof setInterval> | null = null;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('[AIGenerating] Request timed out after 120 seconds');
      controller.abort();
    }, 120000); // 120 second timeout

    try {
      console.log('[AIGenerating] Starting API call to:', `${API_URL}/api/ai/enhance-controlnet`);
      logger.info('[AIGenerating] Starting ControlNet generation', {
        style: styleChoice,
        userId,
        apiUrl: API_URL,
      });

      // Simulate progress (~30 seconds for 4 parallel images with Google Vertex AI)
      // Falls back to ~40-60s with Replicate if Google unavailable
      progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 95) {
            if (progressInterval) clearInterval(progressInterval);
            return 95; // Hold at 95% until API completes
          }
          return prev + 3.5; // Pace for ~27 seconds to 95% (3.5% per 800ms)
        });
      }, 800); // Update every 800ms

      // Use reinforced SVG if available, otherwise use base structure
      const sigilToEnhance = reinforcedSigilSvg || baseSigilSvg;
      console.log('[AIGenerating] SVG to enhance length:', sigilToEnhance?.length || 0);

      // Call ControlNet enhancement API with timeout
      const response = await fetch(`${API_URL}/api/ai/enhance-controlnet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sigilSvg: sigilToEnhance,
          styleChoice,
          userId,
          anchorId: `temp-${Date.now()}`, // Temporary ID for uploads
        }),
        signal: controller.signal, // Attach abort signal for timeout
      });

      console.log('[AIGenerating] Response received:', response.status, response.statusText);
      if (progressInterval) clearInterval(progressInterval);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'ControlNet enhancement failed');
      }

      const result = await response.json();

      logger.info('[AIGenerating] ControlNet generation complete', {
        variations: result.variations?.length,
        style: result.styleApplied,
      });

      // Complete progress
      setProgress(100);

      // Navigate to variation picker
      setTimeout(() => {
        navigation.replace('EnhancedVersionPicker', {
          intentionText,
          category,
          distilledLetters,
          baseSigilSvg,
          reinforcedSigilSvg,
          structureVariant,
          styleChoice,
          variations: result.variations, // Array of 4 image URLs
          reinforcementMetadata,
          prompt: result.prompt || '', // Pass the enhanced prompt for display
        });
      }, 500);
    } catch (error) {
      // Clear timers on error
      if (progressInterval) clearInterval(progressInterval);
      clearTimeout(timeoutId);
      setProgress(0);
      setIsGenerating(false);

      // Determine error message
      let errorMessage = 'Failed to enhance sigil. Please try again.';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'Generation timed out. The AI is taking too long. Please try again.';
        } else if (error.message.includes('Network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }

      logger.error('[AIGenerating] ControlNet generation error', error);

      Alert.alert(
        'Enhancement Failed',
        errorMessage,
        [
          {
            text: 'Try Again',
            onPress: () => {
              generateControlNetVariations();
            },
          },
          {
            text: 'Go Back',
            style: 'cancel',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    }
  };

  useEffect(() => {
    // Entrance animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Continuous pulse animation for center icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Style-specific rotation for outer circle
    const getRotationDuration = () => {
      switch (styleChoice) {
        case 'minimal_line':
          return 6000; // Slower, more deliberate
        case 'ink_brush':
          return 10000; // Organic, flowing
        case 'sacred_geometry':
          return 12000; // Precise, measured
        case 'watercolor':
          return 15000; // Gentle, diffused
        case 'gold_leaf':
          return 20000; // Majestic, slow
        case 'cosmic':
          return 8000; // Continuous orbital
        default:
          return 8000;
      }
    };

    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: getRotationDuration(),
        useNativeDriver: true,
      })
    ).start();

    // Sparkle animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(sparkleAnim, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(sparkleAnim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Orb animations (optimized for both platforms)
    Animated.loop(
      Animated.sequence([
        Animated.timing(orb1Anim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(orb1Anim, {
          toValue: 0,
          duration: 4000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(orb2Anim, {
          toValue: 1,
          duration: 5000,
          useNativeDriver: true,
        }),
        Animated.timing(orb2Anim, {
          toValue: 0,
          duration: 5000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Start ControlNet generation
    generateControlNetVariations();
  }, []);

  // Style-specific rotation interpolation
  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange:
      styleChoice === 'minimal_line'
        ? ['0deg', '360deg'] // Will apply snapping via discrete steps
        : ['0deg', '360deg'],
  });

  // For minimal_line, create snapping alignment effect
  const getRotationTransform = () => {
    if (styleChoice === 'minimal_line') {
      // Create 12 snapping points (every 30 degrees)
      const snappedRotation = rotateAnim.interpolate({
        inputRange: [
          0, 0.083, 0.166, 0.25, 0.333, 0.416, 0.5, 0.583, 0.666, 0.75, 0.833, 0.916, 1,
        ],
        outputRange: [
          '0deg',
          '30deg',
          '60deg',
          '90deg',
          '120deg',
          '150deg',
          '180deg',
          '210deg',
          '240deg',
          '270deg',
          '300deg',
          '330deg',
          '360deg',
        ],
      });
      return [{ rotate: snappedRotation }];
    }
    return [{ rotate: rotation }];
  };

  const sparkleOpacity = sparkleAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 1, 0.3],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.8],
  });

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Animated Background */}
      <LinearGradient
        colors={[colors.navy, colors.deepPurple, colors.charcoal, colors.navy]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Floating Orbs - Optimized for both platforms */}
      <Animated.View
        style={[
          styles.orb,
          styles.orb1,
          {
            opacity: orb1Anim.interpolate({
              inputRange: [0, 1],
              outputRange: IS_ANDROID ? [0.06, 0.10] : [0.1, 0.15],
            }),
            transform: [
              {
                translateY: orb1Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -30],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orb2,
          {
            opacity: orb2Anim.interpolate({
              inputRange: [0, 1],
              outputRange: IS_ANDROID ? [0.05, 0.08] : [0.08, 0.12],
            }),
            transform: [
              {
                translateX: orb2Anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 20],
                }),
              },
            ],
          },
        ]}
      />

      {/* Main Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Center Icon with Animations */}
        <View style={styles.iconContainer}>
          {/* Outer glow */}
          <Animated.View
            style={[
              styles.glowRing,
              {
                opacity: glowOpacity,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />

          {/* Rotating outer circle with style-specific animation */}
          <Animated.View style={{ transform: getRotationTransform() }}>
            <Svg width={200} height={200} viewBox="0 0 200 200">
              {/* Dashed outer circle */}
              <Circle
                cx="100"
                cy="100"
                r="90"
                stroke={colors.gold}
                strokeWidth="2"
                strokeDasharray="8,8"
                fill="none"
                opacity={0.3}
              />
            </Svg>
          </Animated.View>

          {/* Refinement Seal - Style-responsive center visual */}
          <Animated.View
            style={[
              styles.centerIcon,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            {IS_ANDROID ? (
              <View style={[styles.centerCircle, styles.centerCircleAndroid]}>
                {renderRefinementSeal()}
              </View>
            ) : (
              <BlurView intensity={15} tint="dark" style={styles.centerCircle}>
                {renderRefinementSeal()}
              </BlurView>
            )}
          </Animated.View>
        </View>

        {/* Loading Text */}
        <View style={styles.loadingTextContainer}>
          <Animated.Text
            style={[
              styles.loadingTextPrimary,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            Refining your Anchor…
          </Animated.Text>
          <Animated.Text
            style={[
              styles.loadingTextSecondary,
              {
                opacity: fadeAnim,
              },
            ]}
          >
            {refinementPhrase}
          </Animated.Text>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progress}%`, opacity: 0.4 },
              ]}
            />
          </View>
          <Text style={styles.progressPhaseText}>{getProgressPhase()}</Text>
        </View>

        {/* Intention Card */}
        <View style={styles.intentionContainer}>
          {IS_ANDROID ? (
            <View style={[styles.intentionCard, styles.intentionCardAndroid]}>
              <Text style={styles.intentionLabel}>MANIFESTING</Text>
              <Text style={styles.intentionText}>"{intentionText}"</Text>
              <View style={styles.intentionBorder} />
            </View>
          ) : (
            <BlurView intensity={12} tint="dark" style={styles.intentionCard}>
              <Text style={styles.intentionLabel}>MANIFESTING</Text>
              <Text style={styles.intentionText}>"{intentionText}"</Text>
              <View style={styles.intentionBorder} />
            </BlurView>
          )}
        </View>

        {/* Time Estimate */}
        <View style={styles.timeEstimate}>
          <Animated.View
            style={[
              styles.timeIcon,
              {
                opacity: sparkleOpacity,
              },
            ]}
          >
            <Text style={styles.timeIconText}>⏱</Text>
          </Animated.View>
          <Text style={styles.timeText}>This usually takes about 30 seconds</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  orb: {
    position: 'absolute',
    borderRadius: 300,
    backgroundColor: colors.gold,
  },
  orb1: {
    width: 300,
    height: 300,
    top: -100,
    right: -100,
  },
  orb2: {
    width: 250,
    height: 250,
    bottom: -80,
    left: -80,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48,
  },
  glowRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    elevation: 20,
  },
  centerIcon: {
    position: 'absolute',
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 29, 0.6)',
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  centerCircleAndroid: {
    backgroundColor: 'rgba(26, 26, 29, 0.9)',
  },
  loadingTextContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  loadingTextPrimary: {
    fontSize: 22,
    fontWeight: '500',
    color: colors.bone,
    marginBottom: 12,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  loadingTextSecondary: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.gold,
    letterSpacing: 0.3,
    textAlign: 'center',
    opacity: 0.8,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 40,
  },
  progressBarBg: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(26, 26, 29, 0.5)',
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 0,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 1.5,
    backgroundColor: colors.gold,
  },
  progressPhaseText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.silver,
    textAlign: 'center',
    letterSpacing: 1.2,
    marginTop: 8,
    opacity: 0.7,
  },
  intentionContainer: {
    width: '100%',
    marginBottom: 24,
  },
  intentionCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
    backgroundColor: 'rgba(26, 26, 29, 0.5)',
    position: 'relative',
  },
  intentionCardAndroid: {
    backgroundColor: 'rgba(26, 26, 29, 0.9)',
  },
  intentionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 1.5,
    marginBottom: 8,
    opacity: 0.7,
  },
  intentionText: {
    fontSize: 17,
    fontStyle: 'italic',
    color: colors.bone,
    lineHeight: 24,
  },
  intentionBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.gold,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  timeEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(62, 44, 91, 0.3)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  timeIcon: {
    marginRight: 10,
  },
  timeIconText: {
    fontSize: 20,
  },
  timeText: {
    fontSize: 13,
    color: colors.silver,
    fontStyle: 'italic',
  },
});
