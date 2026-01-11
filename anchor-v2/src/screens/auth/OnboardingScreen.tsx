/**
 * Anchor App - Onboarding Screen
 *
 * 5-slide onboarding flow for new users with skip option
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  ViewToken,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../stores/authStore';
import { colors, spacing, typography } from '@/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Onboarding slide data
 */
interface OnboardingSlide {
  id: string;
  title: string;
  description: string;
  icon: string; // Emoji for now, can be replaced with actual icons later
}

const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Welcome to Anchor',
    description:
      'Transform your intentions into powerful visual symbols that guide your journey to success.',
    icon: '⚓',
  },
  {
    id: '2',
    title: 'Create Your Anchors',
    description:
      'Enter your intention and watch as it becomes a unique symbol charged with your focused energy.',
    icon: '✨',
  },
  {
    id: '3',
    title: 'Charge with Ritual',
    description:
      'Engage in guided rituals to infuse your anchor with intention through visualization and focus.',
    icon: '🔥',
  },
  {
    id: '4',
    title: 'Activate Daily',
    description:
      'Build momentum through daily activation. Each interaction strengthens your connection to your goals.',
    icon: '🎯',
  },
  {
    id: '5',
    title: 'Manifest Your Vision',
    description:
      'Track your progress, maintain your streak, and watch your intentions become reality.',
    icon: '🌟',
  },
];

export const OnboardingScreen: React.FC = () => {
  const navigation = useNavigation();
  const { completeOnboarding } = useAuthStore();

  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);

  /**
   * Handle viewable items change
   */
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  /**
   * Go to next slide
   */
  const handleNext = (): void => {
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      handleComplete();
    }
  };

  /**
   * Skip onboarding
   */
  const handleSkip = (): void => {
    handleComplete();
  };

  /**
   * Complete onboarding and navigate to main app
   */
  const handleComplete = (): void => {
    completeOnboarding();
    // @ts-expect-error - Navigation types will be set up later
    navigation.replace('Main');
  };

  /**
   * Render individual slide
   */
  const renderSlide = ({ item }: { item: OnboardingSlide }): React.JSX.Element => (
    <View style={styles.slide}>
      <Text style={styles.icon}>{item.icon}</Text>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.description}>{item.description}</Text>
    </View>
  );

  /**
   * Render pagination dots
   */
  const renderPagination = (): React.JSX.Element => (
    <View style={styles.pagination}>
      {ONBOARDING_SLIDES.map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === currentIndex ? styles.dotActive : styles.dotInactive,
          ]}
        />
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Skip Button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />

      {/* Footer */}
      <View style={styles.footer}>
        {renderPagination()}

        {/* Next/Get Started Button */}
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {currentIndex === ONBOARDING_SLIDES.length - 1 ? 'Get Started' : 'Next'}
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
  skipButton: {
    alignSelf: 'flex-end',
    padding: spacing.md,
    marginRight: spacing.md,
  },
  skipText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  icon: {
    fontSize: 80,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  description: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body1,
    paddingHorizontal: spacing.lg,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: spacing.xs,
  },
  dotActive: {
    backgroundColor: colors.gold,
    width: 24,
  },
  dotInactive: {
    backgroundColor: colors.navy,
  },
  nextButton: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
  },
  nextButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.charcoal,
  },
});
