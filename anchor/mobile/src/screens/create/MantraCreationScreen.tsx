/**
 * Anchor App - Mantra Creation Screen
 *
 * Step 8 in anchor creation flow.
 * Redesigned as a ritual tuning moment focused on embodied resonance.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Info, Lock, Pause, Play, Volume2 } from 'lucide-react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList, Anchor } from '@/types';
import { useAnchorStore } from '../../stores/anchorStore';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { useAuthStore } from '../../stores/authStore';
import { safeHaptics } from '@/utils/haptics';

type MantraCreationRouteProp = RouteProp<RootStackParamList, 'MantraCreation'>;
type MantraCreationNavigationProp = StackNavigationProp<RootStackParamList, 'MantraCreation'>;

interface MantraResult {
  syllabic: string;
  rhythmic: string;
  letterByLetter: string;
  phonetic: string;
}

type MantraStyle = keyof Omit<MantraResult, 'letterByLetter'>;
type VoiceTimbre = 'masculine' | 'feminine' | 'neutral';
type ResonanceMode = 'grounding' | 'energizing' | 'calming';

interface MantraStyleInfo {
  id: MantraStyle;
  title: string;
  description: string;
}

interface ResonancePlaybackProfile {
  timbre: VoiceTimbre;
  mode: ResonanceMode;
  rate: number;
  pitch: number;
  vowelStretch: number;
  roomSize: 'small-warm' | 'none';
}

const MANTRA_STYLES: MantraStyleInfo[] = [
  {
    id: 'rhythmic',
    title: 'Rhythmic Flow',
    description: 'Smooth and cyclical. Encourages steady breath and momentum.',
  },
  {
    id: 'syllabic',
    title: 'Deep Current',
    description: 'Low and grounding. Settles your breath into your chest and core.',
  },
  {
    id: 'phonetic',
    title: 'Clear Lift',
    description: 'Open and airy. Creates space without breaking your focus.',
  },
];

const BASE_PLAYBACK_PROFILE: ResonancePlaybackProfile = {
  timbre: 'neutral',
  mode: 'grounding',
  rate: 0.48,
  pitch: 0.72,
  vowelStretch: 1.45,
  roomSize: 'small-warm',
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const formatMantraForDisplay = (text: string) => text.replace(/\s*-\s*/g, ' \u00b7 ');

const buildVoicedResonanceText = (text: string, profile: ResonancePlaybackProfile) => {
  const compact = text.replace(/\s*-\s*/g, '').replace(/\s*\u00b7\s*/g, '').toLowerCase();
  return compact.replace(/[aeiou]/g, (vowel) => vowel.repeat(Math.max(2, Math.round(profile.vowelStretch))));
};

const buildSpeechOptions = (profile: ResonancePlaybackProfile) => {
  const modeRateAdjust: Record<ResonanceMode, number> = {
    grounding: -0.02,
    calming: -0.05,
    energizing: 0.06,
  };

  const timbrePitchAdjust: Record<VoiceTimbre, number> = {
    masculine: -0.08,
    neutral: 0,
    feminine: 0.1,
  };

  return {
    language: 'en-US',
    rate: Math.max(0.35, Math.min(0.7, profile.rate + modeRateAdjust[profile.mode])),
    pitch: Math.max(0.55, Math.min(1.0, profile.pitch + timbrePitchAdjust[profile.timbre])),
  };
};

export const MantraCreationScreen: React.FC = () => {
  const navigation = useNavigation<MantraCreationNavigationProp>();
  const route = useRoute<MantraCreationRouteProp>();
  const {
    intentionText,
    distilledLetters,
    baseSigilSvg,
    reinforcedSigilSvg,
    structureVariant,
    reinforcementMetadata,
    enhancementMetadata,
    finalImageUrl,
    category,
  } = route.params;

  const { addAnchor } = useAnchorStore();
  const { getEffectiveTier, setDevTierOverride, setDevOverrideEnabled } = useSubscriptionStore();
  const { anchorCount, incrementAnchorCount } = useAuthStore();

  const isPro = getEffectiveTier() === 'pro';
  const isFirstTime = anchorCount === 0;

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mantra, setMantra] = useState<MantraResult | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<MantraStyle>('rhythmic');
  const [speakingStyle, setSpeakingStyle] = useState<MantraStyle | null>(null);

  // Future-ready wiring for timbre/mode expansion.
  const [playbackProfile] = useState<ResonancePlaybackProfile>(BASE_PLAYBACK_PROFILE);

  const coreResonance = useMemo(() => {
    const normalizedLetters = distilledLetters
      .map((letter) => letter.replace(/[^a-z]/gi, '').charAt(0).toUpperCase())
      .filter(Boolean);

    if (normalizedLetters.length >= 4) {
      return normalizedLetters.slice(0, 4);
    }

    return [...normalizedLetters, 'L', 'R', 'N', 'T'].slice(0, 4);
  }, [distilledLetters]);

  useEffect(() => {
    if (!isPro && !isFirstTime && !isUnlocked) {
      handleSkip();
      return;
    }

    if ((isPro && !isFirstTime) || isUnlocked) {
      generateMantra();
    }
  }, [isPro, isUnlocked, isFirstTime]);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const handleSkip = () => {
    const anchorId = `temp-${Date.now()}`;
    const newAnchor: Anchor = {
      id: anchorId,
      userId: 'user-123',
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      reinforcedSigilSvg,
      structureVariant: structureVariant || 'balanced',
      reinforcementMetadata,
      enhancementMetadata,
      enhancedImageUrl: finalImageUrl,
      mantraText: '',
      isCharged: false,
      activationCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    addAnchor(newAnchor);
    incrementAnchorCount();
    navigation.navigate('ChargeSetup', { anchorId });
  };

  const buildPattern = (letters: string[], vowels: [string, string][]) =>
    letters
      .map((letter, index) => {
        const [start, end] = vowels[index % vowels.length];
        return `${start}${letter}${end}`;
      })
      .join('-')
      .toUpperCase();

  const generateMantra = async () => {
    setLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1300));

      const letters = coreResonance;

      const rhythmic = buildPattern(letters, [
        ['A', 'E'],
        ['E', 'I'],
        ['I', 'O'],
        ['O', 'U'],
      ]);

      const syllabic = buildPattern(letters, [
        ['U', 'O'],
        ['O', 'A'],
        ['A', 'U'],
        ['O', 'O'],
      ]);

      const phonetic = buildPattern(letters, [
        ['E', 'I'],
        ['I', 'E'],
        ['E', 'E'],
        ['I', 'I'],
      ]);

      setMantra({
        syllabic,
        rhythmic,
        phonetic,
        letterByLetter: coreResonance.join(' '),
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to shape your resonance options.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = () => {
    Alert.alert(
      'Unlock Voice Tuning',
      'Voice tuning is part of Anchor Pro. Upgrade to access full vocal resonance tools.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Upgrade to Pro ($4.99/mo)',
          onPress: () => {
            Alert.alert('Welcome to Pro', 'Voice tuning is now available.', [
              {
                text: 'Continue',
                onPress: () => {
                  setDevTierOverride('pro');
                  setDevOverrideEnabled(true);
                },
              },
            ]);
          },
        },
        {
          text: 'One-Time Unlock (Demo)',
          onPress: () => setIsUnlocked(true),
        },
      ]
    );
  };

  const handleSelectStyle = async (style: MantraStyle) => {
    setSelectedStyle(style);
    await safeHaptics.selection();
  };

  const stopSpeaking = () => {
    Speech.stop();
    setSpeakingStyle(null);
  };

  const handleSpeak = async (text: string, style: MantraStyle) => {
    if (!text || text === '...') {
      return;
    }

    if (speakingStyle === style) {
      stopSpeaking();
      await safeHaptics.selection();
      return;
    }

    stopSpeaking();
    setSelectedStyle(style);
    setSpeakingStyle(style);

    await safeHaptics.impact(Haptics.ImpactFeedbackStyle.Soft);

    const voicedText = buildVoicedResonanceText(text, playbackProfile);
    const speechOptions = buildSpeechOptions(playbackProfile);

    Speech.speak(voicedText, {
      ...speechOptions,
      onDone: () => setSpeakingStyle(null),
      onStopped: () => setSpeakingStyle(null),
      onError: () => setSpeakingStyle(null),
    });
  };

  const handleContinue = () => {
    if (!mantra) {
      return;
    }

    const anchorId = `temp-${Date.now()}`;

    const newAnchor: Anchor = {
      id: anchorId,
      userId: 'user-123',
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg,
      reinforcedSigilSvg,
      structureVariant: structureVariant || 'balanced',
      reinforcementMetadata,
      enhancementMetadata,
      enhancedImageUrl: finalImageUrl,
      mantraText: mantra[selectedStyle],
      isCharged: false,
      activationCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    addAnchor(newAnchor);
    incrementAnchorCount();
    navigation.navigate('ChargeSetup', { anchorId });
  };

  const renderIntroductionState = () => (
    <View style={styles.lockedContainer}>
      <GlassCard style={styles.lockedGlass}>
        <View style={styles.lockIconContainer}>
          {isPro ? <Volume2 size={40} color={colors.gold} /> : <Lock size={40} color={colors.gold} />}
        </View>

        <Text style={styles.lockedTitle}>{isPro ? 'Tune Your Voice Anchor' : 'Unlock Voice Tuning'}</Text>
        <Text style={styles.lockedText}>
          {isPro
            ? 'This is a quiet tuning moment. Listen for the resonance your body accepts first.'
            : 'Voice tuning is available in Pro for a full resonance selection experience.'}
        </Text>

        <TouchableOpacity
          style={styles.unlockButton}
          onPress={isPro ? generateMantra : handleUnlock}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isPro ? "Begin Tuning" : "Unlock Voice Tuning"}
        >
          <LinearGradient colors={[colors.gold, '#B8860B']} style={styles.gradientButton}>
            <Text style={styles.unlockButtonText}>{isPro ? 'Begin Tuning' : 'Unlock Voice Tuning'}</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSkip}
          style={styles.backLink}
          accessibilityRole="button"
          accessibilityLabel="Maybe later"
        >
          <Text style={styles.backLinkText}>Maybe later</Text>
        </TouchableOpacity>
      </GlassCard>
    </View>
  );

  const renderMantraSelection = () => (
    <View style={styles.selectionContainer}>
      <View style={styles.primerSection}>
        <GlassCard style={styles.primerCard}>
          <View style={styles.primerHeader}>
            <Info size={16} color={colors.gold} />
            <Text style={styles.primerTitle}>Sound Signature</Text>
          </View>

          <Text style={styles.primerText}>
            Each sound pattern carries a different resonance. Listen, feel, and choose the one that
            settles you.
          </Text>

          <View style={styles.tabContainer}>
            <View style={[styles.tab, styles.tabActive]}>
              <Text style={styles.tabTextActive}>Sonic</Text>
            </View>
            <View style={styles.tabMuted}>
              <Text style={styles.tabText}>Visual</Text>
              <Text style={styles.tabMeta}>Coming Soon</Text>
            </View>
            <View style={styles.tabMuted}>
              <Text style={styles.tabText}>Somatic</Text>
              <Text style={styles.tabMeta}>Coming Soon</Text>
            </View>
          </View>
        </GlassCard>
      </View>

      <View style={styles.coreStrip}>
        <Text style={styles.coreLabel}>Core Resonance</Text>
        <Text style={styles.coreValue}>{coreResonance.join('   ')}</Text>
      </View>

      <View>
        <View style={styles.tileList}>
          {MANTRA_STYLES.map((style) => {
            const mantraText = mantra?.[style.id] || '...';
            const isPlaying = speakingStyle === style.id;
            const isDimmed = Boolean(speakingStyle && speakingStyle !== style.id);

            return (
              <ResonanceTile
                key={style.id}
                styleInfo={style}
                mantraText={mantraText}
                isActive={selectedStyle === style.id}
                isPlaying={isPlaying}
                isDimmed={isDimmed}
                onSelect={() => handleSelectStyle(style.id)}
                onPlay={() => handleSpeak(mantraText, style.id)}
              />
            );
          })}
        </View>
      </View>
    </View>
  );

  const showSelection = (isPro && !isFirstTime) || isUnlocked || (mantra && !loading);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#06090F', '#0F1419', '#151C27']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Tune Your Voice Anchor</Text>
          <Text style={styles.subtitle}>Choose the sound your body responds to.</Text>
        </View>

        {showSelection ? (
          loading ? (
            <View style={styles.loadingContainer}>
              <GlassCard style={styles.loadingCard}>
                <ActivityIndicator size="large" color={colors.gold} />
                <Text style={styles.loadingText}>Shaping your resonance options...</Text>
              </GlassCard>
            </View>
          ) : (
            <>
              {renderMantraSelection()}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={handleContinue}
                  activeOpacity={0.9}
                  accessibilityRole="button"
                  accessibilityLabel="Continue to Ritual"
                >
                  <Text style={styles.continueText}>Continue to Ritual</Text>
                  <ChevronRight size={20} color={colors.charcoal} />
                </TouchableOpacity>
              </View>
            </>
          )
        ) : (
          renderIntroductionState()
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

function GlassCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  if (Platform.OS === 'android') {
    return <View style={[styles.glassFallback, style]}>{children}</View>;
  }

  return (
    <BlurView intensity={18} tint="dark" style={[styles.glassCard, style]}>
      {children}
    </BlurView>
  );
}

function ResonanceTile({
  styleInfo,
  mantraText,
  isActive,
  isPlaying,
  isDimmed,
  onSelect,
  onPlay,
}: {
  styleInfo: MantraStyleInfo;
  mantraText: string;
  isActive: boolean;
  isPlaying: boolean;
  isDimmed: boolean;
  onSelect: () => void;
  onPlay: () => void;
}) {
  const selectionProgress = useSharedValue(isActive ? 1 : 0);
  const playbackProgress = useSharedValue(isPlaying ? 1 : 0);
  const dimProgress = useSharedValue(isDimmed ? 1 : 0);
  const pressScale = useSharedValue(1);
  const pulseProgress = useSharedValue(0.2);

  useEffect(() => {
    selectionProgress.value = withTiming(isActive ? 1 : 0, {
      duration: 450,
      easing: Easing.out(Easing.cubic),
    });
  }, [isActive, selectionProgress]);

  useEffect(() => {
    dimProgress.value = withTiming(isDimmed ? 1 : 0, {
      duration: 380,
      easing: Easing.out(Easing.cubic),
    });
  }, [isDimmed, dimProgress]);

  useEffect(() => {
    if (isPlaying) {
      playbackProgress.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) });
      pulseProgress.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.35, { duration: 1500, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      );
    } else {
      playbackProgress.value = withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) });
      cancelAnimation(pulseProgress);
      pulseProgress.value = withTiming(0.2, { duration: 280, easing: Easing.out(Easing.cubic) });
    }
  }, [isPlaying, playbackProgress, pulseProgress]);

  const cardStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      selectionProgress.value,
      [0, 1],
      ['rgba(255, 255, 255, 0.08)', 'rgba(212, 175, 55, 0.82)']
    );

    return {
      opacity: interpolate(dimProgress.value, [0, 1], [1, 0.42]),
      borderColor,
      transform: [
        { scale: pressScale.value * interpolate(selectionProgress.value, [0, 1], [1, 1.02]) },
      ],
      shadowOpacity: interpolate(selectionProgress.value, [0, 1], [0.08, 0.28]) +
        interpolate(playbackProgress.value, [0, 1], [0, 0.15]),
      shadowRadius: interpolate(selectionProgress.value, [0, 1], [8, 16]),
      elevation: interpolate(selectionProgress.value, [0, 1], [1, 8]),
    };
  });

  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(playbackProgress.value, [0, 1], [0.08, 0.34]) * pulseProgress.value,
    transform: [{ scale: interpolate(pulseProgress.value, [0.2, 1], [0.96, 1.04]) }],
  }));

  const playButtonStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      playbackProgress.value,
      [0, 1],
      ['rgba(255, 255, 255, 0.06)', 'rgba(212, 175, 55, 0.22)']
    ),
    borderColor: interpolateColor(
      playbackProgress.value,
      [0, 1],
      ['rgba(255, 255, 255, 0.16)', 'rgba(212, 175, 55, 0.9)']
    ),
    transform: [{ scale: interpolate(playbackProgress.value, [0, 1], [1, 1.04]) }],
  }));

  return (
    <AnimatedPressable
      onPress={onSelect}
      onPressIn={() => {
        pressScale.value = withTiming(0.99, { duration: 120, easing: Easing.out(Easing.cubic) });
      }}
      onPressOut={() => {
        pressScale.value = withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) });
      }}
      style={[styles.resonanceTile, cardStyle]}
      accessibilityRole="button"
      accessibilityLabel={styleInfo.title}
      accessibilityState={{ selected: isActive }}
    >
      <GlassCard style={styles.resonanceTileGlass}>
        <View style={styles.tileHeader}>
          <Text style={styles.tileTitle}>{styleInfo.title}</Text>
          {isActive ? <Text style={styles.tileActiveLabel}>Selected</Text> : null}
        </View>

        <Text style={styles.tileDescription}>{styleInfo.description}</Text>

        <View style={styles.mantraStage}>
          <Animated.View style={[styles.mantraHalo, haloStyle]} />
          <Text style={styles.mantraText}>{formatMantraForDisplay(mantraText)}</Text>
        </View>

        <AnimatedPressable
          style={[styles.playButton, playButtonStyle]}
          onPress={onPlay}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={20} color={colors.gold} /> : <Play size={20} color={colors.bone} fill={colors.bone} />}
        </AnimatedPressable>
      </GlassCard>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 140,
  },
  header: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    alignItems: 'center',
  },
  title: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  loadingContainer: {
    marginTop: spacing.md,
  },
  loadingCard: {
    borderRadius: 24,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.secondary,
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
  },
  lockedContainer: {
    marginTop: spacing.md,
  },
  lockedGlass: {
    borderRadius: 24,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.24)',
  },
  lockIconContainer: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    marginBottom: spacing.lg,
  },
  lockedTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  lockedText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  unlockButton: {
    width: '100%',
    borderRadius: 28,
    height: 56,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  gradientButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockButtonText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
    letterSpacing: 0.8,
  },
  backLink: {
    paddingVertical: spacing.xs,
  },
  backLinkText: {
    color: colors.text.tertiary,
    fontFamily: typography.fonts.body,
    textDecorationLine: 'underline',
  },
  selectionContainer: {
    gap: spacing.md,
  },
  primerSection: {
    marginTop: spacing.xs,
  },
  primerCard: {
    borderRadius: 22,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
  },
  primerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primerTitle: {
    marginLeft: spacing.xs,
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
  },
  primerText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  tabContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tab: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  tabActive: {
    backgroundColor: colors.gold,
  },
  tabMuted: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
  },
  tabText: {
    fontSize: 12,
    fontFamily: typography.fonts.bodyBold,
    color: 'rgba(245, 245, 220, 0.72)',
  },
  tabTextActive: {
    fontSize: 12,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
  },
  tabMeta: {
    fontSize: 9,
    fontFamily: typography.fonts.body,
    color: 'rgba(245, 245, 220, 0.42)',
    marginTop: 1,
  },
  coreStrip: {
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.16)',
    backgroundColor: 'rgba(4, 8, 14, 0.65)',
    alignItems: 'center',
  },
  coreLabel: {
    fontSize: 10,
    letterSpacing: 1.25,
    textTransform: 'uppercase',
    color: 'rgba(245, 245, 220, 0.62)',
    fontFamily: typography.fonts.bodyBold,
    marginBottom: 4,
  },
  coreValue: {
    fontSize: 15,
    letterSpacing: 6,
    color: 'rgba(245, 245, 220, 0.68)',
    fontFamily: typography.fonts.mono,
  },
  tileList: {
    gap: spacing.md,
  },
  resonanceTile: {
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: colors.ritual.glass,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
  },
  resonanceTileGlass: {
    borderRadius: 22,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.12)',
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  tileTitle: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
  },
  tileActiveLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.gold,
    fontFamily: typography.fonts.bodyBold,
  },
  tileDescription: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  mantraStage: {
    height: 78,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(8, 12, 19, 0.75)',
    overflow: 'hidden',
  },
  mantraHalo: {
    position: 'absolute',
    width: '84%',
    height: '78%',
    borderRadius: 999,
    backgroundColor: 'rgba(212, 175, 55, 0.26)',
  },
  mantraText: {
    fontSize: 26,
    fontFamily: typography.fonts.heading,
    color: colors.bone,
    letterSpacing: 1.6,
    textAlign: 'center',
  },
  playButton: {
    alignSelf: 'center',
    marginTop: spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  footer: {
    marginTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  continueButton: {
    height: 58,
    borderRadius: 30,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.34,
    shadowRadius: 14,
    elevation: 7,
  },
  continueText: {
    color: colors.charcoal,
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    marginRight: spacing.xs,
    letterSpacing: 0.7,
  },
  glassCard: {
    overflow: 'hidden',
  },
  glassFallback: {
    backgroundColor: 'rgba(18, 24, 32, 0.82)',
  },
});
