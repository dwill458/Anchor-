import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing } from '@/theme';
import { RootStackParamList } from '@/types';
import { useAnchorStore } from '@/stores/anchorStore';
import { post } from '@/services/ApiClient';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';
import { CheckCircle2 } from 'lucide-react-native';

type BurningRitualRouteProp = RouteProp<RootStackParamList, 'BurningRitual'>;
type BurningRitualNavigationProp = StackNavigationProp<RootStackParamList, 'BurningRitual'>;

const { width, height } = Dimensions.get('window');
const SIGIL_SIZE = width * 0.6;
const BURN_DURATION = 5000; // 5 seconds for the burn

export const BurningRitualScreen: React.FC = () => {
  const route = useRoute<BurningRitualRouteProp>();
  const navigation = useNavigation<BurningRitualNavigationProp>();

  const { anchorId, sigilSvg } = route.params;
  const { removeAnchor } = useAnchorStore();

  const [phase, setPhase] = useState<'burning' | 'completed'>('burning');
  const [error, setError] = useState<string | null>(null);

  // Animation values
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const completionOpacity = useSharedValue(0);

  // Prevent back button during ritual
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      return phase === 'burning'; // Block if burning
    });
    return () => backHandler.remove();
  }, [phase]);

  useEffect(() => {
    startRitual();
  }, []);

  const startRitual = async () => {
    // Phase 1: Animation Start
    glowOpacity.value = withTiming(0.4, { duration: 2000 });

    // Phase 2: Sigil Dissolving
    opacity.value = withTiming(0, {
      duration: BURN_DURATION,
      easing: Easing.bezier(0.4, 0, 0.2, 1)
    });

    scale.value = withTiming(0.7, {
      duration: BURN_DURATION,
      easing: Easing.bezier(0.4, 0, 0.2, 1)
    });

    // Subtle rhythmic haptics during the burn
    const hapticInterval = setInterval(() => {
      if (opacity.value > 0.1) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else {
        clearInterval(hapticInterval);
      }
    }, 600);

    // Phase 3: API Call and Completion
    try {
      // Simulate/Trigger API call in parallel
      await post(`/api/anchors/${anchorId}/burn`);

      // Update local store
      removeAnchor(anchorId);

      // Wait for animation to finish
      setTimeout(() => {
        clearInterval(hapticInterval);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Transition to completion phase
        setPhase('completed');
        completionOpacity.value = withTiming(1, { duration: 1000 });
        glowOpacity.value = withTiming(0, { duration: 1000 });

        AnalyticsService.track(AnalyticsEvents.BURN_COMPLETED, { anchor_id: anchorId });
      }, BURN_DURATION + 500);

    } catch (err) {
      console.error('Burn API Error:', err);
      setError('The ritual was interrupted by a connection error. Your intention remains in the sanctuary.');
      ErrorTrackingService.captureException(err as Error, { anchorId });

      // Still allow them to see the end or go back? 
      // For ritual seriousness, we might want to just show an error after the animation fails.
    }
  };

  const sigilStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const completionStyle = useAnimatedStyle(() => ({
    opacity: completionOpacity.value,
    transform: [{ translateY: interpolate(completionOpacity.value, [0, 1], [20, 0]) }],
  }));

  const handleFinish = () => {
    navigation.navigate('Vault');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {phase === 'burning' ? (
          <View style={styles.ritualContainer}>
            <Animated.View style={[styles.glow, glowStyle]} />

            <Animated.View style={[styles.sigilWrapper, sigilStyle]}>
              <SvgXml xml={sigilSvg} width={SIGIL_SIZE} height={SIGIL_SIZE} />
            </Animated.View>

            <View style={styles.mantraContainer}>
              <Text style={styles.mantraText}>Releasing into the void...</Text>
            </View>

            {/* Minimalist "embers" effect (abstract) */}
            <View style={styles.emberContainer}>
              {[...Array(6)].map((_, i) => (
                <Ember key={i} delay={i * 400} />
              ))}
            </View>
          </View>
        ) : (
          <Animated.View style={[styles.completionContainer, completionStyle]}>
            <View style={styles.successIconWrapper}>
              <CheckCircle2 color={colors.gold} size={64} />
            </View>

            <Text style={styles.completionTitle}>Release Complete</Text>
            <Text style={styles.completionSubtitle}>
              Your anchor has been returned to the universal flow. Your sanctuary is now clear.
            </Text>

            <TouchableOpacity
              style={styles.finishButton}
              onPress={handleFinish}
              activeOpacity={0.8}
            >
              <Text style={styles.finishButtonText}>RETURN TO SANCTUARY</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {error && (
          <View style={styles.errorOverlay}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Vault')} style={styles.errorButton}>
              <Text style={styles.errorButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const Ember: React.FC<{ delay: number }> = ({ delay }) => {
  const y = useSharedValue(0);
  const o = useSharedValue(0);
  const x = useSharedValue(Math.random() * 40 - 20);

  useEffect(() => {
    const cycle = () => {
      y.value = 0;
      o.value = 0;
      x.value = Math.random() * 60 - 30;

      o.value = withSequence(
        withTiming(0.6, { duration: 1000 }),
        withTiming(0, { duration: 2000 })
      );

      y.value = withTiming(-150, {
        duration: 3000,
        easing: Easing.out(Easing.quad)
      }, (finished) => {
        if (finished) runOnJS(cycle)();
      });
    };

    const timeout = setTimeout(cycle, delay);
    return () => clearTimeout(timeout);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [
      { translateY: y.value },
      { translateX: x.value }
    ],
  }));

  return <Animated.View style={[styles.ember, animatedStyle]} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ritualContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  glow: {
    position: 'absolute',
    width: SIGIL_SIZE * 1.5,
    height: SIGIL_SIZE * 1.5,
    borderRadius: SIGIL_SIZE,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 50,
  },
  sigilWrapper: {
    zIndex: 2,
  },
  mantraContainer: {
    marginTop: 60,
  },
  mantraText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.gold,
    letterSpacing: 3,
    textTransform: 'uppercase',
    opacity: 0.6,
  },
  emberContainer: {
    position: 'absolute',
    bottom: height * 0.4,
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ember: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gold,
  },
  completionContainer: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  successIconWrapper: {
    marginBottom: spacing.xl,
    opacity: 0.8,
  },
  completionTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h2,
    color: colors.gold,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  completionSubtitle: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: spacing.xxxl,
    paddingHorizontal: spacing.lg,
  },
  finishButton: {
    backgroundColor: 'transparent',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  finishButtonText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.button,
    color: colors.gold,
    fontWeight: '700',
    letterSpacing: 2,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 20, 25, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    zIndex: 10,
  },
  errorText: {
    color: colors.text.primary,
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  errorButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.card,
    borderRadius: 8,
  },
  errorButtonText: {
    color: colors.gold,
    fontWeight: '700',
  },
});
