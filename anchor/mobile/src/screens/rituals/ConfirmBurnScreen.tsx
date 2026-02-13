/**
 * Anchor App - Burn & Release Ceremony Screen
 *
 * 3-step ritual flow: Reflect → Confirm → Release
 * Premium glassmorphic design, Zen Architect theme.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Platform,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { colors, typography, spacing } from '@/theme';
import { RootStackParamList } from '@/types';
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';
import { ErrorTrackingService } from '@/services/ErrorTrackingService';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { PremiumAnchorGlow } from '@/components/common';
import { safeHaptics } from '@/utils/haptics';
import { RitualRail, RitualRailStep } from './components/RitualRail';
import { ConfirmModal } from './components/ConfirmModal';
import { ReleaseInput } from './components/ReleaseInput';

type ConfirmBurnRouteProp = RouteProp<RootStackParamList, 'ConfirmBurn'>;
type ConfirmBurnNavigationProp = StackNavigationProp<RootStackParamList, 'ConfirmBurn'>;

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ANCHOR_SIZE = width * 0.42;
const IS_SMALL_DEVICE = SCREEN_HEIGHT < 700;

type BurnStep = 'reflect' | 'confirm' | 'release';

export const ConfirmBurnScreen: React.FC = () => {
  const route = useRoute<ConfirmBurnRouteProp>();
  const navigation = useNavigation<ConfirmBurnNavigationProp>();
  const { anchorId, intention, sigilSvg, enhancedImageUrl } = route.params;

  const reducedMotion = useReducedMotion();

  // ── Step state ──
  const [currentStep, setCurrentStep] = useState<BurnStep>('reflect');
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [releaseText, setReleaseText] = useState('');

  const isStep2Enabled = isComplete;
  const isStep3Enabled = releaseText === 'RELEASE';

  // ── Animation values ──
  const screenOpacity = useSharedValue(0);
  const floatY = useSharedValue(0);
  const stepOpacity = useSharedValue(1);

  // ── Entrance animation ──
  useEffect(() => {
    screenOpacity.value = withTiming(1, { duration: 800 });

    if (!reducedMotion) {
      floatY.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 2500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      );
    }
  }, []);

  const screenStyle = useAnimatedStyle(() => ({ opacity: screenOpacity.value }));
  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: floatY.value }] }));
  const stepStyle = useAnimatedStyle(() => ({ opacity: stepOpacity.value }));

  // ── Step transition ──
  const pendingStepRef = useRef<BurnStep | null>(null);

  const transitionToStep = (nextStep: BurnStep) => {
    if (reducedMotion) {
      setCurrentStep(nextStep);
      return;
    }
    pendingStepRef.current = nextStep;
    stepOpacity.value = withTiming(0, { duration: 150 });
    setTimeout(() => {
      if (pendingStepRef.current) {
        setCurrentStep(pendingStepRef.current);
        pendingStepRef.current = null;
      }
      stepOpacity.value = withTiming(1, { duration: 200 });
    }, 160);
  };

  // ── Handlers ──
  const handleBeginRelease = () => {
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    setConfirmModalVisible(true);
  };

  const handleModalContinue = () => {
    setConfirmModalVisible(false);
    transitionToStep('confirm');
  };

  const handleModalDismiss = () => {
    setConfirmModalVisible(false);
  };

  const handleCheckboxToggle = () => {
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    setIsComplete(prev => !prev);
  };

  const handleAdvanceToRelease = () => {
    if (!isStep2Enabled) return;
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    transitionToStep('release');
  };

  const handleFinalBurn = () => {
    if (!isStep3Enabled) return;
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);

    AnalyticsService.track(AnalyticsEvents.BURN_INITIATED, {
      anchor_id: anchorId,
      source: 'confirm_burn_screen',
    });

    ErrorTrackingService.addBreadcrumb('User confirmed release ritual', 'navigation', {
      anchor_id: anchorId,
    });

    navigation.navigate('BurningRitual', {
      anchorId,
      intention,
      sigilSvg,
      enhancedImageUrl,
    } as any);
  };

  // ── CTA config per step ──
  const ctaLabel = currentStep === 'reflect'
    ? 'Begin Release'
    : currentStep === 'confirm'
    ? 'Continue'
    : 'Burn Now';

  const ctaDisabled = currentStep === 'confirm'
    ? !isStep2Enabled
    : currentStep === 'release'
    ? !isStep3Enabled
    : false;

  const handleCta = currentStep === 'reflect'
    ? handleBeginRelease
    : currentStep === 'confirm'
    ? handleAdvanceToRelease
    : handleFinalBurn;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Ritual progress rail */}
      <RitualRail currentStep={currentStep as RitualRailStep} />

      {/* Main content — offset left to clear the rail */}
      <Animated.View style={[styles.content, screenStyle]}>
        <Animated.View style={[styles.stepContent, stepStyle]}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            {currentStep === 'reflect' && renderReflectStep()}
            {currentStep === 'confirm' && renderConfirmStep()}
            {currentStep === 'release' && renderReleaseStep()}
          </ScrollView>
        </Animated.View>

        {/* Sticky CTA */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, ctaDisabled && styles.primaryButtonDisabled]}
            onPress={handleCta}
            disabled={ctaDisabled}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={ctaLabel}
            accessibilityState={{ disabled: ctaDisabled }}
          >
            <Text style={styles.primaryButtonText}>{ctaLabel}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Confirm modal */}
      <ConfirmModal
        visible={confirmModalVisible}
        title="Burn & Release"
        body="This closes the loop. You won't be able to reactivate this anchor after release."
        primaryCtaLabel="Continue"
        secondaryCtaLabel="Not yet"
        onPrimary={handleModalContinue}
        onSecondary={handleModalDismiss}
      />
    </SafeAreaView>
  );

  // ── Step render functions ──

  function renderReflectStep() {
    return (
      <View style={styles.reflectContainer}>
        <Text style={styles.stepChip}>Reflect</Text>
        <Text style={styles.completedLabel}>Completed intention</Text>

        {/* Sigil with glow + float animation */}
        <Animated.View style={[styles.sigilOuter, floatStyle]}>
          <View style={styles.glowWrapper}>
            <PremiumAnchorGlow
              size={ANCHOR_SIZE}
              state="active"
              variant="ritual"
              reduceMotionEnabled={reducedMotion ?? false}
            />
          </View>
          <View style={styles.sigilInner}>
            {enhancedImageUrl ? (
              <OptimizedImage
                uri={enhancedImageUrl}
                style={[styles.enhancedImage, { width: ANCHOR_SIZE, height: ANCHOR_SIZE }]}
                resizeMode="cover"
              />
            ) : (
              <SvgXml xml={sigilSvg} width={ANCHOR_SIZE} height={ANCHOR_SIZE} />
            )}
          </View>
        </Animated.View>

        {/* No quotation marks around intention */}
        <Text style={styles.intentionText}>{intention}</Text>
      </View>
    );
  }

  function renderConfirmStep() {
    return (
      <View style={styles.confirmContainer}>
        <View style={styles.cardContainer}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={20} tint="dark" style={styles.glassCard}>
              {renderWhyReleaseContent()}
            </BlurView>
          ) : (
            <View style={[styles.glassCard, styles.androidCard]}>
              {renderWhyReleaseContent()}
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={handleCheckboxToggle}
          activeOpacity={0.8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isComplete }}
          accessibilityLabel="This anchor is complete"
        >
          <View style={[styles.checkbox, isComplete && styles.checkboxChecked]}>
            {isComplete && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkboxLabel}>This anchor is complete</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function renderWhyReleaseContent() {
    return (
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle}>Why release?</Text>
        <Text style={styles.cardBody}>
          Releasing an anchor marks it complete and closed. What you set in motion has
          run its course — let it go so new intentions can take root.
        </Text>
      </View>
    );
  }

  function renderReleaseStep() {
    return (
      <View style={styles.releaseContainer}>
        <Text style={styles.releaseTitle}>Final Confirmation</Text>
        <ReleaseInput
          value={releaseText}
          onChangeText={setReleaseText}
          autoFocus={true}
        />
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  content: {
    flex: 1,
    paddingLeft: 64,
    paddingRight: spacing.xl,
  },
  stepContent: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    flexGrow: 1,
  },

  // ── Reflect step ──
  reflectContainer: {
    alignItems: 'center',
    flex: 1,
  },
  stepChip: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.caption,
    color: colors.gold,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    opacity: 0.8,
  },
  completedLabel: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.md,
    opacity: 0.7,
  },
  sigilOuter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: IS_SMALL_DEVICE ? spacing.md : spacing.xl,
    width: ANCHOR_SIZE * 1.6,
    height: ANCHOR_SIZE * 1.6,
  },
  glowWrapper: {
    position: 'absolute',
    width: ANCHOR_SIZE * 1.6,
    height: ANCHOR_SIZE * 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigilInner: {
    width: ANCHOR_SIZE,
    height: ANCHOR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  enhancedImage: {
    borderRadius: ANCHOR_SIZE / 2,
    borderWidth: 1,
    borderColor: colors.ritual.border,
  },
  intentionText: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.text.secondary,
    textAlign: 'center',
    opacity: 0.85,
    lineHeight: 24,
    paddingHorizontal: spacing.md,
  },

  // ── Confirm step ──
  confirmContainer: {
    flex: 1,
    paddingTop: spacing.md,
  },
  cardContainer: {
    width: '100%',
    marginBottom: spacing.xl,
    borderRadius: 20,
    overflow: 'hidden',
  },
  glassCard: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: colors.ritual.glass,
  },
  androidCard: {
    backgroundColor: colors.ritual.glassStrong,
  },
  cardContent: {
    padding: spacing.xl,
  },
  cardTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h3,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  cardBody: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.primary,
    lineHeight: 22,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.ritual.border,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  checkmark: {
    fontSize: 13,
    color: colors.background.primary,
    fontWeight: '700',
    lineHeight: 15,
  },
  checkboxLabel: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body1,
    color: colors.text.primary,
    flex: 1,
  },

  // ── Release step ──
  releaseContainer: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  releaseTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h3,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.xl,
    letterSpacing: 0.5,
  },

  // ── CTA ──
  buttonContainer: {
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.lg,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryButtonDisabled: {
    opacity: 0.38,
    shadowOpacity: 0,
    elevation: 0,
  },
  primaryButtonText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: typography.sizes.button,
    color: colors.background.primary,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
