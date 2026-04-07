/**
 * Anchor App - AI Variation Picker Screen
 *
 * Step 7 in anchor creation flow (after AIGenerating).
 * User selects from 4 AI-generated anchor variations.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { colors, spacing, typography } from '@/theme';
import { RootStackParamList } from '@/types';

type AIVariationPickerRouteProp = RouteProp<RootStackParamList, 'AIVariationPicker'>;
type AIVariationPickerNavigationProp = StackNavigationProp<RootStackParamList, 'AIVariationPicker'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PREVIEW_SIZE = SCREEN_WIDTH - spacing.xl * 2;
const THUMBNAIL_SIZE = (SCREEN_WIDTH - spacing.xl * 2 - spacing.md) / 2;

/**
 * AIVariationPickerScreen Component
 */
export const AIVariationPickerScreen: React.FC = () => {
  const navigation = useNavigation<AIVariationPickerNavigationProp>();
  const route = useRoute<AIVariationPickerRouteProp>();

  const { intentionText, distilledLetters, sigilSvg, variations, prompt } = route.params;

  const [selectedIndex, setSelectedIndex] = useState(0);

  /**
   * Handle continue button press
   */
  const handleContinue = (): void => {
    const selectedImageUrl = variations[selectedIndex];

    navigation.navigate('MantraCreation', {
      intentionText,
      distilledLetters,
      sigilSvg,
      finalImageUrl: selectedImageUrl,
    });
  };

  /**
   * Render thumbnail card
   */
  const renderThumbnail = (imageUrl: string, index: number): React.JSX.Element => {
    const isSelected = selectedIndex === index;

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.thumbnailCard,
          isSelected && styles.thumbnailCardSelected,
        ]}
        onPress={() => setSelectedIndex(index)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: imageUrl }}
          style={styles.thumbnailImage}
          resizeMode="cover"
        />

        {/* Selection Indicator */}
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Text style={styles.selectedIcon}>✓</Text>
          </View>
        )}

        {/* Variation Number */}
        <View style={styles.variationNumber}>
          <Text style={styles.variationNumberText}>{index + 1}</Text>
        </View>
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
          <Text style={styles.title}>Choose Your Anchor</Text>
          <Text style={styles.subtitle}>
            The AI has created 4 unique variations. Select the one that resonates most powerfully
            with your intention.
          </Text>
        </View>

        {/* Intention Display */}
        <View style={styles.intentionSection}>
          <Text style={styles.intentionLabel}>Your Intention</Text>
          <Text style={styles.intentionText}>"{intentionText}"</Text>
        </View>

        {/* Large Preview */}
        <View style={styles.previewSection}>
          <View style={styles.previewContainer}>
            <Image
              source={{ uri: variations[selectedIndex] }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.previewLabel}>Variation {selectedIndex + 1}</Text>
        </View>

        {/* Variation Grid */}
        <View style={styles.variationsSection}>
          <Text style={styles.variationsTitle}>Select a Variation</Text>
          <View style={styles.variationsGrid}>
            {variations.map((imageUrl, index) => renderThumbnail(imageUrl, index))}
          </View>
        </View>

        {/* AI Prompt Info (Optional - can collapse) */}
        {prompt && (
          <View style={styles.promptSection}>
            <Text style={styles.promptLabel}>AI Generation Details</Text>
            <Text style={styles.promptText}>{prompt}</Text>
          </View>
        )}
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinue}
        >
          <Text style={styles.continueButtonText}>
            Select This Anchor
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
  intentionSection: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.xl,
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
  },
  intentionLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  intentionText: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
  },
  previewSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  previewContainer: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    backgroundColor: colors.background.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 3,
    borderColor: colors.gold,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewLabel: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
  },
  variationsSection: {
    marginBottom: spacing.xl,
  },
  variationsTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  variationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  thumbnailCard: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'transparent',
    position: 'relative',
  },
  thumbnailCardSelected: {
    borderColor: colors.gold,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
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
  variationNumber: {
    position: 'absolute',
    bottom: spacing.sm,
    left: spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${colors.charcoal}CC`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  variationNumberText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
  },
  promptSection: {
    backgroundColor: colors.background.card,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  promptLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  promptText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body2,
    fontStyle: 'italic',
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
