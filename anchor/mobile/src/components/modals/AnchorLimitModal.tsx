/**
 * AnchorLimitModal
 *
 * Specialized modal for anchor creation limits.
 * Offers two paths: upgrade to Pro OR burn an existing anchor to make room.
 * Redesigned for "Zen Architect" design system.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeOut,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Anchor } from 'lucide-react-native';
import { colors, spacing, typography } from '@/theme';

const { width } = Dimensions.get('window');
const MODAL_WIDTH = width * 0.92;

interface AnchorLimitModalProps {
  visible: boolean;
  currentCount: number;
  maxCount: number;
  onClose: () => void;
  onUpgrade: () => void;
  onBurnAnchor: () => void;
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

export function AnchorLimitModal({
  visible,
  currentCount,
  maxCount,
  onClose,
  onUpgrade,
  onBurnAnchor,
}: AnchorLimitModalProps) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.fullscreen}>
        {/* Backdrop Blur Fade In */}
        <Animated.View
          entering={FadeIn.duration(400)}
          exiting={FadeOut.duration(300)}
          style={[StyleSheet.absoluteFill, styles.backdropOverlay]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Modal Card */}
        <Animated.View
          entering={ZoomIn.duration(400).springify().damping(15)}
          exiting={FadeOut.duration(200)}
          style={styles.modalContainer}
        >
          <BlurView intensity={60} tint="dark" style={styles.glassmorphicCard}>
            <View style={styles.content}>
              {/* Icon Header */}
              <View style={styles.iconMedallion}>
                <LinearGradient
                  colors={[colors.gold + '30', 'transparent']}
                  style={styles.iconGlow}
                />
                <Anchor color={colors.gold} size={32} strokeWidth={1.5} />
              </View>

              {/* Header Text */}
              <Text style={styles.title}>Anchor Vault Full</Text>
              <Text style={styles.subtitle}>Capacity reached</Text>

              {/* Capacity Indicator */}
              <View style={styles.capacityContainer}>
                <View style={styles.capacityPill}>
                  <Text style={styles.capacityText}>{currentCount} / {maxCount} used</Text>
                </View>
                <View style={styles.progressBarBg}>
                  <Animated.View
                    style={[
                      styles.progressBarFill,
                      { width: `${(currentCount / maxCount) * 100}%` }
                    ]}
                  />
                </View>
              </View>

              {/* Body Text */}
              <Text style={styles.bodyText}>
                You have reached the limit for free anchors. Upgrade for unlimited space or release one to continue.
              </Text>

              {/* Action Blocks */}
              <View style={styles.actions}>
                {/* Upgrade to Pro Button */}
                <ActionButton
                  onPress={onUpgrade}
                  primary
                  title="Upgrade to Pro"
                  supportingLine="Unlimited storage and premium features"
                  priceLine="$4.99/month or $39.99/year"
                />

                {/* Burn an Anchor Button */}
                <ActionButton
                  onPress={onBurnAnchor}
                  title="Burn an Anchor"
                  supportingLine="Release one to create space"
                  reassurance="Select which anchor to let go."
                />

                {/* Maybe Later */}
                <TouchableOpacity
                  style={styles.tertiaryButton}
                  onPress={onClose}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Maybe later"
                >
                  <Text style={styles.tertiaryText}>Maybe later</Text>
                </TouchableOpacity>
              </View>
            </View>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
}

interface ActionButtonProps {
  onPress: () => void;
  title: string;
  supportingLine: string;
  primary?: boolean;
  priceLine?: string;
  reassurance?: string;
}

function ActionButton({ onPress, title, supportingLine, primary, priceLine, reassurance }: ActionButtonProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => (scale.value = withSpring(0.97));
  const handlePressOut = () => (scale.value = withSpring(1));

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.actionBlock,
          primary ? styles.primaryBlock : styles.secondaryBlock
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${supportingLine}${priceLine ? `. ${priceLine}` : ''}`}
      >
        {primary && (
          <LinearGradient
            colors={[colors.gold, '#B8941F']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}
        <View style={styles.blockInner}>
          <Text style={[styles.actionTitle, primary && styles.primaryText]}>{title}</Text>
          <Text style={[styles.actionSupporting, primary && styles.primaryText]}>{supportingLine}</Text>
          {priceLine && <Text style={[styles.actionPrice, primary && styles.primaryText]}>{priceLine}</Text>}
          {reassurance && <Text style={styles.reassuranceText}>{reassurance}</Text>}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropOverlay: {
    backgroundColor: 'rgba(8, 10, 14, 0.85)',
  },
  modalContainer: {
    width: MODAL_WIDTH,
    maxWidth: 420,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gold + '33', // ~20% opacity
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  glassmorphicCard: {
    backgroundColor: 'rgba(15, 20, 25, 0.7)',
  },
  content: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  iconMedallion: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(15, 20, 25, 0.8)',
    borderWidth: 1,
    borderColor: colors.gold + '40',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 36,
  },
  title: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 28,
    color: colors.gold,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  capacityContainer: {
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.lg,
  },
  capacityPill: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.gold + '30',
    marginBottom: 8,
  },
  capacityText: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 12,
    color: colors.gold,
    letterSpacing: 0.5,
  },
  progressBarBg: {
    width: 140,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 2,
  },
  bodyText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 15,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  actions: {
    width: '100%',
    gap: spacing.md,
  },
  actionBlock: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 16,
    alignItems: 'center',
  },
  primaryBlock: {
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryBlock: {
    borderWidth: 1,
    borderColor: colors.gold + '40',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  blockInner: {
    alignItems: 'center',
    zIndex: 1,
  },
  actionTitle: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 18,
    color: colors.gold,
    marginBottom: 2,
  },
  actionSupporting: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  actionPrice: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 12,
    opacity: 0.8,
    color: colors.text.secondary,
  },
  reassuranceText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    fontStyle: 'italic',
    color: colors.text.tertiary,
    marginTop: 4,
  },
  primaryText: {
    color: colors.charcoal,
  },
  tertiaryButton: {
    marginTop: spacing.sm,
    paddingVertical: 12,
  },
  tertiaryText: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 15,
    color: colors.text.secondary,
  },
});
