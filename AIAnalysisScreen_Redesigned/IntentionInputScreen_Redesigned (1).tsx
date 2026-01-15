import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { StatusBar } from 'expo-status-bar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Design System Colors (Zen Architect)
const colors = {
  navy: '#0F1419',
  charcoal: '#1A1A1D',
  gold: '#D4AF37',
  bone: '#F5F5DC',
  silver: '#C0C0C0',
  deepPurple: '#3E2C5B',
  bronze: '#CD7F32',
  success: '#4CAF50',
  warning: '#FF8C00',
};

type Category = 'career' | 'health' | 'wealth' | 'love' | 'growth';

interface CategoryData {
  id: Category;
  label: string;
  emoji: string;
  color: string;
}

const CATEGORIES: CategoryData[] = [
  { id: 'career', label: 'Career', emoji: '💼', color: colors.gold },
  { id: 'health', label: 'Health', emoji: '⚕️', color: colors.success },
  { id: 'wealth', label: 'Wealth', emoji: '💰', color: colors.bronze },
  { id: 'love', label: 'Love', emoji: '💕', color: colors.deepPurple },
  { id: 'growth', label: 'Growth', emoji: '🌱', color: colors.silver },
];

const EXAMPLE_INTENTIONS = [
  'I am confident and capable',
  'My business thrives with abundance',
  'I attract meaningful relationships',
  'I excel in my career',
  'I embrace healthy habits daily',
];

interface IntentionInputScreenProps {
  navigation: any;
}

export default function IntentionInputScreen({
  navigation,
}: IntentionInputScreenProps) {
  const [intention, setIntention] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<Category>('growth');
  const [showTips, setShowTips] = useState(false);
  const [charCount, setCharCount] = useState(0);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const inputRef = useRef<TextInput>(null);

  const maxChars = 100;
  const minChars = 3;
  const isValid = charCount >= minChars && charCount <= maxChars;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleIntentionChange = (text: string) => {
    if (text.length <= maxChars) {
      setIntention(text);
      setCharCount(text.length);
    }
  };

  const handleExamplePress = (example: string) => {
    setIntention(example);
    setCharCount(example.length);
  };

  const handleContinue = () => {
    if (isValid) {
      navigation.navigate('SigilSelection', {
        intention,
        category: selectedCategory,
      });
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              activeOpacity={0.7}
            >
              <Text style={styles.backIcon}>←</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Anchor</Text>
            <View style={styles.backButton} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Title Section */}
            <Animated.View
              style={[
                styles.titleSection,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Text style={styles.title}>What is your intention?</Text>
              <Text style={styles.subtitle}>
                Enter a clear, focused intention. This could be a goal,
                affirmation, or desire.
              </Text>
            </Animated.View>

            {/* Category Selection */}
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
              <Text style={styles.sectionLabel}>CATEGORY</Text>
              <View style={styles.categoriesContainer}>
                {CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    onPress={() => setSelectedCategory(category.id)}
                    activeOpacity={0.7}
                  >
                    <BlurView
                      intensity={
                        selectedCategory === category.id ? 20 : 10
                      }
                      tint="dark"
                      style={[
                        styles.categoryChip,
                        selectedCategory === category.id &&
                          styles.categoryChipSelected,
                      ]}
                    >
                      <Text style={styles.categoryEmoji}>
                        {category.emoji}
                      </Text>
                      <Text
                        style={[
                          styles.categoryLabel,
                          selectedCategory === category.id &&
                            styles.categoryLabelSelected,
                        ]}
                      >
                        {category.label}
                      </Text>
                    </BlurView>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>

            {/* Intention Input */}
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
              <BlurView intensity={12} tint="dark" style={styles.inputCard}>
                <TextInput
                  ref={inputRef}
                  style={styles.textInput}
                  value={intention}
                  onChangeText={handleIntentionChange}
                  placeholder="e.g., I am confident and capable"
                  placeholderTextColor={`${colors.silver}60`}
                  multiline
                  maxLength={maxChars}
                  autoCapitalize="sentences"
                  autoCorrect={true}
                />
                
                {/* Character Counter */}
                <View style={styles.inputFooter}>
                  <View style={styles.validationDot}>
                    {charCount > 0 && (
                      <View
                        style={[
                          styles.dot,
                          {
                            backgroundColor: isValid
                              ? colors.success
                              : colors.warning,
                          },
                        ]}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.charCounter,
                      charCount > maxChars * 0.9 && styles.charCounterWarning,
                    ]}
                  >
                    {charCount} / {maxChars}
                  </Text>
                </View>
              </BlurView>
            </Animated.View>

            {/* Intent Formatting Tips */}
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
              <TouchableOpacity
                onPress={() => setShowTips(!showTips)}
                activeOpacity={0.7}
                style={styles.tipsToggle}
              >
                <Text style={styles.tipsIcon}>💡</Text>
                <Text style={styles.tipsText}>Intent Formatting Tips</Text>
                <Text style={styles.tipsArrow}>{showTips ? '▼' : '▶'}</Text>
              </TouchableOpacity>

              {showTips && (
                <BlurView intensity={10} tint="dark" style={styles.tipsCard}>
                  <View style={styles.tipItem}>
                    <Text style={styles.tipBullet}>✓</Text>
                    <Text style={styles.tipText}>
                      Use present tense: "I am" instead of "I will"
                    </Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Text style={styles.tipBullet}>✓</Text>
                    <Text style={styles.tipText}>
                      Be specific and clear about what you want
                    </Text>
                  </View>
                  <View style={styles.tipItem}>
                    <Text style={styles.tipBullet}>✓</Text>
                    <Text style={styles.tipText}>
                      Focus on the positive outcome you desire
                    </Text>
                  </View>
                </BlurView>
              )}
            </Animated.View>

            {/* Example Intentions */}
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
              <Text style={styles.sectionLabel}>EXAMPLE INTENTIONS</Text>
              {EXAMPLE_INTENTIONS.map((example, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleExamplePress(example)}
                  activeOpacity={0.7}
                  style={styles.exampleItem}
                >
                  <Text style={styles.exampleQuote}>"</Text>
                  <Text style={styles.exampleText}>{example}</Text>
                </TouchableOpacity>
              ))}
            </Animated.View>

            {/* Bottom Spacer */}
            <View style={styles.bottomSpacer} />
          </ScrollView>

          {/* Continue Button - Fixed */}
          <Animated.View
            style={[
              styles.continueContainer,
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
              onPress={handleContinue}
              activeOpacity={0.9}
              disabled={!isValid}
              style={styles.continueButton}
            >
              <LinearGradient
                colors={
                  isValid
                    ? [colors.gold, '#B8941F']
                    : ['rgba(192,192,192,0.3)', 'rgba(158,158,158,0.3)']
                }
                style={styles.continueGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text
                  style={[
                    styles.continueText,
                    !isValid && styles.continueTextDisabled,
                  ]}
                >
                  Continue to Sigil
                </Text>
                <Text
                  style={[
                    styles.continueArrow,
                    !isValid && styles.continueTextDisabled,
                  ]}
                >
                  →
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAvoidingView>
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
  keyboardView: {
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
    paddingBottom: 120,
  },
  titleSection: {
    paddingTop: 8,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Cinzel-Regular',
    color: colors.gold,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.silver,
    lineHeight: 22,
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
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.2)',
    backgroundColor: 'rgba(26, 26, 29, 0.3)',
  },
  categoryChipSelected: {
    borderColor: colors.gold,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
  },
  categoryEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.silver,
  },
  categoryLabelSelected: {
    color: colors.gold,
    fontWeight: '700',
  },
  inputCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.2)',
    backgroundColor: 'rgba(26, 26, 29, 0.4)',
    minHeight: 140,
  },
  textInput: {
    fontSize: 17,
    color: colors.bone,
    lineHeight: 26,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  inputFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(192, 192, 192, 0.1)',
  },
  validationDot: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  charCounter: {
    fontSize: 13,
    color: colors.silver,
    opacity: 0.6,
  },
  charCounterWarning: {
    color: colors.warning,
    opacity: 1,
  },
  tipsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  tipsIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  tipsText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gold,
    flex: 1,
  },
  tipsArrow: {
    fontSize: 14,
    color: colors.gold,
  },
  tipsCard: {
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.15)',
    backgroundColor: 'rgba(26, 26, 29, 0.3)',
  },
  tipItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  tipBullet: {
    fontSize: 14,
    color: colors.success,
    marginRight: 12,
    marginTop: 2,
  },
  tipText: {
    fontSize: 14,
    color: colors.silver,
    lineHeight: 20,
    flex: 1,
  },
  exampleItem: {
    flexDirection: 'row',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(26, 26, 29, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.1)',
  },
  exampleQuote: {
    fontSize: 24,
    color: colors.gold,
    marginRight: 12,
    marginTop: -4,
    opacity: 0.5,
  },
  exampleText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.bone,
    lineHeight: 22,
    flex: 1,
  },
  bottomSpacer: {
    height: 20,
  },
  continueContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: 100,
    paddingTop: 16,
  },
  continueButton: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  continueGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  continueText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: 0.5,
    marginRight: 8,
  },
  continueTextDisabled: {
    color: colors.silver,
    opacity: 0.5,
  },
  continueArrow: {
    fontSize: 20,
    color: colors.charcoal,
    fontWeight: '300',
  },
});
