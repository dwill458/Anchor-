/**
 * Charge Setup Screen - Sacred Ritual Threshold
 *
 * Transformed into a sacred entry point for charging rituals.
 * This is no longer a selection screen — it is a ritual threshold.
 *
 * Design Principles:
 * 1. Time feels slower than anywhere else in the app
 * 2. Anchor symbol is the source - UI emerges from it
 * 3. Language invites, does not instruct
 * 4. Motion replaces explanation
 * 5. Restraint over ornament
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  AccessibilityInfo,
  BackHandler,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useAnchorStore } from '@/stores/anchorStore';
import { useAuthStore } from '@/stores/authStore';
import { useSettingsStore, ChargeDurationPreset } from '@/stores/settingsStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { AnchorFocalPoint } from './components/AnchorFocalPoint';
import { DepthCard } from './components/DepthCard';
import { DurationPicker } from './components/DurationPicker';
import { CommitmentGate } from './components/CommitmentGate';
import { DefaultChargeDisplay } from './components/DefaultChargeDisplay';
import { RitualScaffold } from './components/RitualScaffold';
import { RitualTopBar } from './components/RitualTopBar';
import { useRitualTransition } from './hooks/useRitualTransition';
import { TIMING, EASING, type TransitionPhase, type DepthType } from './utils/transitionConstants';

type ChargeSetupRouteProp = RouteProp<RootStackParamList, 'ChargeSetup'>;
type ChargeSetupNavigationProp = StackNavigationProp<RootStackParamList, 'ChargeSetup'>;
const clampChargeMinutes = (value: number): number => Math.min(30, Math.max(1, Math.round(value)));

export const ChargeSetupScreen: React.FC = () => {
  const navigation = useNavigation<ChargeSetupNavigationProp>();
  const route = useRoute<ChargeSetupRouteProp>();
  const { anchorId } = route.params || {};

  const { getAnchorById } = useAnchorStore();
  const { anchorCount } = useAuthStore();
  const { defaultCharge, setDefaultCharge } = useSettingsStore();
  const anchor = getAnchorById(anchorId);

  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>('entering');
  const [selectedDepth, setSelectedDepth] = useState<DepthType | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [showQuickPath, setShowQuickPath] = useState(false);
  const isNavigatingRef = useRef(false);
  const anchorLayoutRef = useRef<{ y: number }>({ y: 0 });

  const anchorOpacity = useRef(new Animated.Value(0)).current;
  const promptOpacity = useRef(new Animated.Value(0)).current;
  const depthCardsOpacity = useRef(new Animated.Value(0)).current;
  const durationPickerOpacity = useRef(new Animated.Value(0)).current;

  const breathScale = useRef(new Animated.Value(1.0)).current;
  const glowOpacity = useRef(new Animated.Value(TIMING.GLOW_OPACITY_MIN)).current;

  const breathAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const shimmerAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  const {
    ctaGlow,
    buttonTextOpacity,
    uiOpacity,
    anchorScale,
    anchorTranslateY,
    backgroundDarken,
    beginTransition,
    resetTransition,
  } = useRitualTransition({
    reduceMotionEnabled,
    onTransitionComplete: () => navigateToRitual(),
  });

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotionEnabled);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotionEnabled);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const isReturningUser = anchorCount > 0;
    setShowQuickPath(isReturningUser);

    if (isReturningUser) {
      const defaultMode = defaultCharge.mode === 'focus' ? 'light' : 'deep';
      const defaultDuration = getDurationSeconds(defaultCharge.preset);
      setSelectedDepth(defaultMode);
      setSelectedDuration(defaultDuration);
    }
  }, [anchorCount, defaultCharge]);

  useEffect(() => {
    if (reduceMotionEnabled) {
      anchorOpacity.setValue(1);
      promptOpacity.setValue(1);
      depthCardsOpacity.setValue(1);
      setTransitionPhase('idle');
      return;
    }

    Animated.timing(anchorOpacity, {
      toValue: 1,
      duration: TIMING.ANCHOR_FADE_IN,
      easing: EASING.ENTRY,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(promptOpacity, {
          toValue: 1,
          duration: TIMING.PROMPT_FADE_IN,
          easing: EASING.ENTRY,
          useNativeDriver: true,
        }).start(() => {
          Animated.timing(depthCardsOpacity, {
            toValue: 1,
            duration: TIMING.DEPTH_CARDS_FADE_IN,
            easing: EASING.ENTRY,
            useNativeDriver: true,
          }).start(() => setTransitionPhase('idle'));
        });
      }, TIMING.ENTRY_STILLNESS);
    });
  }, [reduceMotionEnabled]);

  useEffect(() => {
    if (selectedDepth) {
      Animated.timing(durationPickerOpacity, {
        toValue: 1,
        duration: TIMING.DURATION_PICKER_FADE,
        easing: EASING.ENTRY,
        useNativeDriver: true,
      }).start();
    } else {
      durationPickerOpacity.setValue(0);
    }
  }, [selectedDepth]);

  const handleSelectDepth = (depth: DepthType) => {
    setSelectedDepth(depth);
    setSelectedDuration(null);
    setShowQuickPath(false);
  };

  const handleSelectDuration = (durationSeconds: number) => {
    setSelectedDuration(durationSeconds);
  };

  const handleBeginRitual = () => {
    if (!selectedDepth || !selectedDuration || isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTransitionPhase('transitioning');
    saveDefaultCharge();

    if (breathAnimationRef.current && shimmerAnimationRef.current) {
      beginTransition(anchorLayoutRef.current.y, breathAnimationRef.current, shimmerAnimationRef.current);
    } else {
      navigateToRitual();
    }
  };

  const handleContinueWithDefault = () => handleBeginRitual();
  const handleChangeDefault = () => setShowQuickPath(false);

  const saveDefaultCharge = () => {
    if (!selectedDepth || !selectedDuration) return;

    let preset: ChargeDurationPreset = 'custom';
    if (selectedDuration === 30) preset = '30s';
    else if (selectedDuration === 60) preset = '1m';
    else if (selectedDuration === 120) preset = '2m';
    else if (selectedDuration === 300) preset = '5m';
    else if (selectedDuration === 600) preset = '10m';

    const mode = selectedDepth === 'light' ? 'focus' : 'ritual';
    setDefaultCharge({
      mode,
      preset,
      customMinutes: preset === 'custom' ? clampChargeMinutes(selectedDuration / 60) : undefined,
    });
  };

  const navigateToRitual = () => {
    if (!selectedDepth || !selectedDuration) return;
    const ritualType = selectedDepth === 'light' ? 'focus' : 'ritual';
    navigation.navigate('Ritual', { anchorId, ritualType, durationSeconds: selectedDuration });
  };

  const handleBack = () => navigation.goBack();

  const handleAnchorLayout = (event: any) => {
    anchorLayoutRef.current = { y: event.nativeEvent.layout.y };
  };

  useFocusEffect(
    useCallback(() => {
      isNavigatingRef.current = false;
      resetTransition();
      const onBackPress = () => transitionPhase === 'transitioning';
      BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => BackHandler.removeEventListener('hardwareBackPress', onBackPress);
    }, [transitionPhase])
  );

  const getDurationSeconds = (preset: ChargeDurationPreset): number => {
    switch (preset) {
      case '30s': return 30;
      case '1m': return 60;
      case '2m': return 120;
      case '5m': return 300;
      case '10m': return 600;
      case 'custom': return clampChargeMinutes(defaultCharge.customMinutes || 12) * 60;
      default: return 120;
    }
  };

  if (!anchorId || !anchor) {
    return (
      <RitualScaffold>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Anchor Not Found</Text>
          <Text style={styles.errorText}>We could not load your anchor. Please try again.</Text>
          <TouchableOpacity style={styles.errorButton} onPress={handleBack} activeOpacity={0.8}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </RitualScaffold>
    );
  }

  return (
    <RitualScaffold>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.background.primary, opacity: backgroundDarken }]}
        pointerEvents="none"
      />

      <Animated.View style={{ opacity: uiOpacity }}>
        <RitualTopBar
          onBack={handleBack}
          title="Charge Your Anchor"
          disableBack={transitionPhase === 'transitioning'}
        />
      </Animated.View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={transitionPhase !== 'transitioning'}
      >
        <AnchorFocalPoint
          anchor={anchor}
          breathScale={breathScale}
          glowOpacity={glowOpacity}
          opacity={anchorOpacity}
          scale={anchorScale}
          translateY={anchorTranslateY}
          reduceMotionEnabled={reduceMotionEnabled}
          onLayout={handleAnchorLayout}
        />

        <Animated.View style={[styles.promptSection, { opacity: promptOpacity }]}>
          <Text style={styles.promptText}>How long do you want to stay with this symbol?</Text>
        </Animated.View>

        {showQuickPath && selectedDepth && selectedDuration && (
          <Animated.View style={[styles.quickPathSection, { opacity: promptOpacity }]}>
            <DefaultChargeDisplay
              mode={selectedDepth === 'light' ? 'focus' : 'ritual'}
              durationSeconds={selectedDuration}
              onContinue={handleContinueWithDefault}
              onChange={handleChangeDefault}
            />
          </Animated.View>
        )}

        {!showQuickPath && (
          <Animated.View style={[styles.depthSection, { opacity: uiOpacity }]}>
            <View style={styles.depthCards}>
              <DepthCard
                type="deep"
                isSelected={selectedDepth === 'deep'}
                onSelect={() => handleSelectDepth('deep')}
                opacity={depthCardsOpacity}
              />
              <View style={styles.cardSpacer} />
              <DepthCard
                type="light"
                isSelected={selectedDepth === 'light'}
                onSelect={() => handleSelectDepth('light')}
                opacity={depthCardsOpacity}
              />
            </View>
            {selectedDepth && (
              <DurationPicker
                depth={selectedDepth}
                selectedDuration={selectedDuration}
                onSelectDuration={handleSelectDuration}
                opacity={durationPickerOpacity}
              />
            )}
          </Animated.View>
        )}
      </ScrollView>

      <CommitmentGate
        depth={selectedDepth}
        duration={selectedDuration}
        onBegin={handleBeginRitual}
        glowValue={ctaGlow}
        buttonTextOpacity={buttonTextOpacity}
      />
    </RitualScaffold>
  );
};

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: spacing.xxxl },
  promptSection: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, alignItems: 'center' },
  promptText: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    textAlign: 'center',
    letterSpacing: 0.3,
    lineHeight: typography.lineHeights.h3
  },
  quickPathSection: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
  depthSection: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  depthCards: { gap: spacing.md },
  cardSpacer: { height: spacing.md },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl },
  errorTitle: { fontSize: typography.sizes.h2, fontFamily: typography.fonts.heading, color: colors.error, marginBottom: spacing.md },
  errorText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl
  },
  errorButton: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, backgroundColor: colors.gold, borderRadius: 12 },
  errorButtonText: { fontSize: typography.sizes.button, fontFamily: typography.fonts.bodyBold, color: colors.navy },
});
