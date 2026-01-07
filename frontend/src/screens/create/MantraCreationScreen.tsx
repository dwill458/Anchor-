/**
 * Anchor App - Mantra Creation Screen
 *
 * Step 8 in anchor creation flow (after AIVariationPicker or EnhancementChoice-Traditional).
 * User generates and selects from 3 mantra styles.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
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

type MantraStyle = keyof MantraResult;

/**
 * Mantra style info
 */
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
    description: '2-letter chunks for rhythmic chanting. Short and powerful.',
    icon: '🎵',
  },
  {
    id: 'phonetic',
    title: 'Phonetic',
    description: 'Simplified pronunciation with vowels. Easy to speak aloud.',
    icon: '🗣️',
  },
  {
    id: 'rhythmic',
    title: 'Rhythmic',
    description: '3-letter groups with pauses. Meditative and flowing.',
    icon: '🌊',
  },
];

/**
 * MantraCreationScreen Component
 */
export const MantraCreationScreen: React.FC = () => {
  const navigation = useNavigation<MantraCreationNavigationProp>();
  const route = useRoute<MantraCreationRouteProp>();

  const { intentionText, distilledLetters, sigilSvg, finalImageUrl } = route.params;

  const [loading, setLoading] = useState(true);
  const [mantra, setMantra] = useState<MantraResult | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<MantraStyle>('phonetic');
  const [error, setError] = useState<string | null>(null);

  /**
   * Generate mantra on mount
   */
  useEffect(() => {
    generateMantra();
  }, []);

  /**
   * Call backend to generate mantra
   */
  const generateMantra = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

      const response = await fetch(`${API_URL}/api/ai/mantra`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          distilledLetters,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate mantra');
      }

      const data = await response.json();
      setMantra(data.mantra);
      setSelectedStyle(data.recommended || 'phonetic');
    } catch (err) {
      console.error('Mantra generation error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Continue to charging (save anchor first)
   */
  const handleContinue = async (): Promise<void> => {
    if (!mantra) return;

    const selectedMantraText = mantra[selectedStyle];

    // TODO: Save anchor to backend and get anchor ID
    // For now, navigate to ChargeChoice with temporary data

    navigation.navigate('ChargeChoice', {
      anchorId: `temp-${Date.now()}`, // TODO: Replace with real anchor ID from backend
      // TODO: Pass additional anchor data if needed
    });
  };

  /**
   * Play mantra audio (future feature with TTS)
   */
  const handlePlayAudio = (style: MantraStyle): void => {
    // TODO: Implement audio playback with Google TTS
    console.log('Playing audio for style:', style);
    alert('Audio playback coming in Phase 2.5! (Google TTS integration)');
  };

  /**
   * Loading state
   */
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.loadingText}>Generating your mantra...</Text>
        </View>
      </SafeAreaView>
    );
  }

  /**
   * Error state
   */
  if (error || !mantra) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Mantra Generation Failed</Text>
          <Text style={styles.errorMessage}>{error || 'Unknown error'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={generateMantra}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /**
   * Render mantra style card
   */
  const renderMantraCard = (styleInfo: MantraStyleInfo): React.JSX.Element => {
    const isSelected = selectedStyle === styleInfo.id;
    const mantraText = mantra[styleInfo.id];

    return (
      <TouchableOpacity
        key={styleInfo.id}
        style={[
          styles.mantraCard,
          isSelected && styles.mantraCardSelected,
        ]}
        onPress={() => setSelectedStyle(styleInfo.id)}
        activeOpacity={0.8}
      >
        {/* Icon */}
        <View style={styles.mantraIcon}>
          <Text style={styles.mantraIconText}>{styleInfo.icon}</Text>
        </View>

        {/* Content */}
        <View style={styles.mantraContent}>
          <Text style={[styles.mantraTitle, isSelected && styles.mantraTitleSelected]}>
            {styleInfo.title}
          </Text>
          <Text style={styles.mantraDescription}>{styleInfo.description}</Text>

          {/* Mantra Text */}
          <View style={styles.mantraTextContainer}>
            <Text style={[styles.mantraText, isSelected && styles.mantraTextSelected]}>
              {mantraText}
            </Text>
          </View>

          {/* Play Button */}
          <TouchableOpacity
            style={styles.playButton}
            onPress={() => handlePlayAudio(styleInfo.id)}
          >
            <Text style={styles.playButtonText}>▶️ Play Audio</Text>
          </TouchableOpacity>
        </View>

        {/* Selection Indicator */}
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Text style={styles.selectedIcon}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Create Your Mantra</Text>
          <Text style={styles.subtitle}>
            Mantras are spoken chants that activate your anchor's power. Choose the style that
            feels most natural to you.
          </Text>
        </View>

        {/* Distilled Letters */}
        <View style={styles.lettersSection}>
          <Text style={styles.lettersLabel}>From Your Distilled Letters</Text>
          <View style={styles.lettersContainer}>
            {distilledLetters.map((letter, index) => (
              <View key={index} style={styles.letterBox}>
                <Text style={styles.letterText}>{letter}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Mantra Styles */}
        <View style={styles.mantrasSection}>
          <Text style={styles.mantrasTitle}>Choose Your Mantra Style</Text>
          {MANTRA_STYLES.map(renderMantraCard)}
        </View>

        {/* Usage Instructions */}
        <View style={styles.instructionsSection}>
          <Text style={styles.instructionsTitle}>💡 How to Use Your Mantra</Text>
          <Text style={styles.instructionsText}>
            During activation rituals, you'll chant your mantra 7 times to charge the anchor with
            focused intention. The repetition creates a powerful vibrational resonance.
          </Text>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>
            Continue to Charging Ritual
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginTop: spacing.lg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  errorTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  errorMessage: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  retryButton: {
    backgroundColor: colors.gold,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body1,
  },
  lettersSection: {
    marginBottom: spacing.xl,
  },
  lettersLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  lettersContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  letterBox: {
    backgroundColor: colors.deepPurple,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  letterText: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
  },
  mantrasSection: {
    marginBottom: spacing.xl,
  },
  mantrasTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  mantraCard: {
    backgroundColor: colors.background.card,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    position: 'relative',
  },
  mantraCardSelected: {
    borderColor: colors.gold,
    backgroundColor: `${colors.gold}08`,
  },
  mantraIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.background.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  mantraIconText: {
    fontSize: 32,
  },
  mantraContent: {
    flex: 1,
  },
  mantraTitle: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  mantraTitleSelected: {
    color: colors.gold,
  },
  mantraDescription: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  mantraTextContainer: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  mantraText: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    textAlign: 'center',
  },
  mantraTextSelected: {
    color: colors.gold,
  },
  playButton: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  playButtonText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
  },
  selectedIndicator: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.gold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedIcon: {
    fontSize: 18,
    color: colors.charcoal,
  },
  instructionsSection: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.deepPurple,
  },
  instructionsTitle: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  instructionsText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body2,
  },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.background.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.navy,
  },
  continueButton: {
    backgroundColor: colors.gold,
    borderRadius: 12,
    padding: spacing.md,
    alignItems: 'center',
    height: 56,
    justifyContent: 'center',
  },
  continueButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
  },
});
