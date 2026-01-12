/**
 * Anchor App - Mantra Creation Screen (Phase 2.5)
 *
 * Step 8 in anchor creation flow.
 * User generates and selects from 3 mantra styles.
 * Features: Pro gating, TTS playback, educational content.
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import * as Speech from 'expo-speech';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, Volume2, Play, Pause, RefreshCw, ChevronRight, Info } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/types';

type MantraCreationRouteProp = RouteProp<RootStackParamList, 'MantraCreation'>;
type MantraCreationNavigationProp = StackNavigationProp<RootStackParamList, 'MantraCreation'>;

/**
 * Mantra result from backend
 */
interface MantraResult {
  syllabic: string;
  rhythmic: string;
  letterByLetter: string;
  phonetic: string;
}

type MantraStyle = keyof Omit<MantraResult, 'letterByLetter'>;

interface MantraStyleInfo {
  id: MantraStyle;
  title: string;
  description: string;
  icon: string;
}

const MANTRA_STYLES: MantraStyleInfo[] = [
  {
    id: 'rhythmic',
    title: 'Rhythmic "V-C-V"',
    description: 'Focuses on flow. Follows a Vowel-Consonant-Vowel pattern ensuring words loop without "tripping" your tongue.',
    icon: '🌊',
  },
  {
    id: 'syllabic',
    title: 'Ancient Guttural',
    description: 'Heavy and grounded. Uses deep vowels like U, O, and A to create a vibrating sound in the chest.',
    icon: '🌋',
  },
  {
    id: 'phonetic',
    title: 'Light & Airy',
    description: 'Speed and clarity. Uses high vowels like I and E to resonate in the throat and head.',
    icon: '🌬️',
  },
];

export const MantraCreationScreen: React.FC = () => {
  const navigation = useNavigation<MantraCreationNavigationProp>();
  const route = useRoute<MantraCreationRouteProp>();
  const { intentionText, distilledLetters } = route.params;

  // Mock User State (Replace with real auth/subscription context later)
  const [isPro, setIsPro] = useState(false); // Default to FREE for testing
  const [isUnlocked, setIsUnlocked] = useState(false); // Temporary unlock for session

  const [loading, setLoading] = useState(false);
  const [mantra, setMantra] = useState<MantraResult | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<MantraStyle>('phonetic');
  const [speakingStyle, setSpeakingStyle] = useState<MantraStyle | null>(null);

  useEffect(() => {
    // Determine if we should auto-generate
    // If Pro or Unlocked, generate immediately.
    // If Free, show the "Locked" state first.
    if (isPro || isUnlocked) {
      generateMantra();
    }
  }, [isPro, isUnlocked]);

  const generateMantra = async () => {
    setLoading(true);
    try {
      // Mock API call for MVP - later replace with real backend
      await new Promise(resolve => setTimeout(resolve, 1500));

      const letters = distilledLetters.slice(0, 4); // Use first 4 letters for consistency

      // 1. Rhythmic V-C-V: AS-AG-EL pattern
      const rhythmic = letters.map((l, i) => {
        const vowels = ['A', 'E', 'I', 'O', 'U'];
        const v1 = vowels[i % vowels.length];
        return `${v1}${l}${vowels[(i + 1) % vowels.length]}`;
      }).join('-').toUpperCase();

      // 2. Ancient Guttural: SOG-UL-AR pattern (U, O, A)
      const gutturalVowels = ['U', 'O', 'A'];
      const syllabic = letters.map((l, i) => {
        const v = gutturalVowels[i % gutturalVowels.length];
        return `${l}${v}${letters[(i + 1) % letters.length] || 'R'}`;
      }).join('-').toUpperCase();

      // 3. Light & Airy: SIE-GIL-IE pattern (I, E)
      const lightVowels = ['I', 'E'];
      const phonetic = letters.map((l, i) => {
        const v = lightVowels[i % lightVowels.length];
        return `${l}${v}${lightVowels[(i + 1) % lightVowels.length]}`;
      }).join('-').toUpperCase();

      setMantra({
        syllabic,
        rhythmic,
        phonetic,
        letterByLetter: distilledLetters.join(' '),
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to generate mantra');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlock = () => {
    Alert.alert(
      "Unlock Mantra Forge",
      "Mantras are a Pro feature. Upgrade to Anchor Pro to create unlimited custom mantras for your rituals.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Upgrade to Pro ($4.99/mo)",
          onPress: () => {
            // Mock upgrade flow
            Alert.alert("Welcome to Pro!", "You now have access to Mantra creation.", [
              { text: "Let's Go", onPress: () => setIsPro(true) }
            ]);
          }
        },
        {
          text: "One-Time Unlock (Demo)",
          onPress: () => setIsUnlocked(true)
        }
      ]
    );
  };

  const handleSpeak = (text: string, style: MantraStyle) => {
    if (speakingStyle === style) {
      Speech.stop();
      setSpeakingStyle(null);
    } else {
      setSpeakingStyle(style);
      Speech.speak(text, {
        language: 'en',
        rate: 0.8,
        pitch: 0.9,
        onDone: () => setSpeakingStyle(null),
        onError: () => setSpeakingStyle(null),
      });
    }
  };

  const handleContinue = () => {
    if (!mantra) return;
    navigation.navigate('ChargeChoice', {
      anchorId: `temp-${Date.now()}`,
    });
  };

  const renderLockedState = () => (
    <View style={styles.lockedContainer}>
      <View style={styles.lockIconContainer}>
        <Lock size={64} color={colors.gold} />
      </View>
      <Text style={styles.lockedTitle}>Unlock Your Mantra</Text>
      <Text style={styles.lockedText}>
        Mantras are powerful sonic anchors that amplify your intention during rituals.
        Generate custom mantras based on your specific sigil.
      </Text>

      <TouchableOpacity
        style={styles.unlockButton}
        onPress={handleUnlock}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[colors.gold, '#B8860B']}
          style={styles.gradientButton}
        >
          <Text style={styles.unlockButtonText}>Generate Mantras (Pro)</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
        <Text style={styles.backLinkText}>Maybe later</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMantraSelection = () => (
    <View style={styles.selectionContainer}>
      <View style={styles.heroSection}>
        <LinearGradient
          colors={['rgba(62, 44, 91, 0.8)', 'rgba(15, 20, 25, 1)']}
          style={styles.heroGradient}
        >
          <View style={styles.heroHeader}>
            <Info size={20} color={colors.gold} />
            <Text style={styles.heroTitle}>Mantra Mastery</Text>
          </View>
          <Text style={styles.heroText}>
            Vibrational anchors bridge the conscious and subconscious. Select a resonance pattern that aligns with your intent.
          </Text>

          <View style={styles.tabContainer}>
            <View style={[styles.tab, styles.tabActive]}>
              <Text style={styles.tabTextActive}>Sonic</Text>
            </View>
            <View style={styles.tab}>
              <Text style={styles.tabText}>Visual</Text>
            </View>
            <View style={styles.tab}>
              <Text style={styles.tabText}>Somatic</Text>
            </View>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.sourceContainer}>
        <Text style={styles.sourceLabel}>CORE RESONANCE: </Text>
        <Text style={styles.sourceValue}>{distilledLetters.join(' ')}</Text>
      </View>

      <View style={styles.stylesList}>
        {MANTRA_STYLES.map((style) => {
          const isActive = selectedStyle === style.id;
          const mantraText = mantra?.[style.id] || '...';
          const isSpeaking = speakingStyle === style.id;

          return (
            <TouchableOpacity
              key={style.id}
              style={[styles.premiumCard, isActive && styles.premiumCardActive]}
              onPress={() => setSelectedStyle(style.id)}
              activeOpacity={0.9}
            >
              <View style={styles.premiumCardContent}>
                <View style={styles.premiumIconContainer}>
                  <Text style={styles.premiumIcon}>{style.icon}</Text>
                </View>
                <View style={styles.premiumTextContainer}>
                  <Text style={[styles.premiumTitle, isActive && styles.textActive]}>{style.title}</Text>
                  <Text style={styles.premiumDesc} numberOfLines={2}>{style.description}</Text>
                </View>
                {isActive && (
                  <View style={styles.premiumCheck}>
                    <Play size={12} fill={colors.gold} color={colors.gold} />
                  </View>
                )}
              </View>

              <View style={styles.premiumMantraBox}>
                <Text style={[styles.premiumMantraText, isActive && styles.textActive]}>{mantraText}</Text>
                <TouchableOpacity
                  style={styles.premiumSpeaker}
                  onPress={() => handleSpeak(mantraText, style.id)}
                >
                  {isSpeaking ? (
                    <ActivityIndicator size="small" color={colors.gold} />
                  ) : (
                    <Volume2 size={20} color={isActive ? colors.gold : colors.text.tertiary} />
                  )}
                </TouchableOpacity>
              </View>

              {isActive && <View style={styles.activeIndicator} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Sonic Anchor</Text>
          <Text style={styles.subtitle}>
            Create a unique sound resonance for your intention.
          </Text>
        </View>

        {(isPro || isUnlocked) ? (
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.gold} />
              <Text style={styles.loadingText}>Synthesizing resonance...</Text>
            </View>
          ) : (
            <>
              {renderMantraSelection()}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={handleContinue}
                >
                  <Text style={styles.continueText}>Continue to Ritual</Text>
                  <ChevronRight size={20} color={colors.charcoal} />
                </TouchableOpacity>
              </View>
            </>
          )
        ) : (
          renderLockedState()
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: 150, // Increased to ensure footer clears tab bar
  },
  header: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  title: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.text.tertiary,
    fontFamily: typography.fonts.body,
  },
  // Locked State
  lockedContainer: {
    backgroundColor: colors.background.card,
    borderRadius: 24,
    padding: spacing.xl,
    alignItems: 'center',
    marginVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.deepPurple,
  },
  lockIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  lockedTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  lockedText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  unlockButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  gradientButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unlockButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  backLink: {
    padding: spacing.sm,
  },
  backLinkText: {
    color: colors.text.tertiary,
    fontFamily: typography.fonts.body,
    textDecorationLine: 'underline',
  },
  // Selection State
  // New Premium Design Styles
  selectionContainer: {
    gap: spacing.lg,
  },
  heroSection: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  heroGradient: {
    padding: spacing.xl,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: 20,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginLeft: spacing.xs,
  },
  heroText: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 22,
    fontFamily: typography.fonts.body,
    marginBottom: spacing.lg,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabActive: {
    backgroundColor: colors.gold,
  },
  tabText: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontFamily: typography.fonts.bodyBold,
  },
  tabTextActive: {
    fontSize: 12,
    color: colors.charcoal,
    fontFamily: typography.fonts.bodyBold,
  },
  sourceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
  },
  sourceLabel: {
    fontSize: 10,
    color: colors.text.tertiary,
    fontFamily: typography.fonts.bodyBold,
    letterSpacing: 1,
  },
  sourceValue: {
    fontSize: 14,
    color: colors.gold,
    fontFamily: typography.fonts.mono,
    letterSpacing: 4,
  },
  stylesList: {
    gap: spacing.md,
  },
  premiumCard: {
    backgroundColor: colors.background.card,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  premiumCardActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.05)',
  },
  premiumCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  premiumIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  premiumIcon: {
    fontSize: 24,
  },
  premiumTextContainer: {
    flex: 1,
  },
  premiumTitle: {
    fontSize: 17,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: 4,
  },
  premiumDesc: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontFamily: typography.fonts.body,
    lineHeight: 18,
  },
  premiumCheck: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumMantraBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    padding: spacing.md,
    height: 64,
  },
  premiumMantraText: {
    flex: 1,
    fontSize: 20,
    fontFamily: typography.fonts.heading,
    color: colors.text.secondary,
    textAlign: 'center',
    letterSpacing: 2,
  },
  premiumSpeaker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.gold,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  textActive: {
    color: colors.gold,
  },
  footer: {
    marginTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  continueButton: {
    backgroundColor: colors.gold,
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  continueText: {
    fontSize: 16,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
    marginRight: spacing.xs,
    letterSpacing: 1.5,
  },
});
