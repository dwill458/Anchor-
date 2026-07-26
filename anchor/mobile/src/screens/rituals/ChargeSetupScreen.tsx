import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { type StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useLocationPrimingStore } from '@/stores/locationPrimingStore';
import type { LocationPrimingSuggestion } from '@/utils/locationPriming';
import { safeHaptics } from '@/utils/haptics';
import { OptimizedImage } from '@/components/common';
import { MicroTeachInline } from '@/components/teaching';
import { useTabNavigation } from '@/contexts/TabNavigationContext';
import { useTeachingGate } from '@/utils/useTeachingGate';
import { AnalyticsEvents, AnalyticsService } from '@/services/AnalyticsService';
import type { Anchor, RootStackParamList } from '@/types';
import { spacing } from '@/theme';
import { navigateToVaultDestination } from '@/navigation/firstAnchorGate';
import { isCompactPhoneViewport, isShortPhoneViewport } from '@/utils/layout';
import { usePrimeSessionAccess } from '@/hooks/usePrimeSessionAccess';
import {
  SessionAudioOverrideSheet,
  VoiceAndSoundSummaryRow,
} from '@/components/settings/SessionAudioOverrideSheet';
import { persistSessionAudioDefaults } from '@/services/SessionAudioPreferencesService';
import {
  DEFAULT_SESSION_AUDIO_DEFAULTS,
  formatCompactSessionAudioSummary,
  resolveSessionAudioConfiguration,
  type SessionAudioDefaults,
} from '@/types/sessionAudio';

type ChargeSetupRouteProp = RouteProp<RootStackParamList, 'ChargeSetup'>;
type ChargeSetupNavigationProp = StackNavigationProp<RootStackParamList, 'ChargeSetup'>;
type DurationChoice = 'quick' | 'deep';

const NAVY = '#0F1419';
const GOLD = '#D4AF37';
const GOLD_DIM = '#A8892A';
const BONE = '#F5F5DC';
const SILVER = '#C0C0C0';
const BLACK = '#080C10';
const PANEL_OVERLAP = 34;
const PRIME_ARTWORK_SIZE = 176;

const FALLBACK_SIGIL_SVG = `
<svg viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="120" cy="120" r="86" fill="rgba(8,12,16,0.74)" stroke="rgba(212,175,55,0.28)" stroke-width="2"/>
  <path
    d="M72 90h96M72 90l34 68h58M168 90l-62 68"
    fill="none"
    stroke="#D4AF37"
    stroke-width="6"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
`.trim();

const BOLT_ICON_SVG = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path
    d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"
    fill="none"
    stroke="#D4AF37"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
`.trim();

const FLAME_ICON_SVG = `
<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path
    d="M12 2c1 3-2 4-2 7a3 3 0 0 0 6 0c1.5 1.5 2 3.5 2 5a6 6 0 0 1-12 0c0-4 3-6 4-9 0.5-1.2 1.4-2.2 2-3z"
    fill="none"
    stroke="#D4AF37"
    stroke-width="1.5"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
`.trim();

const chargeConfigByChoice = {
  quick: {
    mode: 'focus' as const,
    preset: '30s' as const,
    customMinutes: undefined,
    ritualType: 'focus' as const,
    durationSeconds: 30,
    iconSvg: BOLT_ICON_SVG,
    name: 'Quick Prime',
    lineOne: '30 seconds',
    lineTwo: 'Best for daily consistency',
  },
  deep: {
    mode: 'ritual' as const,
    preset: 'custom' as const,
    customMinutes: 2,
    ritualType: 'ritual' as const,
    durationSeconds: 120,
    iconSvg: FLAME_ICON_SVG,
    name: 'Deep Prime',
    lineOne: '2 – 10 minutes',
    lineTwo: 'Best for focused work',
  },
};

const getPrimeStructureSvg = (anchor?: Anchor): string =>
  anchor?.baseSigilSvg?.trim() || anchor?.reinforcedSigilSvg?.trim() || FALLBACK_SIGIL_SVG;

const formatPresetDuration = (seconds: number): string =>
  seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)} min`;

export const ChargeSetupScreen: React.FC = () => {
  const navigation = useNavigation<ChargeSetupNavigationProp>();
  const route = useRoute<ChargeSetupRouteProp>();
  const { navigateToPractice, navigateToPaywall } = useTabNavigation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const {
    anchorId,
    returnTo,
    autoStartOnSelection = false,
    initialDuration,
    fromOnboarding = false,
  } = route.params || {};

  const chargeSetupTeaching = useTeachingGate({
    screenId: 'charge_setup',
    candidateIds: ['charge_setup_first_time_v1'],
  });

  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const setDefaultCharge = useSettingsStore((state) => state.setDefaultCharge);
  const resolveLocationPrimingSuggestion = useLocationPrimingStore(
    (state) => state.resolveActiveSuggestion
  );
  const anchor = getAnchorById(anchorId);
  const primeSessionAccess = usePrimeSessionAccess();
  const sessionAudioDefaults = useSettingsStore(
    (state) => state.sessionAudioDefaults ?? DEFAULT_SESSION_AUDIO_DEFAULTS
  );

  const [selectedDuration, setSelectedDuration] = useState<DurationChoice>(initialDuration ?? 'quick');
  const [hasManuallySelectedDuration, setHasManuallySelectedDuration] = useState(false);
  const [locationPrimingSuggestion, setLocationPrimingSuggestion] =
    useState<LocationPrimingSuggestion | null>(null);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [enhancedArtworkFailed, setEnhancedArtworkFailed] = useState(false);
  const [audioOverrides, setAudioOverrides] = useState<
    Partial<Record<DurationChoice, SessionAudioDefaults>>
  >({});
  const [showAudioOverride, setShowAudioOverride] = useState(false);

  const isNavigatingRef = useRef(false);
  const hasAutoStartedRef = useRef(false);
  const isCompactLayout = isCompactPhoneViewport(screenWidth, screenHeight);
  const isShortLayout = isShortPhoneViewport(screenHeight);
  const heroHeight = Math.round(screenHeight * (isCompactLayout ? 0.44 : 0.48));
  const artworkSize = Math.round(
    Math.min(screenWidth - (isCompactLayout ? 100 : 120), screenHeight * (isCompactLayout ? 0.24 : 0.27))
  );
  const artworkInnerSize = Math.round(artworkSize * 0.6);
  const glowBackdropSize = artworkSize + (isCompactLayout ? 30 : 40);
  const outerRingSize = artworkSize + (isCompactLayout ? 56 : 70);
  const midRingSize = artworkSize + (isCompactLayout ? 22 : 28);
  const innerRingSize = artworkSize - (isCompactLayout ? 12 : 6);
  const heroVisualOffset = Math.round(isCompactLayout ? 8 : 12);
  const shouldShowEnhancedArtwork = Boolean(anchor?.enhancedImageUrl) && !enhancedArtworkFailed;
  const ringPulseOuter = useRef(new Animated.Value(1)).current;
  const ringPulseMid = useRef(new Animated.Value(1)).current;
  const ringPulseInner = useRef(new Animated.Value(1)).current;
  const glowBreath = useRef(new Animated.Value(0.5)).current;
  const structureSvg = useMemo(() => getPrimeStructureSvg(anchor), [anchor]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => setReduceMotionEnabled(v));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (isEnabled: boolean) => setReduceMotionEnabled(isEnabled));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    setEnhancedArtworkFailed(false);
  }, [anchor?.id, anchor?.enhancedImageUrl]);

  useEffect(() => {
    const rings = [ringPulseOuter, ringPulseMid, ringPulseInner];

    if (reduceMotionEnabled) {
      rings.forEach((ring) => ring.setValue(1));
      return;
    }

    const createRingLoop = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 0.35,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );

    const animations = [
      createRingLoop(ringPulseInner, 0),
      createRingLoop(ringPulseMid, 600),
      createRingLoop(ringPulseOuter, 1200),
    ];

    animations.forEach((animation) => animation.start());

    return () => {
      animations.forEach((animation) => animation.stop());
      rings.forEach((ring) => ring.stopAnimation());
    };
  }, [reduceMotionEnabled, ringPulseInner, ringPulseMid, ringPulseOuter]);

  useEffect(() => {
    if (reduceMotionEnabled) {
      glowBreath.setValue(0.5);
      return;
    }

    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(glowBreath, {
          toValue: 1,
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowBreath, {
          toValue: 0.5,
          duration: 5000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );

    breathe.start();

    return () => {
      breathe.stop();
      glowBreath.stopAnimation();
    };
  }, [glowBreath, reduceMotionEnabled]);

  useFocusEffect(
    useCallback(() => {
      isNavigatingRef.current = false;
      setIsTransitioning(false);

      const onBackPress = () => isTransitioning;
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [isTransitioning])
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      resolveLocationPrimingSuggestion()
        .then((suggestion) => {
          if (!isActive) {
            return;
          }

          setLocationPrimingSuggestion(suggestion);
          if (suggestion && !hasManuallySelectedDuration) {
            setSelectedDuration(
              suggestion.zone.preset.sessionType === 'focus' ? 'quick' : 'deep'
            );
          }
        })
        .catch(() => {
          if (isActive) {
            setLocationPrimingSuggestion(null);
          }
        });

      return () => {
        isActive = false;
      };
    }, [hasManuallySelectedDuration, resolveLocationPrimingSuggestion])
  );

  const getLocationPresetForChoice = useCallback(
    (choice: DurationChoice) => {
      if (hasManuallySelectedDuration || !locationPrimingSuggestion) {
        return null;
      }

      const preset = locationPrimingSuggestion.zone.preset;
      const presetChoice: DurationChoice = preset.sessionType === 'focus' ? 'quick' : 'deep';
      return presetChoice === choice ? preset : null;
    },
    [hasManuallySelectedDuration, locationPrimingSuggestion]
  );

  const navigateToRitual = useCallback(
    (choice: DurationChoice) => {
      const config = chargeConfigByChoice[choice];
      const locationPreset = getLocationPresetForChoice(choice);
      const durationOverride = locationPreset?.durationSeconds ?? config.durationSeconds;
      const sessionType = choice === 'quick' ? 'focus' : 'deep_prime';
      const defaultAudio = sessionAudioDefaults[sessionType];
      const audioOverride = audioOverrides[choice] ?? locationPreset?.audioConfiguration;
      const audioConfiguration = resolveSessionAudioConfiguration(defaultAudio, audioOverride);
      if (choice === 'quick') {
        navigation.replace('ActivationRitual', {
          anchorId,
          activationType: 'visual',
          durationOverride,
          audioConfiguration,
          returnTo,
        });
      } else {
        navigation.replace('Ritual', {
          anchorId,
          ritualType: config.ritualType as any,
          durationSeconds: durationOverride,
          audioConfiguration,
          returnTo,
        });
      }
    },
    [anchorId, audioOverrides, getLocationPresetForChoice, navigation, returnTo, sessionAudioDefaults]
  );

  const handleBeginRitual = useCallback(
    (choice: DurationChoice = selectedDuration) => {
      if (isNavigatingRef.current || isTransitioning) return;

      const allowance = choice === 'quick' ? primeSessionAccess.focus : primeSessionAccess.deep;
      if (!allowance.isAllowed) {
        AnalyticsService.track('free_weekly_sessions_used', {
          source: choice === 'quick' ? 'charge_setup_quick' : 'charge_setup_deep',
          remaining_weekly_free_sessions: allowance.remaining,
          tier: primeSessionAccess.tier,
        });
        navigateToPaywall({
          source: 'free_weekly_sessions_used',
          preferredPlanId: 'annual',
        });
        return;
      }

      const config = chargeConfigByChoice[choice];
      const locationPreset = getLocationPresetForChoice(choice);
      isNavigatingRef.current = true;
      setIsTransitioning(true);

      if (!locationPreset) {
        setDefaultCharge({
          mode: config.mode,
          preset: config.preset,
          customMinutes: config.customMinutes,
        });
      }

      AnalyticsService.track(AnalyticsEvents.CHARGE_STARTED, {
        anchor_id: anchorId,
        source: 'charge_setup',
        mode: choice,
        duration_seconds: locationPreset?.durationSeconds ?? config.durationSeconds,
        return_to: returnTo,
        ...(locationPreset
          ? {
            location_preset_applied: true,
            session_type: locationPreset.sessionType,
          }
          : {}),
      });
      AnalyticsService.track(
        choice === 'quick'
          ? AnalyticsEvents.QUICK_CHARGE_STARTED
          : AnalyticsEvents.DEEP_CHARGE_STARTED,
        {
          anchor_id: anchorId,
          source: 'charge_setup',
          duration_seconds: locationPreset?.durationSeconds ?? config.durationSeconds,
          return_to: returnTo,
          ...(locationPreset
            ? {
              location_preset_applied: true,
              session_type: locationPreset.sessionType,
            }
            : {}),
        }
      );

      void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
      navigateToRitual(choice);
    },
    [
      getLocationPresetForChoice,
      isTransitioning,
      navigateToRitual,
      navigateToPaywall,
      navigation,
      primeSessionAccess.deep,
      primeSessionAccess.focus,
      selectedDuration,
      setDefaultCharge,
    ]
  );

  const handleSelectDuration = useCallback(
    (choice: DurationChoice) => {
      if (isTransitioning) return;
      setHasManuallySelectedDuration(true);
      setSelectedDuration(choice);
      void safeHaptics.selection();

      if (autoStartOnSelection) {
        handleBeginRitual(choice);
      }
    },
    [autoStartOnSelection, handleBeginRitual, isTransitioning]
  );

  useEffect(() => {
    if (!autoStartOnSelection || !initialDuration || !anchor) {
      return;
    }
    if (hasAutoStartedRef.current || isTransitioning) {
      return;
    }

    hasAutoStartedRef.current = true;
    handleBeginRitual(initialDuration);
  }, [anchor, autoStartOnSelection, handleBeginRitual, initialDuration, isTransitioning]);

  const handleBack = useCallback(() => {
    if (isTransitioning) return;
    if (autoStartOnSelection) {
      // Came from creation flow — navigate to Vault so the new anchor is visible
      navigateToVaultDestination(navigation, 'reset');
    } else {
      navigation.goBack();
    }
  }, [isTransitioning, navigation, autoStartOnSelection]);

  const handlePrimeLater = useCallback(() => {
    if (isTransitioning || !anchorId) return;

    void safeHaptics.selection();

    if (fromOnboarding && anchor) {
      navigation.replace('SaveProgress', { anchor });
      return;
    }

    if (returnTo === 'practice') {
      if (typeof navigation.popToTop === 'function') {
        navigation.popToTop();
      }
      navigateToPractice();
      return;
    }

    if (returnTo === 'detail') {
      navigation.replace('AnchorDetail', { anchorId });
      return;
    }

    navigateToVaultDestination(navigation, 'reset');
  }, [anchor, anchorId, fromOnboarding, isTransitioning, navigateToPractice, navigation, returnTo]);

  const activeLocationPreset = getLocationPresetForChoice(selectedDuration);
  const activeSessionType = selectedDuration === 'quick' ? 'focus' : 'deep_prime';
  const activeDurationSeconds =
    activeLocationPreset?.durationSeconds ?? chargeConfigByChoice[selectedDuration].durationSeconds;
  const activeAudioValue =
    audioOverrides[selectedDuration] ??
    activeLocationPreset?.audioConfiguration ??
    sessionAudioDefaults[activeSessionType];

  const handleAudioOverrideConfirm = useCallback(
    (value: SessionAudioDefaults, makeDefault: boolean) => {
      setAudioOverrides((current) => ({ ...current, [selectedDuration]: value }));
      setShowAudioOverride(false);
      if (makeDefault) {
        void persistSessionAudioDefaults(activeSessionType, value).catch(() => undefined);
      }
    },
    [activeSessionType, selectedDuration]
  );

  if (!anchorId || !anchor) {
    return (
      <View style={styles.screen}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Anchor Not Found</Text>
          <Text style={styles.errorText}>We could not load your anchor. Please try again.</Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={handleBack}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Go Back"
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const cards = (['quick', 'deep'] as const).map((choice) => ({
    choice,
    ...chargeConfigByChoice[choice],
    isSelected: selectedDuration === choice,
  }));

  return (
    <View testID="deep-prime-entry" style={styles.screen}>
      <View style={[styles.heroSection, { height: heroHeight }]}>
        {/* Background gradient */}
        <LinearGradient
          colors={['#05090C', '#0A120D', '#121B11', '#080C10']}
          locations={[0, 0.34, 0.7, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={[styles.navBar, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={handleBack}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Close prime selection"
            disabled={isTransitioning}
            style={styles.navButton}
          >
            <BlurView intensity={18} tint="dark" style={styles.navBlur}>
              <Text style={styles.closeButtonText}>✕</Text>
            </BlurView>
          </TouchableOpacity>
        </View>

        <View style={styles.heroEyebrowRow}>
          <Text style={styles.heroEyebrowText}>ANCHOR READY</Text>
        </View>

        <View pointerEvents="none" style={[styles.anchorHero, { transform: [{ translateY: heroVisualOffset }] }]}>
          <Animated.View
            style={[
              styles.glowBackdrop,
              {
                width: glowBackdropSize,
                height: glowBackdropSize,
                borderRadius: glowBackdropSize / 2,
                opacity: glowBreath,
              },
            ]}
          />

          <View style={styles.ringField}>
            <Animated.View style={[styles.ring, { width: outerRingSize, height: outerRingSize, opacity: ringPulseOuter }]} />
            <Animated.View style={[styles.ring, styles.ringMid, { width: midRingSize, height: midRingSize, opacity: ringPulseMid }]} />
            <Animated.View style={[styles.ring, styles.ringInner, { width: innerRingSize, height: innerRingSize, opacity: ringPulseInner }]} />
          </View>

          <View style={styles.anchorOverlay}>
            <View style={[styles.anchorFrame, { width: artworkSize, height: artworkSize, borderRadius: artworkSize / 2 }]}>
              {shouldShowEnhancedArtwork && anchor?.enhancedImageUrl ? (
                <OptimizedImage
                  uri={anchor.enhancedImageUrl}
                  style={[styles.anchorImage, { width: artworkSize, height: artworkSize, borderRadius: artworkSize / 2 }]}
                  resizeMode="contain"
                  onError={() => setEnhancedArtworkFailed(true)}
                />
              ) : (
                <View style={[styles.sigilFrame, { width: artworkSize, height: artworkSize, borderRadius: artworkSize / 2 }]}>
                  <SvgXml xml={structureSvg} width={artworkInnerSize} height={artworkInnerSize} />
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.panel, { marginTop: -PANEL_OVERLAP, paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
        <LinearGradient
          colors={['transparent', 'rgba(212,175,55,0.5)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.panelSeam}
        />

        <ScrollView
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.panelContent,
            isCompactLayout && styles.panelContentCompact,
          ]}
        >
          <View style={styles.topContent}>
            <View style={[styles.badgeRow, isCompactLayout && styles.badgeRowCompact]}>
              <LinearGradient
                colors={['transparent', 'rgba(212,175,55,0.3)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.badgeLine}
              />
              <Text style={styles.badgeText}>ANCHOR FORGED</Text>
              <LinearGradient
                colors={['rgba(212,175,55,0.3)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.badgeLine}
              />
            </View>

            <Text style={[styles.headline, isCompactLayout && styles.headlineCompact]}>Choose Your Prime</Text>
            <Text style={[styles.subline, isCompactLayout && styles.sublineCompact]}>Start short. Build the thread.</Text>
            <Text style={[styles.durationLabel, isCompactLayout && styles.durationLabelCompact]}>SELECT DURATION</Text>

            <MicroTeachInline
              teaching={chargeSetupTeaching}
              screenId="charge_setup"
              style={{ textAlign: 'center', alignSelf: 'center' }}
            />

            {activeLocationPreset && locationPrimingSuggestion ? (
              <View style={styles.locationPresetPill}>
                <Text style={styles.locationPresetLabel}>PLACE PRESET</Text>
                <Text style={styles.locationPresetText}>
                  {locationPrimingSuggestion.zone.label} · {formatPresetDuration(activeLocationPreset.durationSeconds)} · {formatCompactSessionAudioSummary(activeLocationPreset.audioConfiguration)}
                </Text>
              </View>
            ) : null}

            <View style={[styles.cardsRow, isCompactLayout && styles.cardsRowCompact]}>
              {cards.map((card) => (
                <TouchableOpacity
                  key={card.choice}
                  activeOpacity={0.88}
                  onPress={() => handleSelectDuration(card.choice)}
                  accessibilityRole="radio"
                  accessibilityLabel={`${card.name} duration`}
                  accessibilityState={{ selected: card.isSelected }}
                  disabled={isTransitioning}
                  style={[
                    styles.durationCard,
                    isCompactLayout && styles.durationCardCompact,
                    card.isSelected ? styles.durationCardSelected : null,
                  ]}
                >
                  {card.isSelected ? (
                    <View style={styles.checkCircle}>
                      <Text style={styles.checkText}>✓</Text>
                    </View>
                  ) : null}
                  <SvgXml
                    xml={card.iconSvg}
                    width={isCompactLayout ? 18 : 22}
                    height={isCompactLayout ? 18 : 22}
                    style={[styles.cardIcon, isCompactLayout && styles.cardIconCompact]}
                  />
                  <Text style={[styles.cardName, isCompactLayout && styles.cardNameCompact, card.isSelected ? styles.cardNameSelected : null]}>{card.name}</Text>
                  <Text style={[styles.cardLine, styles.cardLineTime, isCompactLayout && styles.cardLineCompact]}>{card.lineOne}</Text>
                  <Text style={[styles.cardLine, isCompactLayout && styles.cardLineCompact]}>{card.lineTwo}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <VoiceAndSoundSummaryRow
              value={activeAudioValue}
              onPress={() => setShowAudioOverride(true)}
            />
          </View>

          <View style={[styles.bottomActions, isCompactLayout && styles.bottomActionsCompact]}>
            <TouchableOpacity
              onPress={() => handleBeginRitual()}
              activeOpacity={0.9}
              disabled={isTransitioning}
              accessibilityRole="button"
              accessibilityLabel="Begin Priming"
              style={styles.ctaTouchable}
            >
              <LinearGradient
                colors={['#C9A227', '#D4AF37', '#E8C84A']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.ctaButton, isCompactLayout && styles.ctaButtonCompact]}
              >
                <Text style={[styles.ctaText, isCompactLayout && styles.ctaTextCompact]}>Begin Priming</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePrimeLater}
              activeOpacity={0.6}
              disabled={isTransitioning}
              accessibilityRole="button"
              accessibilityLabel="Prime later"
              style={[styles.secondaryCtaButton, isCompactLayout && styles.secondaryCtaButtonCompact]}
              hitSlop={{ top: 10, bottom: 10, left: 16, right: 16 }}
            >
              <Text style={[styles.secondaryCtaText, isCompactLayout && styles.secondaryCtaTextCompact]}>
                Prime later
              </Text>
            </TouchableOpacity>

            <Text style={[styles.safetyText, isShortLayout && styles.safetyTextCompact]}>You can stop anytime.</Text>
          </View>
        </ScrollView>
      </View>

      {/*
        DEFERRED: old ChargeSetupScreen UI — remove post-launch
        <ScrollView>{legacy ChargedGlowCanvas/PremiumAnchorGlow prime-selection layout}</ScrollView>
      */}
      <SessionAudioOverrideSheet
        visible={showAudioOverride}
        sessionType={activeSessionType}
        durationSeconds={activeDurationSeconds}
        initialValue={activeAudioValue}
        onCancel={() => setShowAudioOverride(false)}
        onConfirm={handleAudioOverrideConfirm}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BLACK,
  },
  heroSection: {
    width: '100%',
    backgroundColor: BLACK,
    overflow: 'hidden',
  },
  anchorHero: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowBackdrop: {
    position: 'absolute',
    backgroundColor: 'rgba(212,175,55,0.09)',
  },
  heroEyebrowRow: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 10,
  },
  heroEyebrowText: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 11,
    letterSpacing: 3.6,
    color: GOLD,
    textAlign: 'center',
  },
  ringField: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  ringOuter: {
    width: 310,
    height: 310,
  },
  ringMid: {
    width: 255,
    height: 255,
    borderColor: 'rgba(212,175,55,0.16)',
  },
  ringInner: {
    width: 200,
    height: 200,
    borderColor: 'rgba(212,175,55,0.26)',
  },
  anchorOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchorFrame: {
    width: PRIME_ARTWORK_SIZE,
    height: PRIME_ARTWORK_SIZE,
    borderRadius: PRIME_ARTWORK_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.24)',
    backgroundColor: 'rgba(8,12,16,0.12)',
    shadowColor: GOLD,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  anchorImage: {
    width: PRIME_ARTWORK_SIZE,
    height: PRIME_ARTWORK_SIZE,
    borderRadius: PRIME_ARTWORK_SIZE / 2,
  },
  sigilFrame: {
    width: PRIME_ARTWORK_SIZE,
    height: PRIME_ARTWORK_SIZE,
    borderRadius: PRIME_ARTWORK_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,12,16,0.82)',
  },
  navBar: {
    width: '100%',
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  navButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  navBlur: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: 'rgba(8,12,16,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: SILVER,
    fontSize: 16,
    lineHeight: 16,
    marginTop: Platform.OS === 'android' ? -1 : 0,
  },
  panel: {
    flex: 1,
    backgroundColor: NAVY,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(212,175,55,0.2)',
    zIndex: 5,
  },
  panelSeam: {
    position: 'absolute',
    top: 0,
    left: '20%',
    right: '20%',
    height: 1,
  },
  panelContent: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  panelContentCompact: {
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  badgeRowCompact: {
    marginBottom: 12,
  },
  badgeLine: {
    flex: 1,
    height: 1,
  },
  badgeText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 3.5,
    color: GOLD_DIM,
    textAlign: 'center',
  },
  headline: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 24,
    lineHeight: 30,
    color: BONE,
    textAlign: 'center',
    marginBottom: 12,
  },
  headlineCompact: {
    fontSize: 19,
    lineHeight: 24,
    marginBottom: 9,
  },
  subline: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 15,
    lineHeight: 20,
    color: SILVER,
    opacity: 0.85,
    textAlign: 'center',
    marginBottom: 28,
  },
  sublineCompact: {
    fontSize: 13,
    lineHeight: 17,
    marginBottom: 22,
  },
  durationLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 3,
    color: GOLD_DIM,
    textAlign: 'center',
    marginBottom: 20,
  },
  durationLabelCompact: {
    marginBottom: 15,
  },
  locationPresetPill: {
    alignSelf: 'center',
    maxWidth: '100%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.24)',
    backgroundColor: 'rgba(212,175,55,0.07)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    alignItems: 'center',
  },
  locationPresetLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 8,
    letterSpacing: 2.2,
    color: GOLD_DIM,
    marginBottom: 4,
  },
  locationPresetText: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 13,
    lineHeight: 18,
    color: BONE,
    textAlign: 'center',
  },
  cardsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  cardsRowCompact: {
    gap: 8,
  },
  durationCard: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 0.8,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 18,
    minHeight: 150,
  },
  durationCardCompact: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 120,
  },
  durationCardSelected: {
    borderColor: 'rgba(212,175,55,0.4)',
    backgroundColor: 'rgba(212,175,55,0.08)',
    borderWidth: 1.2,
  },
  checkCircle: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 12,
  },
  cardIcon: {
    marginBottom: 10,
  },
  cardIconCompact: {
    marginBottom: 6,
  },
  cardName: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 12,
    letterSpacing: 1,
    color: BONE,
    textAlign: 'center',
    marginBottom: 4,
  },
  cardNameCompact: {
    fontSize: 10,
    marginBottom: 3,
  },
  cardNameSelected: {
    color: GOLD,
  },
  cardLine: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 11,
    lineHeight: 15,
    color: SILVER,
    opacity: 0.7,
    textAlign: 'center',
  },
  cardLineCompact: {
    fontSize: 9.5,
    lineHeight: 13,
  },
  cardLineTime: {
    color: BONE,
    opacity: 0.75,
    marginBottom: 4,
  },
  ctaTouchable: {
    width: '100%',
  },
  ctaButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: GOLD,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  ctaButtonCompact: {
    paddingVertical: 14,
  },
  ctaText: {
    fontFamily: 'Cinzel-Bold',
    fontSize: 13,
    letterSpacing: 3,
    color: BLACK,
  },
  ctaTextCompact: {
    fontSize: 12,
    letterSpacing: 2.4,
  },
  secondaryCtaButton: {
    marginTop: 20,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryCtaButtonCompact: {
    marginTop: 16,
  },
  secondaryCtaText: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 14,
    letterSpacing: 0.4,
    color: SILVER,
    opacity: 0.85,
  },
  secondaryCtaTextCompact: {
    fontSize: 13,
  },
  safetyText: {
    marginTop: 16,
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 12,
    color: SILVER,
    opacity: 0.45,
    textAlign: 'center',
  },
  safetyTextCompact: {
    marginTop: 13,
    fontSize: 11,
  },
  topContent: {
    width: '100%',
  },
  bottomActions: {
    marginTop: 32,
    width: '100%',
    alignItems: 'center',
  },
  bottomActionsCompact: {
    marginTop: 26,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: BLACK,
  },
  errorTitle: {
    fontFamily: 'Cinzel-SemiBold',
    fontSize: 24,
    color: BONE,
    marginBottom: spacing.md,
  },
  errorText: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 16,
    lineHeight: 22,
    color: SILVER,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  errorButton: {
    borderRadius: 14,
    backgroundColor: GOLD,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  errorButtonText: {
    fontFamily: 'Cinzel-Bold',
    fontSize: 13,
    letterSpacing: 1.4,
    color: BLACK,
  },
});
