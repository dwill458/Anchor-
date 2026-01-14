/**
 * Anchor App - AI Analysis Screen
 *
 * Step 5 in anchor creation flow (after EnhancementChoice - AI path).
 * Shows intention analysis, selected symbols, themes, and aesthetic approach.
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
import { mockAnalyzeIntention, AnalysisResult } from '@/services/MockAIService';

type AIAnalysisRouteProp = RouteProp<RootStackParamList, 'AIAnalysis'>;
type AIAnalysisNavigationProp = StackNavigationProp<RootStackParamList, 'AIAnalysis'>;
export const AIAnalysisScreen: React.FC = () => {
  const navigation = useNavigation<AIAnalysisNavigationProp>();
  const route = useRoute<AIAnalysisRouteProp>();

  const { intentionText, distilledLetters, sigilSvg, sigilVariant } = route.params;

  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Analyze intention on mount
   */
  useEffect(() => {
    analyzeIntention();
  }, []);

  /**
   * Call backend to analyze intention
   */
  const analyzeIntention = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      // Use mock service for robust demo/testing
      const result = await mockAnalyzeIntention(intentionText);
      setAnalysis(result);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Proceed to AI generation
   */
  const handleContinue = (): void => {
    if (!analysis) return;

    navigation.navigate('AIGenerating', {
      intentionText,
      distilledLetters,
      sigilSvg,
      sigilVariant,
      analysis,
    });
  };

  /**
   * Retry if analysis failed
   */
  const handleRetry = (): void => {
    analyzeIntention();
  };

  /**
   * Loading state
   */
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.loadingText}>Analyzing your intention...</Text>
          <Text style={styles.loadingSubtext}>
            The AI is examining archetypal themes and selecting symbolic elements
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /**
   * Error state
   */
  if (error || !analysis) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Analysis Failed</Text>
          <Text style={styles.errorMessage}>{error || 'Unknown error occurred'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /**
   * Main content
   */
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>AI Analysis Complete</Text>
          <Text style={styles.subtitle}>
            I've analyzed your intention and selected powerful symbols to amplify it.
          </Text>
        </View>

        {/* Intention */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your Intention</Text>
          <View style={styles.intentionCard}>
            <Text style={styles.intentionText}>"{analysis.intentionText}"</Text>
          </View>
        </View>

        {/* Keywords */}
        {analysis.keywords.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Key Elements Detected</Text>
            <View style={styles.tagsContainer}>
              {analysis.keywords.map((keyword, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{keyword}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Themes */}
        {analysis.themes.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Archetypal Themes</Text>
            <View style={styles.tagsContainer}>
              {analysis.themes.map((theme, index) => (
                <View key={index} style={[styles.tag, styles.tagTheme]}>
                  <Text style={styles.tagText}>{theme}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Selected Symbols */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Selected Symbols</Text>
          {analysis.selectedSymbols.map((symbol, index) => (
            <View key={index} style={styles.symbolCard}>
              <View style={styles.symbolHeader}>
                {symbol.unicode && (
                  <Text style={styles.symbolIcon}>{symbol.unicode}</Text>
                )}
                <View style={styles.symbolInfo}>
                  <Text style={styles.symbolName}>{symbol.name}</Text>
                  <Text style={styles.symbolCategory}>{symbol.category}</Text>
                </View>
              </View>
              <Text style={styles.symbolDescription}>{symbol.description}</Text>
            </View>
          ))}
        </View>

        {/* Aesthetic Approach */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Visual Aesthetic</Text>
          <View style={styles.aestheticCard}>
            <Text style={styles.aestheticText}>{analysis.aesthetic}</Text>
          </View>
        </View>

        {/* Explanation */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Why These Choices?</Text>
          <View style={styles.explanationCard}>
            <Text style={styles.explanationText}>{analysis.explanation}</Text>
          </View>
        </View>
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.continueButton} onPress={handleContinue}>
          <Text style={styles.continueButtonText}>Generate AI Variations</Text>
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
    padding: spacing.xl,
  },
  loadingText: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    marginTop: spacing.sm,
    textAlign: 'center',
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
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  intentionCard: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
  },
  intentionText: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.deepPurple,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  tagTheme: {
    backgroundColor: colors.background.card,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  tagText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
  },
  symbolCard: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  symbolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  symbolIcon: {
    fontSize: 40,
    marginRight: spacing.md,
  },
  symbolInfo: {
    flex: 1,
  },
  symbolName: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
  },
  symbolCategory: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    textTransform: 'capitalize',
  },
  symbolDescription: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body2,
  },
  aestheticCard: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
  },
  aestheticText: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    textTransform: 'capitalize',
  },
  explanationCard: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.deepPurple,
  },
  explanationText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body1,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: 120, // Clear floating tab bar
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
