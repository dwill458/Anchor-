/**
 * Anchor App - Charge Setup Screen (Refactored)
 *
 * Premium meditation ritual entry point with two-step flow.
 * Orchestrates: Mode Selection → Duration Selection → Breathing Animation → Ritual
 *
 * Features:
 * - First-time vs returning user detection
 * - Saved default preferences for returning users
 * - Two-step mode → duration selection flow
 * - Custom duration support via TimerPicker
 * - 3-second breathing animation before ritual
 * - Auto-save selections as new defaults
 * - Glassmorphic Zen Architect design
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  BackHandler,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { SigilSvg } from '@/components/common';
import { InfoIcon } from '@/components/icons/InfoIcon';
import { ModeSelectionStep } from './components/ModeSelectionStep';
import { DurationSelectionStep } from './components/DurationSelectionStep';
import { DefaultChargeDisplay } from './components/DefaultChargeDisplay';
import { safeHaptics } from '@/utils/haptics';

const { width } = Dimensions.get('window');

type ChargeSetupRouteProp = RouteProp<RootStackParamList, 'ChargeSetup'>;
type ChargeSetupNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ChargeSetup'
>;

type Step = 'default' | 'mode' | 'duration';

export const ChargeSetupScreen: React.FC = () => {
  const navigation = useNavigation<ChargeSetupNavigationProp>();
  const route = useRoute<ChargeSetupRouteProp>();
  const { anchorId } = route.params;

  // ══════════════════════════════════════════════════════════════
  // STORES
  // ══════════════════════════════════════════════════════════════

  const { getAnchorById } = useAnchorStore();
  const { anchorCount } = useAuthStore();
  const {
    defaultChargeMode,
    defaultChargeDuration,
    setDefaultChargeMode,
    setDefaultChargeDuration,
  } = useSettingsStore();

  const anchor = getAnchorById(anchorId);

  // ══════════════════════════════════════════════════════════════
  // STATE
  // ══════════════════════════════════════════════════════════════

  const [currentStep, setCurrentStep] = useState<Step>('default');
  const [selectedMode, setSelectedMode] = useState<'focus' | 'ritual' | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [isFirstTime, setIsFirstTime] = useState(true);
  const [infoSheetVisible, setInfoSheetVisible] = useState(false);
  const isNavigatingRef = useRef(false);

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // ══════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    // Determine if user is first-time or returning
    const firstTime = anchorCount === 0;
    setIsFirstTime(firstTime);

    // Set initial step based on user type
    if (firstTime) {
      setCurrentStep('mode');
    } else {
      setCurrentStep('default');
      // Pre-populate selections from defaults
      setSelectedMode(defaultChargeMode);
      setSelectedDuration(defaultChargeDuration);
    }
  }, [anchorCount, defaultChargeMode, defaultChargeDuration]);

  // Subtle idle pulse animation for symbol
  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => pulseLoop.stop();
  }, []);

  // ══════════════════════════════════════════════════════════════
  // ANDROID BACK BUTTON HANDLING
  // ══════════════════════════════════════════════════════════════

  useFocusEffect(
    useCallback(() => {
      isNavigatingRef.current = false;
      const onBackPress = () => {
        if (currentStep === 'duration') {
          // Go back to mode selection
          setCurrentStep('mode');
          setSelectedDuration(null);
          return true; // Handled
        } else if (currentStep === 'mode' && !isFirstTime) {
          // Go back to default display for returning users
          setCurrentStep('default');
          setSelectedMode(defaultChargeMode);
          setSelectedDuration(defaultChargeDuration);
          return true; // Handled
        }
        // Let default behavior (back in nav stack) handle it
        return false;
      };

      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [currentStep, isFirstTime, defaultChargeMode, defaultChargeDuration])
  );

  // ══════════════════════════════════════════════════════════════
  // STEP HANDLERS
  // ══════════════════════════════════════════════════════════════

  const handleSelectMode = (mode: 'focus' | 'ritual') => {
    setSelectedMode(mode);
    // Animate transition to duration step
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setCurrentStep('duration');
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  };

  const handleSelectDuration = (durationSeconds: number) => {
    setSelectedDuration(durationSeconds);
  };

  const handleContinueFromDefault = () => {
    // Returning user continuing with default
    navigateToBreathing();
  };

  const handleChangeDefault = () => {
    // Returning user wants to change their default
    setSelectedMode(null);
    setSelectedDuration(null);
    setCurrentStep('mode');
  };

  const handleContinueFromDuration = () => {
    // First-time or user who changed their selection
    if (selectedMode && selectedDuration) {
      navigateToBreathing();
    }
  };

  // ══════════════════════════════════════════════════════════════
  // NAVIGATION HANDLERS
  // ══════════════════════════════════════════════════════════════

  const navigateToBreathing = () => {
    if (!selectedMode || !selectedDuration) return;
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    // Save selection as default for next time
    if (selectedMode !== defaultChargeMode || selectedDuration !== defaultChargeDuration) {
      setDefaultChargeMode(selectedMode);
      setDefaultChargeDuration(selectedDuration);
    }

    // Navigate to breathing animation with serializable params
    navigation.navigate('BreathingAnimation', {
      source: 'charge',
      anchorId,
      mode: selectedMode,
      duration: selectedDuration,
    });
  };

  const navigateToRitual = () => {
    if (!selectedMode || !selectedDuration) return;

    navigation.navigate('Ritual', {
      anchorId,
      ritualType: selectedMode,
      durationSeconds: selectedDuration,
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const openInfoSheet = () => {
    void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);
    setInfoSheetVisible(true);
  };

  const closeInfoSheet = () => {
    setInfoSheetVisible(false);
  };

  // ══════════════════════════════════════════════════════════════
  // ERROR HANDLING: NULL SAFETY
  // ══════════════════════════════════════════════════════════════

  if (!anchor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Anchor Not Found</Text>
          <Text style={styles.errorText}>
            We couldn't load your anchor. Please try again.
          </Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={handleBack}
            activeOpacity={0.8}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <BlurView intensity={20} tint="dark" style={styles.headerBar}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Charge Your Anchor</Text>
        <View style={styles.backButton} />
      </BlurView>

      <Animated.ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim }}
      >
        {/* Hero Symbol */}
        <View style={styles.symbolSection}>
          <Animated.View
            style={[
              styles.symbolContainer,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <SigilSvg xml={anchor.baseSigilSvg} width={180} height={180} />
          </Animated.View>
        </View>

        {/* Intention Display */}
        <View style={styles.intentionSection}>
          <Text style={styles.intentionLabel}>YOUR INTENTION</Text>
          <Text style={styles.intentionText} numberOfLines={2}>
            {anchor.intentionText}
          </Text>
        </View>

        {/* Step Content */}
        <View style={styles.stepContent}>
          {currentStep === 'default' && selectedMode && selectedDuration && (
            <DefaultChargeDisplay
              mode={selectedMode}
              durationSeconds={selectedDuration}
              onContinue={handleContinueFromDefault}
              onChange={handleChangeDefault}
            />
          )}

          {currentStep === 'mode' && (
            <ModeSelectionStep onSelectMode={handleSelectMode} />
          )}

          {currentStep === 'duration' && selectedMode && (
            <DurationSelectionStep
              mode={selectedMode}
              onSelectDuration={handleSelectDuration}
              onContinue={handleContinueFromDuration}
            />
          )}
        </View>
      </Animated.ScrollView>

      {/* Info Button (Floating) */}
      <TouchableOpacity
        style={styles.infoButton}
        onPress={openInfoSheet}
        activeOpacity={0.8}
      >
        <BlurView intensity={20} tint="dark" style={styles.infoBlur}>
          <InfoIcon size={24} color={colors.gold} />
        </BlurView>
      </TouchableOpacity>

      {/* Info Bottom Sheet Modal */}
      <Modal
        visible={infoSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeInfoSheet}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeInfoSheet}
        >
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sheetTitle}>Charging Modes</Text>
              <Text style={styles.sheetText}>
                Charging is the process of linking your intention to the anchor
                symbol through focused attention and emotional resonance.
              </Text>

              <Text style={styles.sheetSubtitle}>Focus Charge</Text>
              <Text style={styles.sheetText}>
                A brief moment of alignment. Choose between 30 seconds, 2 minutes,
                or 5 minutes for a focused energy boost.
              </Text>

              <Text style={styles.sheetSubtitle}>Ritual Charge</Text>
              <Text style={styles.sheetText}>
                A guided, immersive experience. Multi-phase ceremony with 5 minutes,
                10 minutes, or custom durations. Perfect for deeper transformation.
              </Text>

              <Text style={styles.sheetSubtitle}>Your Defaults</Text>
              <Text style={styles.sheetText}>
                Your most recent charge selection is automatically saved as your
                default. You can change it anytime by selecting a different mode
                or duration.
              </Text>

              <TouchableOpacity
                style={styles.sheetButton}
                onPress={closeInfoSheet}
                activeOpacity={0.8}
              >
                <Text style={styles.sheetButtonText}>Got it</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },

  // ────────────────────────────────────────────────────────────
  // Header
  // ────────────────────────────────────────────────────────────
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.gold}20`,
    overflow: 'hidden',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  backIcon: {
    fontSize: 24,
    color: colors.gold,
  },
  headerTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    letterSpacing: 0.5,
  },

  // ────────────────────────────────────────────────────────────
  // Symbol Section
  // ────────────────────────────────────────────────────────────
  symbolSection: {
    alignItems: 'center',
    paddingTop: spacing.xxxl + spacing.lg,
  },
  symbolContainer: {
    padding: spacing.md,
  },

  // ────────────────────────────────────────────────────────────
  // Intention Section
  // ────────────────────────────────────────────────────────────
  intentionSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  intentionLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  intentionText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body1,
  },

  // ────────────────────────────────────────────────────────────
  // Step Content
  // ────────────────────────────────────────────────────────────
  stepContent: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    minHeight: 400,
  },

  // ────────────────────────────────────────────────────────────
  // Info Button
  // ────────────────────────────────────────────────────────────
  infoButton: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  infoBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${colors.gold}40`,
  },

  // ────────────────────────────────────────────────────────────
  // Bottom Sheet Modal
  // ────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.md,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.text.tertiary,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  sheetTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.md,
  },
  sheetSubtitle: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.headingSemiBold,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sheetText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body2,
    marginBottom: spacing.md,
  },
  sheetButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.gold,
    borderRadius: 12,
    alignItems: 'center',
  },
  sheetButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.navy,
  },

  // ────────────────────────────────────────────────────────────
  // Error State
  // ────────────────────────────────────────────────────────────
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.error,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  errorButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.gold,
    borderRadius: 12,
  },
  errorButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.navy,
  },
});
