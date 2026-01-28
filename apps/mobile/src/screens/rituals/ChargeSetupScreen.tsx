/**
 * Anchor App - Charge Setup Screen
 *
 * Consolidated entry point for charging ritual.
 * Replaces separate priming + charge choice screens.
 * Zen Architect theme: glassmorphic cards, gold accents, centered symbol.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { SvgXml } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useAnchorStore } from '@/stores/anchorStore';
import type { RootStackParamList } from '@/types';
import { colors, spacing, typography } from '@/theme';

const { width } = Dimensions.get('window');

type ChargeSetupRouteProp = RouteProp<RootStackParamList, 'ChargeSetup'>;
type ChargeSetupNavigationProp = StackNavigationProp<
  RootStackParamList,
  'ChargeSetup'
>;

export const ChargeSetupScreen: React.FC = () => {
  const navigation = useNavigation<ChargeSetupNavigationProp>();
  const route = useRoute<ChargeSetupRouteProp>();
  const { anchorId } = route.params;

  const { getAnchorById } = useAnchorStore();
  const anchor = getAnchorById(anchorId);

  const [infoSheetVisible, setInfoSheetVisible] = useState(false);

  // Subtle idle pulse animation for symbol
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // ══════════════════════════════════════════════════════════════
  // NULL SAFETY: Defensive handling if anchor is missing
  // ══════════════════════════════════════════════════════════════

  if (!anchor) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Anchor Not Found</Text>
          <Text style={styles.errorText}>
            We couldn't load your anchor. Please try again.
          </Text>
          <TouchableOpacity
            style={styles.errorButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.8}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ══════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════

  const handleQuickCharge = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Ritual', {
      anchorId,
      ritualType: 'quick',
    });
  };

  const handleDeepCharge = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Ritual', {
      anchorId,
      ritualType: 'deep',
    });
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const openInfoSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setInfoSheetVisible(true);
  };

  const closeInfoSheet = () => {
    setInfoSheetVisible(false);
  };

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Bar */}
      <BlurView intensity={20} tint="dark" style={styles.headerBar}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Charge Your Anchor</Text>
        <View style={styles.backButton} />
      </BlurView>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Symbol */}
        <View style={styles.symbolSection}>
          <Animated.View
            style={[
              styles.symbolContainer,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <SvgXml
              xml={anchor.baseSigilSvg}
              width={180}
              height={180}
            />
          </Animated.View>
        </View>

        {/* Intention Display */}
        <View style={styles.intentionSection}>
          <Text style={styles.intentionLabel}>YOUR INTENTION</Text>
          <Text style={styles.intentionText} numberOfLines={2}>
            {anchor.intentionText}
          </Text>
        </View>

        {/* Option Cards */}
        <View style={styles.optionsContainer}>
          {/* Quick Charge Card */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={handleQuickCharge}
            activeOpacity={0.8}
          >
            <BlurView intensity={10} tint="dark" style={styles.cardBlur}>
              <View style={[styles.cardContent, styles.quickCardBorder]}>
                <Text style={styles.optionIcon}>⚡</Text>
                <Text style={styles.optionTitle}>Quick Charge</Text>
                <Text style={styles.optionDuration}>30 seconds</Text>
                <Text style={styles.optionDescription}>
                  Instant focus boost
                </Text>
              </View>
            </BlurView>
          </TouchableOpacity>

          {/* Deep Charge Card */}
          <TouchableOpacity
            style={styles.optionCard}
            onPress={handleDeepCharge}
            activeOpacity={0.8}
          >
            <BlurView intensity={10} tint="dark" style={styles.cardBlur}>
              <View style={[styles.cardContent, styles.deepCardBorder]}>
                <Text style={styles.optionIcon}>🔥</Text>
                <Text style={styles.optionTitle}>Deep Charge</Text>
                <Text style={styles.optionDuration}>~5 minutes</Text>
                <Text style={styles.optionDescription}>
                  5 phases for lasting impact
                </Text>
              </View>
            </BlurView>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Info Button (Floating) */}
      <TouchableOpacity
        style={styles.infoButton}
        onPress={openInfoSheet}
        activeOpacity={0.8}
      >
        <BlurView intensity={20} tint="dark" style={styles.infoBlur}>
          <Text style={styles.infoIcon}>ⓘ</Text>
        </BlurView>
      </TouchableOpacity>

      {/* Info Bottom Sheet Modal */}
      <Modal
        visible={infoSheetVisible}
        transparent
        animationType="slide"
        onRequestClose={closeInfoSheet}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeInfoSheet}
        >
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHandle} />
            <ScrollView
              contentContainerStyle={styles.sheetContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.sheetTitle}>Why Charge Your Anchor?</Text>
              <Text style={styles.sheetText}>
                Charging is the process of linking your intention to the anchor
                symbol through focused attention and emotional resonance.
              </Text>
              <Text style={styles.sheetText}>
                This ritual strengthens the neural pathway between the visual
                symbol and your desired outcome, making it a powerful trigger
                for motivation and clarity when you need it most.
              </Text>
              <Text style={styles.sheetSubtitle}>Quick vs Deep</Text>
              <Text style={styles.sheetText}>
                <Text style={styles.sheetBold}>Quick Charge</Text> is a 30-second
                focused session — perfect for a fast boost.
              </Text>
              <Text style={styles.sheetText}>
                <Text style={styles.sheetBold}>Deep Charge</Text> is a 5-minute
                guided ritual with breathwork, mantra, visualization, and sealing
                — ideal for maximum impact.
              </Text>
              <TouchableOpacity
                style={styles.sheetButton}
                onPress={closeInfoSheet}
                activeOpacity={0.8}
              >
                <Text style={styles.sheetButtonText}>Got it</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },

  // ────────────────────────────────────────────────────────────
  // Header
  // ────────────────────────────────────────────────────────────
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.gold}20`,
    overflow: 'hidden',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  backIcon: {
    fontSize: 24,
    color: colors.gold,
  },
  headerTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    letterSpacing: 0.5,
  },

  // ────────────────────────────────────────────────────────────
  // Symbol Section
  // ────────────────────────────────────────────────────────────
  symbolSection: {
    alignItems: 'center',
    paddingTop: spacing.xxxl + spacing.lg,
  },
  symbolContainer: {
    padding: spacing.md,
  },

  // ────────────────────────────────────────────────────────────
  // Intention Section
  // ────────────────────────────────────────────────────────────
  intentionSection: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  intentionLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
    letterSpacing: 1.2,
    marginBottom: spacing.xs,
  },
  intentionText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.body1,
  },

  // ────────────────────────────────────────────────────────────
  // Option Cards
  // ────────────────────────────────────────────────────────────
  optionsContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  optionCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardBlur: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  cardContent: {
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
  },
  quickCardBorder: {
    borderColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  deepCardBorder: {
    borderColor: colors.bronze,
    shadowColor: colors.bronze,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  optionIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  optionTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  optionDuration: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.bodyBold,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  optionDescription: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
  },

  // ────────────────────────────────────────────────────────────
  // Info Button
  // ────────────────────────────────────────────────────────────
  infoButton: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  infoBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${colors.gold}40`,
  },
  infoIcon: {
    fontSize: 28,
    color: colors.gold,
  },

  // ────────────────────────────────────────────────────────────
  // Bottom Sheet Modal
  // ────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: colors.background.secondary,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.md,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.text.tertiary,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
  },
  sheetTitle: {
    fontSize: typography.sizes.h3,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.md,
  },
  sheetSubtitle: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.headingSemiBold,
    color: colors.text.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sheetText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body2,
    marginBottom: spacing.md,
  },
  sheetBold: {
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.primary,
  },
  sheetButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.gold,
    borderRadius: 12,
    alignItems: 'center',
  },
  sheetButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.navy,
  },

  // ────────────────────────────────────────────────────────────
  // Error State
  // ────────────────────────────────────────────────────────────
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.sizes.h2,
    fontFamily: typography.fonts.heading,
    color: colors.error,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  errorButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.gold,
    borderRadius: 12,
  },
  errorButtonText: {
    fontSize: typography.sizes.button,
    fontFamily: typography.fonts.bodyBold,
    color: colors.navy,
  },
});
