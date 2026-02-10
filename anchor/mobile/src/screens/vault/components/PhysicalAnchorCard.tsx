/**
 * Physical Anchor Card Component
 *
 * Glassmorphic card that invites users to create physical merchandise
 * of their anchor. Designed to feel like a ritual extension, not a store.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SvgXml } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Anchor } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { OptimizedImage } from '@/components/common/OptimizedImage';
import { safeHaptics } from '@/utils/haptics';
import { AnalyticsService, AnalyticsEvents } from '@/services/AnalyticsService';
import { PhysicalAnchorModal } from './PhysicalAnchorModal';

interface PhysicalAnchorCardProps {
  anchor: Anchor;
  hasActivations: boolean;
}

export const PhysicalAnchorCard: React.FC<PhysicalAnchorCardProps> = ({
  anchor,
  hasActivations,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Ambient glow animation (7s loop, very subtle)
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 3500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false, // shadowOpacity cannot use native driver
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 3500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, []);

  const borderOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.15, 0.35],
  });

  const shadowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 0.4],
  });

  const handleCTAPress = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Medium);

    // Track analytics
    AnalyticsService.track(AnalyticsEvents.MERCH_INITIATED_FROM_ANCHOR_DETAILS, {
      anchor_id: anchor.id,
      has_activations: hasActivations,
    });

    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
  };

  // Determine image source (PNG URL vs SVG string)
  const imageSource = anchor.enhancedImageUrl || anchor.baseSigilSvg;
  const isImageUrl =
    imageSource && (imageSource.startsWith('http') || imageSource.startsWith('file'));

  return (
    <>
      <View style={styles.container}>
        <View style={styles.glassmorphicCard}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill}>
              {renderCardContent()}
            </BlurView>
          ) : (
            <View style={styles.androidFallback}>{renderCardContent()}</View>
          )}
        </View>
      </View>

      {/* Product Selection Modal */}
      <PhysicalAnchorModal
        visible={modalVisible}
        onClose={handleModalClose}
        anchor={anchor}
      />
    </>
  );

  function renderCardContent() {
    return (
      <View style={styles.content}>
        {/* Section Header */}
        <View style={styles.header}>
          <Text style={styles.sectionTitle}>Physical Anchor</Text>
          <Text style={styles.sectionSubtitle}>Make this symbol tangible.</Text>
          {hasActivations && (
            <Text style={styles.activatedCaption}>
              Activated anchors are often made physical.
            </Text>
          )}
        </View>

        {/* Main Card Content: Left Image + Right Text */}
        <View style={styles.mainContent}>
          {/* Left: Product Preview with Glow */}
          <Animated.View
            style={[
              styles.imageContainer,
              {
                borderColor: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [
                    'rgba(212, 175, 55, 0.3)',
                    'rgba(212, 175, 55, 0.6)',
                  ],
                }),
                shadowOpacity,
              },
            ]}
          >
            {isImageUrl ? (
              <OptimizedImage
                uri={imageSource}
                style={styles.image}
                resizeMode="cover"
              />
            ) : imageSource ? (
              <SvgXml xml={imageSource} width="100%" height="100%" />
            ) : (
              <View style={styles.imagePlaceholder} />
            )}
          </Animated.View>

          {/* Right: Text Content + CTA */}
          <View style={styles.textContainer}>
            <Text style={styles.cardTitle}>Carry your anchor</Text>
            <Text style={styles.cardBody}>
              Some anchors are meant to live beyond the screen. Create a physical
              form of this symbol as a quiet reminder.
            </Text>

            {/* CTA Button */}
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleCTAPress}
              activeOpacity={0.8}
            >
              <Text style={styles.ctaButtonText}>Create Physical Anchor</Text>
            </TouchableOpacity>

            {/* Microcopy */}
            <Text style={styles.microcopy}>Keychains • Prints • Apparel</Text>
          </View>
        </View>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  glassmorphicCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.15)',
    overflow: 'hidden',
  },
  androidFallback: {
    backgroundColor: 'rgba(15, 20, 25, 0.82)',
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: typography.fonts.heading,
    fontSize: typography.sizes.h4,
    color: colors.gold,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  activatedCaption: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.caption,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: spacing.md,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 4,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: typography.sizes.body1,
    color: colors.text.primary,
    marginBottom: spacing.xs,
    fontWeight: '600',
  },
  cardBody: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.body2,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  ctaButton: {
    backgroundColor: colors.gold,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  ctaButtonText: {
    fontFamily: typography.fonts.bodyBold,
    fontSize: typography.sizes.body2,
    color: colors.charcoal,
    fontWeight: '600',
  },
  microcopy: {
    fontFamily: typography.fonts.body,
    fontSize: typography.sizes.caption,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
