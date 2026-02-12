/**
 * ProPaywallModal
 *
 * Glassmorphic paywall modal for Pro-only features.
 * Emphasizes depth and mastery, not restriction.
 * Designed to feel elevating and optional, not blocking.
 *
 * @example
 * <ProPaywallModal
 *   visible={showPaywall}
 *   feature="manual_forge"
 *   onClose={() => setShowPaywall(false)}
 *   onUpgrade={() => navigation.navigate('Settings')}
 * />
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  Platform,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '@/theme';

const { width } = Dimensions.get('window');
const MODAL_WIDTH = width * 0.9;

interface ProPaywallModalProps {
  visible: boolean;
  feature: string;
  onClose: () => void;
  onUpgrade: () => void;
}

// Feature-specific content
const FEATURE_CONTENT = {
  manual_forge: {
    title: 'Forge from Scratch',
    subtitle: 'Master-level creation awaits',
    icon: '🔥',
    benefits: [
      'Blank canvas with professional tools',
      '6 brush types (pen, calligraphy, airbrush...)',
      '24 mystical colors',
      'Symmetry modes (radial, horizontal, vertical)',
      'Unlimited undo/redo',
      'Clean SVG export',
    ],
    cta: 'Unlock Forge',
  },
  all_styles: {
    title: 'All Refinement Styles',
    subtitle: 'Unlock your creative potential',
    icon: '✨',
    benefits: [
      'Access all 12 refinement styles',
      'Minimal line, sacred geometry, watercolor, ink brush',
      'Gold leaf, cosmic, aurora glow, ember trace',
      'Obsidian mono, monolith ink, celestial grid, echo chamber',
      'Unlimited style experimentation',
    ],
    cta: 'Unlock 12 Styles',
  },
  hd_export: {
    title: 'HD Export',
    subtitle: 'Professional quality exports',
    icon: '🎨',
    benefits: [
      '4K resolution PNG export',
      'Vector SVG export',
      'Transparent backgrounds',
      'Print-ready quality',
    ],
    cta: 'Unlock HD Export',
  },
};

export function ProPaywallModal({
  visible,
  feature,
  onClose,
  onUpgrade,
}: ProPaywallModalProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  const content = FEATURE_CONTENT[feature as keyof typeof FEATURE_CONTENT] || FEATURE_CONTENT.manual_forge;

  useEffect(() => {
    if (visible) {
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.backdropOverlay,
            { opacity: fadeAnim },
          ]}
        />

        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={40} tint="dark" style={styles.glassmorphicCard}>
                {renderContent()}
              </BlurView>
            ) : (
              <View style={[styles.glassmorphicCard, styles.androidFallback, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]}>
                {renderContent()}
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );

  function renderContent() {
    return (
      <View style={styles.content}>
        {/* Icon Header */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{content.icon}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{content.title}</Text>
        <Text style={styles.subtitle}>{content.subtitle}</Text>

        {/* Pro Badge */}
        <View style={styles.proBadgeContainer}>
          <LinearGradient
            colors={[colors.gold, colors.bronze]}
            style={styles.proBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.proBadgeText}>PRO FEATURE</Text>
          </LinearGradient>
        </View>

        {/* Benefits List */}
        <ScrollView
          style={styles.benefitsScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.benefitsList}>
            {content.benefits.map((benefit, index) => (
              <View key={index} style={styles.benefitItem}>
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkIcon}>✓</Text>
                </View>
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* CTA Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={onUpgrade}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.gold, colors.bronze]}
              style={styles.upgradeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.upgradeText}>{content.cta}</Text>
              <Text style={styles.upgradePricing}>$4.99/month or $39.99/year</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalContainer: {
    width: MODAL_WIDTH,
    maxWidth: 480,
    maxHeight: '85%',
  },
  glassmorphicCard: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.gold + '40',
    backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.charcoal,
  },
  androidFallback: {
    backgroundColor: colors.charcoal,
  },
  content: {
    padding: spacing.xl,
  },
  iconContainer: {
    alignSelf: 'center',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.gold + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    borderWidth: 2,
    borderColor: colors.gold + '40',
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 26,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  proBadgeContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  proBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  proBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  benefitsScroll: {
    maxHeight: 240,
    marginBottom: spacing.lg,
  },
  benefitsList: {
    gap: spacing.md,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginTop: 2,
  },
  checkmarkIcon: {
    fontSize: 14,
    color: colors.charcoal,
    fontWeight: 'bold',
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    color: colors.text.primary,
    lineHeight: 22,
  },
  actions: {
    gap: spacing.md,
  },
  upgradeButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  upgradeGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  upgradeText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.charcoal,
    marginBottom: 4,
  },
  upgradePricing: {
    fontSize: 13,
    color: colors.charcoal,
    opacity: 0.8,
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    color: colors.text.secondary,
  },
});
