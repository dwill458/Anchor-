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
 *   onRestore={() => handleRestore()}
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
  Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useReducedMotion } from 'react-native-reanimated';
import { colors, spacing, typography } from '@/theme';

const { width, height } = Dimensions.get('window');
const MODAL_WIDTH = width * 0.9;

interface ProPaywallModalProps {
  visible: boolean;
  feature: string;
  onClose: () => void;
  onUpgrade: () => void;
  onRestore?: () => void;
}

// Feature-specific content
const FEATURE_CONTENT = {
  manual_forge: {
    title: 'Forge from Scratch',
    subtitle: 'Draw your anchor exactly as you envision it.',
    icon: '🔥',
    benefits: [
      'Build a sigil that feels truly yours',
      'Blank canvas with pro-grade tools',
      '6 brush styles',
      'Symmetry modes',
      'Unlimited undo/redo',
    ],
    cta: 'Unlock Manual Forge',
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
  onRestore,
}: ProPaywallModalProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const iconGlowAnim = useRef(new Animated.Value(0)).current;
  const ctaShimmerAnim = useRef(new Animated.Value(0)).current;

  // Utilize useReducedMotion to check accessibility settings synchronously
  const reducedMotion = useReducedMotion();

  const content = FEATURE_CONTENT[feature as keyof typeof FEATURE_CONTENT] || FEATURE_CONTENT.manual_forge;

  useEffect(() => {
    let idleAnimLoop: any = null;

    if (visible) {
      // Entrance animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: reducedMotion ? 300 : 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        ...(reducedMotion
          ? []
          : [
            Animated.timing(slideAnim, {
              toValue: 0,
              duration: 450,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
          ]),
      ]).start();

      if (!reducedMotion) {
        // Icon badge glow pulse once over 450-650ms after modal entrance
        Animated.sequence([
          Animated.delay(100),
          Animated.timing(iconGlowAnim, {
            toValue: 1,
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(iconGlowAnim, {
            toValue: 0.3, // fallback settling state
            duration: 650,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]).start();

        // Idle CTA soft breathing glow loop (every 7 seconds)
        idleAnimLoop = Animated.loop(
          Animated.sequence([
            Animated.delay(7000),
            Animated.timing(ctaShimmerAnim, {
              toValue: 1,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(ctaShimmerAnim, {
              toValue: 0,
              duration: 800,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
            }),
          ])
        );
        idleAnimLoop.start();
      }
    } else {
      // Exit animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 20,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Reset values
      iconGlowAnim.setValue(0);
      ctaShimmerAnim.setValue(0);
      if (idleAnimLoop) {
        idleAnimLoop.stop();
      }
    }

    return () => {
      if (idleAnimLoop) {
        idleAnimLoop.stop();
      }
    };
  }, [visible, reducedMotion]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        {/* Full-screen dim overlay: dim required, blur requested */}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}>
          <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(6, 11, 25, 0.72)', 'rgba(3, 5, 12, 0.95)']}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity activeOpacity={1} style={styles.contentWrapper}>
            {Platform.OS === 'ios' ? (
              <BlurView intensity={45} tint="dark" style={styles.glassmorphicCard}>
                {/* Soft inner highlight near the top to suggest glass reflection */}
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.08)', 'transparent']}
                  style={styles.innerHighlight}
                  pointerEvents="none"
                />
                {renderContent()}
              </BlurView>
            ) : (
              <View style={[styles.glassmorphicCard, styles.androidFallback]}>
                {renderContent()}
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );

  function renderContent() {
    return (
      <View style={styles.content}>
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          bounces={false}
        >
          {/* Top: circular icon badge with soft gold glow */}
          <View style={styles.iconContainer}>
            <Animated.View style={[StyleSheet.absoluteFill, styles.iconGlowBox, { opacity: iconGlowAnim }]}>
              <LinearGradient
                colors={['rgba(212, 175, 55, 0.35)', 'transparent']}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <Text style={styles.icon}>{content.icon}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title} accessibilityRole="header">{content.title}</Text>
          {/* Subhead (1 line) */}
          <Text style={styles.subtitle}>{content.subtitle}</Text>

          {/* Small pill tag: PRO FEATURE */}
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

          {/* Benefit list: Tighter wording & vertical margin */}
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

        <View style={styles.footer}>
          {/* Primary Action Button */}
          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={onUpgrade}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={content.cta}
          >
            <LinearGradient
              colors={[colors.gold, colors.bronze]}
              style={styles.upgradeGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.upgradeText}>{content.cta}</Text>

              {/* Soft breathing glow overlay on CTA */}
              {!reducedMotion && (
                <Animated.View
                  style={[StyleSheet.absoluteFill, { opacity: ctaShimmerAnim }]}
                  pointerEvents="none"
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(255, 255, 255, 0.4)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Extracted Pricing and Trust Lines (microcopies) */}
          <View style={styles.pricingContainer}>
            <Text style={styles.upgradePricing}>$4.99/month • $39.99/year</Text>
            <Text style={styles.trustLine}>Cancel anytime.</Text>
          </View>

          {/* Bottom Links Container */}
          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={styles.secondaryLinkButton}
              onPress={onClose}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Maybe Later"
              hitSlop={{ top: 14, bottom: 14, left: 16, right: 16 }}
            >
              <Text style={styles.cancelText}>Maybe Later</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryLinkButton}
              onPress={
                onRestore ||
                (() => {
                  Alert.alert(
                    'Restore Purchase',
                    'This functionality will be implemented with RevenueCat integration.'
                  );
                })
              }
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Restore Purchase"
              hitSlop={{ top: 14, bottom: 14, left: 16, right: 16 }}
            >
              <Text style={styles.restoreText}>Restore Purchase</Text>
            </TouchableOpacity>
          </View>
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
  modalContainer: {
    width: MODAL_WIDTH,
    maxWidth: 480,
    maxHeight: height * 0.88,
  },
  contentWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 }, // Kept shadow minimal and soft
    shadowOpacity: 0.2, // Minimized opacity
    shadowRadius: 24,
    elevation: 8,
  },
  glassmorphicCard: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1, // Subtle 1px outer stroke
    borderColor: 'rgba(212, 175, 55, 0.15)', // Desaturated gold white at low opacity
    backgroundColor: Platform.OS === 'ios' ? 'rgba(8, 14, 28, 0.35)' : 'rgba(8, 14, 28, 0.95)',
  },
  androidFallback: {
    backgroundColor: 'rgba(8, 14, 28, 0.95)',
    elevation: 6,
  },
  innerHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 70, // Subtle inner reflection at top edge
  },
  content: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  scrollView: {
    flexGrow: 0,
    maxHeight: height * 0.5,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  iconContainer: {
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  iconGlowBox: {
    borderRadius: 34,
  },
  icon: {
    fontSize: 36,
    lineHeight: 42,
  },
  title: {
    fontSize: 28,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 20,
    opacity: 0.9,
  },
  proBadgeContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  proBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 1.2,
  },
  benefitsList: {
    gap: spacing.sm, // Tightened vertical margins
    paddingHorizontal: spacing.sm,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center', // Snugger vertical alignment
  },
  checkmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  checkmarkIcon: {
    fontSize: 11,
    color: colors.gold,
    fontWeight: '900',
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  footer: {
    marginTop: spacing.xl,
    paddingTop: spacing.xs,
  },
  upgradeButton: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  upgradeGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradeText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.charcoal,
    letterSpacing: 0.3,
  },
  pricingContainer: {
    marginTop: spacing.md, // Seperated cleanly from button
    alignItems: 'center',
    justifyContent: 'center',
  },
  upgradePricing: {
    fontSize: 13,
    color: colors.text.secondary, // Uses premium text colors instead of charcoal
    opacity: 0.85,
    fontWeight: '500',
    marginBottom: 4,
  },
  trustLine: {
    fontSize: 11,
    color: colors.text.tertiary, // micro-copy
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl, // Balanced spacing
    gap: spacing.xl,
  },
  secondaryLinkButton: {
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    color: colors.text.primary,
    opacity: 0.75, // Increased visibility
    fontWeight: '600',
  },
  restoreText: {
    fontSize: 14,
    color: colors.text.primary,
    opacity: 0.75, // Increased visibility
    fontWeight: '600',
  },
});
