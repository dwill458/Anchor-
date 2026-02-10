/**
 * AnchorLimitModal
 *
 * Specialized modal for anchor creation limits.
 * Offers two paths: upgrade to Pro OR burn an existing anchor to make room.
 *
 * @example
 * <AnchorLimitModal
 *   visible={showLimit}
 *   currentCount={2}
 *   maxCount={2}
 *   onClose={() => setShowLimit(false)}
 *   onUpgrade={() => navigation.navigate('Settings')}
 *   onBurnAnchor={() => console.log('burn initiated')}
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
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '@/theme';

const { width } = Dimensions.get('window');
const MODAL_WIDTH = width * 0.9;

interface AnchorLimitModalProps {
  visible: boolean;
  currentCount: number;
  maxCount: number;
  onClose: () => void;
  onUpgrade: () => void;
  onBurnAnchor: () => void;
}

export function AnchorLimitModal({
  visible,
  currentCount,
  maxCount,
  onClose,
  onUpgrade,
  onBurnAnchor,
}: AnchorLimitModalProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

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
              <View style={[styles.glassmorphicCard, styles.androidFallback]}>
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
          <Text style={styles.icon}>⚓</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>Anchor Vault Full</Text>
        <Text style={styles.subtitle}>Your sacred space is complete</Text>

        {/* Anchor Count Badge */}
        <View style={styles.badgeContainer}>
          <LinearGradient
            colors={[colors.gold, colors.bronze]}
            style={styles.badge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.badgeText}>
              {currentCount}/{maxCount} ANCHORS
            </Text>
          </LinearGradient>
        </View>

        {/* Body Text */}
        <Text style={styles.bodyText}>
          You've reached your free tier limit of {maxCount} anchors. Choose how to proceed:
        </Text>

        {/* CTA Buttons */}
        <View style={styles.actions}>
          {/* Upgrade to Pro Button */}
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
              <Text style={styles.upgradeText}>Upgrade to Pro</Text>
              <Text style={styles.upgradeSubtext}>Unlimited anchors</Text>
              <Text style={styles.upgradePricing}>$4.99/month or $39.99/year</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Burn an Anchor Button */}
          <TouchableOpacity
            style={styles.burnButton}
            onPress={onBurnAnchor}
            activeOpacity={0.8}
          >
            <View style={styles.burnButtonInner}>
              <Text style={styles.burnText}>Burn an Anchor</Text>
              <Text style={styles.burnSubtext}>Release one to make room</Text>
            </View>
          </TouchableOpacity>

          {/* Maybe Later Button */}
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
  badgeContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.charcoal,
    letterSpacing: 1,
  },
  bodyText: {
    fontSize: 15,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
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
    marginBottom: 2,
  },
  upgradeSubtext: {
    fontSize: 14,
    color: colors.charcoal,
    opacity: 0.9,
    marginBottom: 4,
  },
  upgradePricing: {
    fontSize: 13,
    color: colors.charcoal,
    opacity: 0.8,
  },
  burnButton: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.gold + '60',
    overflow: 'hidden',
  },
  burnButtonInner: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  burnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.gold,
    marginBottom: 2,
  },
  burnSubtext: {
    fontSize: 13,
    color: colors.text.secondary,
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
