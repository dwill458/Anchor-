import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import Svg, { Circle, G, Path } from 'react-native-svg';
import { mockGenerateVariations, GenerationResult } from '@/services/MockAIService';

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

interface AIGeneratingScreenProps {
  navigation: any;
  route: any;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);

export default function AIGeneratingScreen({
  navigation,
  route,
}: AIGeneratingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [currentPhrase, setCurrentPhrase] = useState(0);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;

  const intention = route.params?.intention || 'I am confident and capable';

  // Mystical loading phrases
  const loadingPhrases = [
    'Channeling creative energies...',
    'Consulting the ancient symbols...',
    'Weaving mystical patterns...',
    'Infusing sacred geometry...',
    'Manifesting your vision...',
    'Aligning cosmic forces...',
  ];

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

    // Continuous rotation for outer circle
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 8000,
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

    // Start generation
    const generate = async () => {
      try {
        const result = await mockGenerateVariations();
        setGenerationResult(result);
      } catch (error) {
        console.error('Generation failed:', error);
        // Fallback result to prevent getting stuck
        setGenerationResult({
          prompt: 'Fallback',
          variations: [
            'https://via.placeholder.com/400x400.png?text=Error',
            'https://via.placeholder.com/400x400.png?text=Error',
            'https://via.placeholder.com/400x400.png?text=Error',
            'https://via.placeholder.com/400x400.png?text=Error',
          ],
        });
      }
    };
    generate();

    // Simulate progress
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        // If we have result, finish fast
        if (generationResult && prev < 100) {
          return prev + 5;
        }

        // If not ready, slow down at 90%
        if (!generationResult && prev >= 90) {
          return prev;
        }

        // Complete
        if (prev >= 100) {
          clearInterval(progressInterval);
          // Navigate to next screen after completion
          // Ensure we have result before navigating
          if (generationResult) {
            setTimeout(() => {
              navigation.replace('AIVariationPicker', {
                ...route.params,
                ...generationResult
              });
            }, 500);
          }
          return 100;
        }
        return prev + 1;
      });
    }, 100);

    // Rotate loading phrases
    const phraseInterval = setInterval(() => {
      setCurrentPhrase((prev) => (prev + 1) % loadingPhrases.length);
    }, 2500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(phraseInterval);
    };
  }, [generationResult]); // Re-run effect when result comes in to speed up progress



  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

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

          {/* Rotating outer circle */}
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
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
                opacity={0.4}
              />
            </Svg>
          </Animated.View>

          {/* Center solid circle with stars */}
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
                <Svg width={120} height={120} viewBox="0 0 120 120">
                  {/* Inner circle */}
                  <Circle
                    cx="60"
                    cy="60"
                    r="50"
                    stroke={colors.gold}
                    strokeWidth="3"
                    fill="none"
                  />
                  {/* Stars */}
                  <AnimatedG opacity={sparkleOpacity}>
                    {/* Large star */}
                    <Path
                      d="M 60 25 L 64 44 L 83 44 L 68 55 L 73 74 L 60 63 L 47 74 L 52 55 L 37 44 L 56 44 Z"
                      fill={colors.gold}
                    />
                    {/* Small star 1 */}
                    <Path
                      d="M 75 40 L 77 45 L 82 45 L 78 48 L 80 53 L 75 50 L 70 53 L 72 48 L 68 45 L 73 45 Z"
                      fill={colors.gold}
                    />
                    {/* Small star 2 */}
                    <Path
                      d="M 45 40 L 47 45 L 52 45 L 48 48 L 50 53 L 45 50 L 40 53 L 42 48 L 38 45 L 43 45 Z"
                      fill={colors.gold}
                    />
                  </AnimatedG>
                </Svg>
              </View>
            ) : (
              <BlurView intensity={15} tint="dark" style={styles.centerCircle}>
                <Svg width={120} height={120} viewBox="0 0 120 120">
                  <Circle
                    cx="60"
                    cy="60"
                    r="50"
                    stroke={colors.gold}
                    strokeWidth="3"
                    fill="none"
                  />
                  <AnimatedG opacity={sparkleOpacity}>
                    <Path
                      d="M 60 25 L 64 44 L 83 44 L 68 55 L 73 74 L 60 63 L 47 74 L 52 55 L 37 44 L 56 44 Z"
                      fill={colors.gold}
                    />
                    <Path
                      d="M 75 40 L 77 45 L 82 45 L 78 48 L 80 53 L 75 50 L 70 53 L 72 48 L 68 45 L 73 45 Z"
                      fill={colors.gold}
                    />
                    <Path
                      d="M 45 40 L 47 45 L 52 45 L 48 48 L 50 53 L 45 50 L 40 53 L 42 48 L 38 45 L 43 45 Z"
                      fill={colors.gold}
                    />
                  </AnimatedG>
                </Svg>
              </BlurView>
            )}
          </Animated.View>
        </View>

        {/* Loading Text */}
        <Animated.Text
          style={[
            styles.loadingText,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          {loadingPhrases[currentPhrase]}
        </Animated.Text>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <LinearGradient
              colors={[colors.gold, colors.bronze, colors.gold]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressBarFill, { width: `${progress}%` }]}
            />
          </View>
          <Text style={styles.progressText}>{progress}%</Text>
        </View>

        {/* Intention Card */}
        <View style={styles.intentionContainer}>
          {IS_ANDROID ? (
            <View style={[styles.intentionCard, styles.intentionCardAndroid]}>
              <Text style={styles.intentionLabel}>MANIFESTING</Text>
              <Text style={styles.intentionText}>"{intention}"</Text>
              <View style={styles.intentionBorder} />
            </View>
          ) : (
            <BlurView intensity={12} tint="dark" style={styles.intentionCard}>
              <Text style={styles.intentionLabel}>MANIFESTING</Text>
              <Text style={styles.intentionText}>"{intention}"</Text>
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
          <Text style={styles.timeText}>This usually takes 40-80 seconds</Text>
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
  loadingText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gold,
    marginBottom: 32,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    marginBottom: 40,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    backgroundColor: 'rgba(26, 26, 29, 0.8)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.bone,
    textAlign: 'center',
    letterSpacing: 1,
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
