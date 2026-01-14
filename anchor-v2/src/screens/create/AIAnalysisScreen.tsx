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
import { colors as themeColors, spacing, typography } from '@/theme'; // Rename to avoid conflict
import { RootStackParamList } from '@/types';
import { mockAnalyzeIntention, AnalysisResult } from '@/services/MockAIService';

// Design System Colors (Zen Architect) - Keeping specific design colors for the premium feel
const designColors = {
  navy: '#0F1419',
  charcoal: '#1A1A1D',
  gold: '#D4AF37',
  bone: '#F5F5DC',
  silver: '#C0C0C0',
  deepPurple: '#3E2C5B',
  bronze: '#CD7F32',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type AIAnalysisRouteProp = RouteProp<RootStackParamList, 'AIAnalysis'>;
type AIAnalysisNavigationProp = StackNavigationProp<RootStackParamList, 'AIAnalysis'>;

export const AIAnalysisScreen: React.FC = () => {
  const navigation = useNavigation<AIAnalysisNavigationProp>();
  const route = useRoute<AIAnalysisRouteProp>();
  const { intentionText, distilledLetters, sigilSvg, sigilVariant } = route.params;

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
      // Use mock service
      const result = await mockAnalyzeIntention(intentionText);
      setAnalysis(result);
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
      distilledLetters,
      sigilSvg,
      sigilVariant,
      analysis,
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleRetry = () => {
    analyzeIntention();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient
          colors={[designColors.navy, designColors.deepPurple, designColors.charcoal]}
          style={styles.background}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={designColors.gold} />
          <Text style={styles.loadingText}>Analyzing your intention...</Text>
          <Text style={styles.loadingSubtext}>
            The AI is examining archetypal themes and selecting symbolic elements
          </Text>
        </View>
      </View>
    );
  }

  if (error || !analysis) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient
          colors={[designColors.navy, designColors.deepPurple, designColors.charcoal]}
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
        colors={[designColors.navy, designColors.deepPurple, designColors.charcoal]}
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
                colors={[designColors.gold, designColors.bronze]}
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
              <Text style={styles.intentionText}>"{analysis.intentionText}"</Text>
            </BlurView>
          </Animated.View>

          {/* Key Elements (Keywords) - Flowing Pills */}
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
                key={symbol.id || index}
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

          {/* Aesthetic Approach */}
          <Animated.View
            style={[
              styles.section,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.sectionLabel}>VISUAL AESTHETIC</Text>
            <BlurView intensity={10} tint="dark" style={styles.aestheticCard}>
              <Text style={styles.aestheticText}>{analysis.aesthetic}</Text>
            </BlurView>
          </Animated.View>

          {/* Explanation */}
          <Animated.View
            style={[
              styles.section,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <Text style={styles.sectionLabel}>WHY THESE CHOICES?</Text>
            <BlurView intensity={15} tint="dark" style={styles.explanationCard}>
              <Text style={styles.explanationText}>{analysis.explanation}</Text>
            </BlurView>
          </Animated.View>

          {/* Floating CTA Button - Now Static inside ScrollView */}
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
                colors={[designColors.gold, '#B8941F']}
                style={styles.ctaGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.ctaText}>Generate AI Variations</Text>
                <Text style={styles.ctaArrow}>→</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: designColors.navy,
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: 20,
    fontWeight: '600',
    color: designColors.gold,
    marginTop: 20,
    textAlign: 'center',
  },
  loadingSubtext: {
    fontSize: 14,
    color: designColors.silver,
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
    color: designColors.bone,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: designColors.silver,
    textAlign: 'center',
    marginBottom: 32,
  },
  retryButton: {
    backgroundColor: designColors.gold,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: designColors.charcoal,
  },
  orb: {
    position: 'absolute',
    borderRadius: 300,
    backgroundColor: designColors.gold,
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
    color: designColors.gold,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: designColors.gold,
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 150, // Updated to 150 to ensure clearance of tab bar
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
    shadowColor: designColors.gold,
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
    // fontFamily: 'Cinzel-Regular', // Reverting to system font if custom font load isn't guaranteed
    fontWeight: '600',
    color: designColors.gold,
    marginBottom: 8,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    color: designColors.silver,
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
    color: designColors.silver,
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
    backgroundColor: designColors.gold,
    opacity: 0.8,
  },
  intentionText: {
    fontSize: 20,
    fontStyle: 'italic',
    color: designColors.bone,
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
    color: designColors.gold,
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
    color: designColors.bone,
    letterSpacing: 0.3,
  },
  themeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: designColors.gold,
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
    color: designColors.gold,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  symbolDescription: {
    fontSize: 13,
    color: designColors.silver,
    lineHeight: 18,
  },
  aestheticCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    backgroundColor: 'rgba(26, 26, 29, 0.3)',
  },
  aestheticText: {
    fontSize: 18,
    fontWeight: '600',
    color: designColors.gold,
    textTransform: 'capitalize',
    textAlign: 'center',
  },
  explanationCard: {
    borderRadius: 20,
    padding: 24,
    borderLeftWidth: 4,
    borderLeftColor: designColors.deepPurple,
    backgroundColor: 'rgba(26, 26, 29, 0.3)',
  },
  explanationText: {
    fontSize: 15,
    color: designColors.silver,
    lineHeight: 24,
  },
  bottomSpacer: {
    height: 20,
  },
  ctaContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    marginBottom: 100, // Ensure space for scrolling
  },
  ctaButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: designColors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
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
    color: designColors.charcoal,
    letterSpacing: 0.5,
    marginRight: 8,
  },
  ctaArrow: {
    fontSize: 20,
    color: designColors.charcoal,
    fontWeight: '300',
  },
});
