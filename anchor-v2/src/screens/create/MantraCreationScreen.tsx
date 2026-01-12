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
    id: 'syllabic',
    title: 'Syllabic',
    description: 'Short, rhythmic power chants.',
    icon: '⚡',
  },
  {
    id: 'phonetic',
    title: 'Phonetic',
    description: 'Flowing and easy to speak.',
    icon: '🗣️',
  },
  {
    id: 'rhythmic',
    title: 'Rhythmic',
    description: 'Meditative cycles of sound.',
    icon: '🌊',
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

      // Simple mock generation algorithm for demo purposes
      const seed = distilledLetters.join('');
      setMantra({
        syllabic: seed.match(/.{1,2}/g)?.join(' - ') || seed,
        rhythmic: seed.match(/.{1,3}/g)?.join(' ... ') || seed,
        phonetic: seed.split('').join('-').toLowerCase(),
        letterByLetter: seed.split('').join(' '),
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
      <View style={styles.educationCard}>
        <View style={styles.educationHeader}>
          <Info size={18} color={colors.gold} />
          <Text style={styles.educationTitle}>Why use a Mantra?</Text>
        </View>
        <Text style={styles.educationText}>
          Chanting your mantra during the activation ritual creates a vibrational resonance that
          helps embed your intention into your subconscious mind.
        </Text>
      </View>

      <View style={styles.distilledContainer}>
        <Text style={styles.distilledLabel}>Source: </Text>
        <Text style={styles.distilledValue}>{distilledLetters.join(' ')}</Text>
      </View>

      <Text style={styles.sectionTitle}>Choose Style</Text>

      {MANTRA_STYLES.map((style) => {
        const isActive = selectedStyle === style.id;
        const mantraText = mantra?.[style.id] || '...';
        const isSpeaking = speakingStyle === style.id;

        return (
          <TouchableOpacity
            key={style.id}
            style={[styles.styleCard, isActive && styles.styleCardActive]}
            onPress={() => setSelectedStyle(style.id)}
            activeOpacity={0.9}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.styleIcon}>{style.icon}</Text>
              <View style={styles.headerText}>
                <Text style={[styles.styleTitle, isActive && styles.textActive]}>{style.title}</Text>
                <Text style={styles.styleDesc}>{style.description}</Text>
              </View>
              {isActive && <View style={styles.checkCircle}><View style={styles.checkDot} /></View>}
            </View>

            <View style={styles.mantraDisplay}>
              <Text style={[styles.mantraText, isActive && styles.textActive]}>{mantraText}</Text>
              <TouchableOpacity
                style={styles.speakerButton}
                onPress={() => handleSpeak(mantraText, style.id)}
              >
                {isSpeaking ? <RefreshCw size={20} color={colors.gold} /> : <Volume2 size={20} color={isActive ? colors.gold : colors.text.secondary} />}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      })}
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
  selectionContainer: {
    gap: spacing.md,
  },
  distilledContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    opacity: 0.7,
  },
  distilledLabel: {
    color: colors.text.tertiary,
    fontFamily: typography.fonts.body,
  },
  distilledValue: {
    color: colors.gold,
    fontFamily: typography.fonts.mono,
    letterSpacing: 2,
  },
  sectionTitle: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  styleCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    marginBottom: spacing.sm,
  },
  styleCardActive: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(62, 44, 91, 0.3)', // deepPurple with opacity
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  styleIcon: {
    fontSize: 24,
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  styleTitle: {
    fontSize: 16,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: 2,
  },
  styleDesc: {
    fontSize: 12,
    color: colors.text.tertiary,
    fontFamily: typography.fonts.body,
  },
  textActive: {
    color: colors.gold,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gold,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.gold,
  },
  mantraDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: spacing.md,
  },
  mantraText: {
    flex: 1,
    fontSize: 18,
    fontFamily: typography.fonts.heading,
    color: colors.text.secondary,
    textAlign: 'center',
    letterSpacing: 1,
  },
  speakerButton: {
    padding: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    marginLeft: spacing.sm,
  },
  educationCard: {
    backgroundColor: 'rgba(212, 175, 55, 0.1)', // Gold with low opacity
    padding: spacing.md,
    borderRadius: 12,
    marginTop: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  educationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  educationTitle: {
    fontSize: 14,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    marginLeft: spacing.xs,
  },
  educationText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 20,
    fontFamily: typography.fonts.body,
  },
  footer: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    backgroundColor: 'transparent',
  },
  continueButton: {
    backgroundColor: colors.gold,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueText: {
    fontSize: 16,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
    marginRight: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

