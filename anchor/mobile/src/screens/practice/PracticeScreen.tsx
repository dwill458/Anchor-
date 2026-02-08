/**
 * Anchor App - Practice Screen
 *
 * Daily practice hub for activating anchors and building streaks.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { colors, spacing, typography } from '@/theme';
import { ZenBackground } from '@/components/common';

export const PracticeScreen: React.FC = () => {
  return (
    <View style={styles.root}>
      <ZenBackground showOrbs orbOpacity={0.1} />
      <View style={styles.overlay} />

      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Practice</Text>
            <Text style={styles.subtitle}>Activate an anchor, build your streak</Text>
          </View>

          <View style={styles.cardShell}>
            <BlurView intensity={18} tint="dark" style={styles.blurCard}>
              <Text style={styles.streakLabel}>Current Streak</Text>
              <Text style={styles.streakValue}>0 days</Text>
              <Text style={styles.streakSubtext}>
                Start your daily practice to build momentum
              </Text>
            </BlurView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Practice</Text>

            <View style={styles.cardShell}>
              <BlurView intensity={16} tint="dark" style={[styles.blurCard, styles.disabledCard]}>
                <Text style={styles.actionTitle}>Activate Last Anchor</Text>
                <Text style={styles.actionSubtext}>No active anchors yet</Text>
              </BlurView>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Create your first anchor to begin your practice journey.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.ritual.overlay,
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.h1,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body1,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  cardShell: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.ritual.border,
    backgroundColor: colors.ritual.glass,
  },
  blurCard: {
    padding: spacing.lg,
  },
  streakLabel: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: spacing.sm,
  },
  streakValue: {
    fontSize: 44,
    fontFamily: typography.fonts.headingBold,
    color: colors.gold,
    marginBottom: spacing.sm,
  },
  streakSubtext: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body2,
  },
  disabledCard: {
    opacity: 0.7,
  },
  actionTitle: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  actionSubtext: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
  },
  infoCard: {
    borderRadius: 14,
    padding: spacing.md,
    backgroundColor: colors.ritual.glass,
    borderWidth: 1,
    borderColor: colors.ritual.border,
  },
  infoText: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    lineHeight: typography.lineHeights.body2,
  },
});
