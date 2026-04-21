import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { type StackNavigationProp } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAnchorStore } from '@/stores/anchorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { safeHaptics } from '@/utils/haptics';
import { OptimizedImage } from '@/components/common';
import { PrimeAnchorCanvas, parseSigilSvg } from '@/components/common/PrimeAnchorCanvas';
import type { Anchor, RootStackParamList } from '@/types';
import { spacing } from '@/theme';
import { navigateToVaultDestination } from '@/navigation/firstAnchorGate';

type ChargeSetupRouteProp = RouteProp<RootStackParamList, 'ChargeSetup'>;
type ChargeSetupNavigationProp = StackNavigationProp<RootStackParamList, 'ChargeSetup'>;
type DurationChoice = 'quick' | 'deep';

const NAVY = '#0F1419';
const GOLD = '#D4AF37';
const GOLD_DIM = '#A8892A';
const BONE = '#F5F5DC';
const SILVER = '#C0C0C0';
const BLACK = '#080C10';
const PANEL_OVERLAP = 24;
const PRIME_ARTWORK_SIZE = 214;

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


const chargeConfigByChoice = {
  quick: {
    mode: 'focus' as const,
    preset: '30s' as const,
    customMinutes: undefined,
    ritualType: 'focus' as const,
    durationSeconds: 30,
    icon: '⚡',
    name: 'Quick Prime',
    lineOne: '30 seconds',
    lineTwo: 'Daily reset',
  },
  deep: {
    mode: 'ritual' as const,
    preset: 'custom' as const,
    customMinutes: 3,
    ritualType: 'ritual' as const,
    durationSeconds: 180,
    icon: '🔥',
    name: 'Deep Prime',
    lineOne: '3 minutes',
    lineTwo: 'Deep focus',
  },
};

const getPrimeStructureSvg = (anchor?: Anchor): string =>
  anchor?.baseSigilSvg?.trim() || anchor?.reinforcedSigilSvg?.trim() || FALLBACK_SIGIL_SVG;

const getParsedSigil = (anchor?: Anchor) =>
  parseSigilSvg(getPrimeStructureSvg(anchor));

export const ChargeSetupScreen: React.FC = () => {
  const navigation = useNavigation<ChargeSetupNavigationProp>();
  const route = useRoute<ChargeSetupRouteProp>();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const { anchorId, returnTo, autoStartOnSelection = false } = route.params || {};

  const getAnchorById = useAnchorStore((state) => state.getAnchorById);
  const setDefaultCharge = useSettingsStore((state) => state.setDefaultCharge);
  const anchor = getAnchorById(anchorId);

  const [selectedDuration, setSelectedDuration] = useState<DurationChoice>('quick');
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [enhancedArtworkFailed, setEnhancedArtworkFailed] = useState(false);

  const isNavigatingRef = useRef(false);
  const heroHeight = Math.max(400, Math.min(580, Math.round(screenHeight * 0.65)));
  const shouldShowEnhancedArtwork = Boolean(anchor?.enhancedImageUrl) && !enhancedArtworkFailed;

  // Parse sigil paths once — stable for this anchor
  const { pathDs: sigilPaths, viewBox: sigilViewBox } = useMemo(
    () => getParsedSigil(anchor),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anchor?.id],
  );

  // Reanimated 3 drift — passed into PrimeAnchorCanvas and image wrapper
  const driftSV = useSharedValue(0);
  const driftStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: driftSV.value }],
  }));

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => setReduceMotionEnabled(v));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (isEnabled: boolean) => setReduceMotionEnabled(isEnabled));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    setEnhancedArtworkFailed(false);
  }, [anchor?.id, anchor?.enhancedImageUrl]);

  useEffect(() => {
    if (reduceMotionEnabled) {
      driftSV.value = 0;
      return;
    }
    driftSV.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2800 }),
        withTiming(0, { duration: 2800 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(driftSV);
  }, [reduceMotionEnabled, driftSV]);

  useFocusEffect(
    useCallback(() => {
      isNavigatingRef.current = false;
      setIsTransitioning(false);

      const onBackPress = () => isTransitioning;
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [isTransitioning])
  );

  const navigateToRitual = useCallback(
    (choice: DurationChoice) => {
      const config = chargeConfigByChoice[choice];
      navigation.navigate('Ritual', {
        anchorId,
        ritualType: config.ritualType,
        durationSeconds: config.durationSeconds,
        returnTo,
      });
    },
    [anchorId, navigation, returnTo]
  );

  const handleBeginRitual = useCallback(
    (choice: DurationChoice = selectedDuration) => {
      if (isNavigatingRef.current || isTransitioning) return;

      const config = chargeConfigByChoice[choice];
      isNavigatingRef.current = true;
      setIsTransitioning(true);

      setDefaultCharge({
        mode: config.mode,
        preset: config.preset,
        customMinutes: config.customMinutes,
      });

      void safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);
      navigateToRitual(choice);
    },
    [isTransitioning, navigateToRitual, selectedDuration, setDefaultCharge]
  );

  const handleSelectDuration = useCallback(
    (choice: DurationChoice) => {
      if (isTransitioning) return;
      setSelectedDuration(choice);
      void safeHaptics.selection();

      if (autoStartOnSelection) {
        handleBeginRitual(choice);
      }
    },
    [autoStartOnSelection, handleBeginRitual, isTransitioning]
  );

  const handleBack = useCallback(() => {
    if (isTransitioning) return;
    if (autoStartOnSelection) {
      // Came from creation flow — navigate to Vault so the new anchor is visible
      navigateToVaultDestination(navigation);
    } else {
      navigation.goBack();
    }
  }, [isTransitioning, navigation, autoStartOnSelection]);

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
    <View style={styles.screen}>
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

        {/* Single-pass Skia canvas: aura + rings + particles + sigil (SVG mode) */}
        <PrimeAnchorCanvas
          size={heroHeight}
          sigilPaths={shouldShowEnhancedArtwork ? [] : sigilPaths}
          viewBox={sigilViewBox}
          drift={driftSV}
          reduceMotionEnabled={reduceMotionEnabled}
        />

        {/* Enhanced image overlay — only visible when image is available */}
        {shouldShowEnhancedArtwork && anchor?.enhancedImageUrl ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.anchorOverlay, driftStyle]}
          >
            <View style={styles.anchorFrame}>
              <OptimizedImage
                uri={anchor.enhancedImageUrl}
                style={styles.anchorImage}
                resizeMode="cover"
                onError={() => setEnhancedArtworkFailed(true)}
              />
            </View>
          </Animated.View>
        ) : null}

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

          <View style={styles.titleShell}>
            <BlurView intensity={18} tint="dark" style={styles.titleBlur}>
              <Text style={styles.navTitle}>Prime Your Anchor</Text>
            </BlurView>
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
          contentContainerStyle={styles.panelContent}
        >
          <View style={styles.badgeRow}>
            <LinearGradient
              colors={['transparent', 'rgba(212,175,55,0.3)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.badgeLine}
            />
            <Text style={styles.badgeText}>YOUR ANCHOR IS FORGED</Text>
            <LinearGradient
              colors={['rgba(212,175,55,0.3)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.badgeLine}
            />
          </View>

          <Text style={styles.headline}>Set Your Intention in Motion</Text>
          <Text style={styles.subline}>Hold focus on your anchor.{'\n'}Choose how long to prime.</Text>
          <Text style={styles.durationLabel}>SELECT DURATION</Text>

          <View style={styles.cardsRow}>
            {cards.map((card) => (
              <TouchableOpacity
                key={card.choice}
                activeOpacity={0.88}
                onPress={() => handleSelectDuration(card.choice)}
                accessibilityRole="radio"
                accessibilityLabel={`${card.name} duration`}
                accessibilityState={{ selected: card.isSelected }}
                disabled={isTransitioning}
                style={[styles.durationCard, card.isSelected ? styles.durationCardSelected : null]}
              >
                {card.isSelected ? (
                  <View style={styles.checkCircle}>
                    <Text style={styles.checkText}>✓</Text>
                  </View>
                ) : null}
                <Text style={styles.cardIcon}>{card.icon}</Text>
                <Text style={[styles.cardName, card.isSelected ? styles.cardNameSelected : null]}>{card.name}</Text>
                <Text style={styles.cardLine}>{card.lineOne}</Text>
                <Text style={styles.cardLine}>{card.lineTwo}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => handleBeginRitual()}
            activeOpacity={0.9}
            disabled={isTransitioning}
            accessibilityRole="button"
            accessibilityLabel="BEGIN PRIMING"
            style={styles.ctaTouchable}
          >
            <LinearGradient
              colors={['#C9A227', '#D4AF37', '#E8C84A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.ctaButton}
            >
              <Text style={styles.ctaText}>BEGIN PRIMING</Text>
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.safetyText}>You can stop anytime.</Text>
        </ScrollView>
      </View>

      {/*
        DEFERRED: old ChargeSetupScreen UI
        <ScrollView>{legacy ChargedGlowCanvas/PremiumAnchorGlow prime-selection layout}</ScrollView>
      */}
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
  anchorOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 32,
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
  },
  anchorImage: {
    width: PRIME_ARTWORK_SIZE,
    height: PRIME_ARTWORK_SIZE,
    borderRadius: PRIME_ARTWORK_SIZE / 2,
  },
  navBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  titleShell: {
    flex: 1,
    marginRight: 52,
    borderRadius: 24,
    overflow: 'hidden',
  },
  titleBlur: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.25)',
    backgroundColor: 'rgba(8,12,16,0.7)',
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  navTitle: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 13,
    letterSpacing: 1.6,
    color: GOLD,
    textAlign: 'center',
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
    paddingTop: 32,
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
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
    fontSize: 26,
    lineHeight: 32,
    color: BONE,
    textAlign: 'center',
    marginBottom: 10,
  },
  subline: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 16,
    lineHeight: 22,
    color: SILVER,
    opacity: 0.85,
    textAlign: 'center',
    marginBottom: 28,
  },
  durationLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 3,
    color: GOLD_DIM,
    textAlign: 'center',
    marginBottom: 14,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  durationCard: {
    flex: 1,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 12,
    paddingVertical: 18,
    minHeight: 144,
  },
  durationCardSelected: {
    borderColor: 'rgba(212,175,55,0.45)',
    backgroundColor: 'rgba(212,175,55,0.10)',
    shadowColor: GOLD,
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
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
    fontSize: 26,
    marginBottom: 10,
  },
  cardName: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 12,
    letterSpacing: 1,
    color: BONE,
    textAlign: 'center',
    marginBottom: 6,
  },
  cardNameSelected: {
    color: GOLD,
  },
  cardLine: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 12,
    lineHeight: 16,
    color: SILVER,
    opacity: 0.7,
    textAlign: 'center',
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
  ctaText: {
    fontFamily: 'Cinzel-Bold',
    fontSize: 13,
    letterSpacing: 3,
    color: BLACK,
  },
  safetyText: {
    marginTop: 14,
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 13,
    color: SILVER,
    opacity: 0.5,
    textAlign: 'center',
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
