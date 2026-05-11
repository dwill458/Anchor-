import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Animated,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList, Symbol, AnalysisResult } from '@/types'; // Ensure this path is correct
import { apiClient } from '@/services/ApiClient';

// Design System Colors (Zen Architect)
const colors = {
  navy: '#0F1419',
  charcoal: '#1A1A1D',
  gold: '#D4AF37',
  bone: '#F5F5DC',
  silver: '#C0C0C0',
  deepPurple: '#3E2C5B',
  bronze: '#CD7F32',
};

// Types for Navigation and Route
type AIAnalysisRouteProp = RouteProp<RootStackParamList, 'AIAnalysis'>;
type AIAnalysisNavigationProp = StackNavigationProp<RootStackParamList, 'AIAnalysis'>;

// Local types removed in favor of global definitions in @/types

export default function AIAnalysisScreen() {
  const navigation = useNavigation<AIAnalysisNavigationProp>();
  const route = useRoute<AIAnalysisRouteProp>();
  const { intentionText, distilledLetters, sigilSvg, sigilVariant, category } = route.params;

  // Animation Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // State
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analyzeIntention();
  }, []);

  // Trigger animations when analysis is ready
  useEffect(() => {
    if (analysis && !loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 40,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [analysis, loading]);

  const analyzeIntention = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      console.log('Analyzing intention:', intentionText);

      const response = await apiClient.post<{ analysis: AnalysisResult }>('/api/ai/analyze', {
        intentionText,
      });

      console.log('Analysis response:', response.data);
      setAnalysis(response.data.analysis || {
        intentionText: intentionText || '',
        keywords: [],
        themes: [],
        selectedSymbols: [],
        aesthetic: 'minimal',
        explanation: ''
      });
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateVariations = () => {
    if (!analysis) return;
    navigation.navigate('AIGenerating', {
      intentionText,
      category,
      distilledLetters,
      baseSigilSvg: sigilSvg || '',
      structureVariant: (sigilVariant as any) || 'balanced',
      styleChoice: (analysis.aesthetic as any) || 'minimal_line',
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleRetry = () => {
    analyzeIntention();
  };

  // Loading State
  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient
          colors={[colors.navy, colors.deepPurple, colors.charcoal]}
          style={styles.background}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={styles.loadingText}>Analyzing your intention...</Text>
          <Text style={styles.loadingSubtext}>
            The AI is examining archetypal themes and selecting symbolic elements
          </Text>
        </View>
      </View>
    );
  }

  // Error State
  if (error || !analysis) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient
          colors={[colors.navy, colors.deepPurple, colors.charcoal]}
          style={styles.background}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Analysis Failed</Text>
            <Text style={styles.errorMessage}>{error || 'Unknown error occurred'}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.backButtonSimple} onPress={handleBack}>
              <Text style={styles.backButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Animated Background */}
      <LinearGradient
        colors={[colors.navy, colors.deepPurple, colors.charcoal]}
        style={styles.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Floating Orbs */}
      <Animated.View
        style={[
          styles.orb,
          styles.orb1,
          {
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.12],
            }),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orb2,
          {
            opacity: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.08],
            }),
          },
        ]}
      />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AI Analysis</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Success Message */}
          <Animated.View
            style={[
              styles.successSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <View style={styles.successIconContainer}>
              <LinearGradient
                colors={[colors.gold, colors.bronze]}
                style={styles.successIcon}
              >
                <Text style={styles.successEmoji}>✨</Text>
              </LinearGradient>
            </View>
            <Text style={styles.successTitle}>Analysis Complete</Text>
            <Text style={styles.successSubtitle}>
              I've analyzed your intention and selected powerful symbols to amplify it
            </Text>
          </Animated.View>

          {/* Intention Card */}
          <Animated.View
            style={[
              styles.section,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 30],
                      outputRange: [0, 40],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.sectionLabel}>YOUR INTENTION</Text>
            <BlurView intensity={15} tint="dark" style={styles.intentionCard}>
              <View style={styles.intentionBorder} />
              <Text style={styles.intentionText}>"{intentionText}"</Text>
            </BlurView>
          </Animated.View>

          {/* Key Elements - Flowing Pills */}
          <Animated.View
            style={[
              styles.section,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 30],
                      outputRange: [0, 50],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.sectionLabel}>KEY ELEMENTS DETECTED</Text>
            <View style={styles.pillsContainer}>
              {analysis.keywords.map((element, index) => (
                <View key={index} style={styles.pill}>
                  <LinearGradient
                    colors={['rgba(62, 44, 91, 0.4)', 'rgba(62, 44, 91, 0.2)']}
                    style={styles.pillGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.pillText}>{element}</Text>
                  </LinearGradient>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Archetypal Themes - Elegant Cards */}
          <Animated.View
            style={[
              styles.section,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 30],
                      outputRange: [0, 60],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.sectionLabel}>ARCHETYPAL THEMES</Text>
            <View style={styles.themesContainer}>
              {analysis.themes.map((theme, index) => (
                <BlurView
                  key={index}
                  intensity={10}
                  tint="dark"
                  style={styles.themeCard}
                >
                  <Text style={styles.themeText}>{theme}</Text>
                  <View style={styles.themeDot} />
                </BlurView>
              ))}
            </View>
          </Animated.View>

          {/* Selected Symbols - Spacious Cards */}
          <Animated.View
            style={[
              styles.section,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 30],
                      outputRange: [0, 70],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.sectionLabel}>SELECTED SYMBOLS</Text>
            {analysis.selectedSymbols.map((symbol, index) => (
              <BlurView
                key={symbol.id || symbol.name || index}
                intensity={12}
                tint="dark"
                style={styles.symbolCard}
              >
                <View style={styles.symbolIconContainer}>
                  <Text style={styles.symbolIcon}>{symbol.unicode}</Text>
                </View>
                <View style={styles.symbolInfo}>
                  <Text style={styles.symbolName}>{symbol.name}</Text>
                  <Text style={styles.symbolDescription}>
                    {symbol.description}
                  </Text>
                </View>
              </BlurView>
            ))}
          </Animated.View>

          {/* Bonus: Explanation Section (Adapted using Intention Card Style) */}
          {analysis.explanation && (
            <Animated.View
              style={[
                styles.section,
                {
                  opacity: fadeAnim,
                  transform: [
                    {
                      translateY: slideAnim.interpolate({
                        inputRange: [0, 30],
                        outputRange: [0, 80],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={styles.sectionLabel}>WHY THESE CHOICES?</Text>
              <BlurView intensity={10} tint="dark" style={styles.explanationCard}>
                <Text style={styles.explanationText}>{analysis.explanation}</Text>
              </BlurView>
            </Animated.View>
          )}

          {/* Spacer for button */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Floating CTA Button */}
        <Animated.View
          style={[
            styles.ctaContainer,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 30],
                    outputRange: [0, 50],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            onPress={handleGenerateVariations}
            activeOpacity={0.9}
            style={styles.ctaButton}
          >
            <LinearGradient
              colors={[colors.gold, '#B8941F']}
              style={styles.ctaGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.ctaText}>Generate AI Variations</Text>
              <Text style={styles.ctaArrow}>→</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.navy,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  orb: {
    position: 'absolute',
    borderRadius: 300,
    backgroundColor: colors.gold,
  },
  orb1: {
    width: 280,
    height: 280,
    top: -80,
    right: -100,
  },
  orb2: {
    width: 220,
    height: 220,
    bottom: 200,
    left: -60,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: colors.gold,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gold,
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 200, // Increased to ensure content clears the raised button
  },
  successSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  successEmoji: {
    fontSize: 40,
  },
  successTitle: {
    fontSize: 28,
    // fontFamily: 'Cinzel-Regular', 
    fontWeight: '600',
    color: colors.gold,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    color: colors.silver,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.silver,
    letterSpacing: 1.5,
    marginBottom: 16,
    opacity: 0.7,
  },
  intentionCard: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: 'rgba(26, 26, 29, 0.4)',
    position: 'relative',
    overflow: 'hidden',
  },
  intentionBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.gold,
    opacity: 0.8,
  },
  intentionText: {
    fontSize: 20,
    fontStyle: 'italic',
    color: colors.bone,
    lineHeight: 30,
    letterSpacing: 0.3,
  },
  pillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  pill: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  pillGradient: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(62, 44, 91, 0.5)',
    borderRadius: 20,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gold,
    letterSpacing: 0.3,
  },
  themesContainer: {
    gap: 12,
  },
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    backgroundColor: 'rgba(26, 26, 29, 0.3)',
  },
  themeText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.bone,
    letterSpacing: 0.3,
  },
  themeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
    opacity: 0.6,
  },
  symbolCard: {
    flexDirection: 'row',
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    backgroundColor: 'rgba(26, 26, 29, 0.3)',
  },
  symbolIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
  },
  symbolIcon: {
    fontSize: 28,
  },
  symbolInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  symbolName: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.gold,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  symbolDescription: {
    fontSize: 13,
    color: colors.silver,
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 20,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 80, // Raised to clear the floating tab bar
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
  },
  ctaButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
    marginTop: 10, // Added margin for spacing
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: 0.5,
    marginRight: 8,
    textAlign: 'center', // Ensure text center
  },
  ctaArrow: {
    fontSize: 20,
    color: colors.charcoal,
    fontWeight: '300',
    marginTop: -2, // Micro-adjustment for vertical alignment
  },
  // Loading & Error Styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.gold,
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: colors.silver,
    marginTop: 8,
    textAlign: 'center',
    maxWidth: '80%',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.bone,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: colors.silver,
    textAlign: 'center',
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: colors.gold,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.charcoal,
  },
  backButtonSimple: {
    padding: 12,
  },
  backButtonText: {
    color: colors.silver,
    fontSize: 14,
  },
  explanationCard: {
    borderRadius: 20,
    padding: 24,
    borderLeftWidth: 4,
    borderLeftColor: colors.deepPurple,
    backgroundColor: 'rgba(26, 26, 29, 0.3)',
  },
  explanationText: {
    fontSize: 15,
    color: colors.silver,
    lineHeight: 24,
  },
});
