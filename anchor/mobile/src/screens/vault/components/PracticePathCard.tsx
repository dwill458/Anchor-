/**
 * Practice Path Card Component
 *
 * Collapsible accordion showing practice progress:
 * - Collapsed: 3-step checklist (Create/Charge/Activate)
 * - Expanded: Activation history + streak context
 * - Animated expand/collapse with haptic feedback
 */

import React, { useState, useRef } from 'react';
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
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { Anchor } from '@/types';
import { colors, spacing, typography } from '@/theme';
import { AnchorState } from '../utils/anchorStateHelpers';
import { safeHaptics } from '@/utils/haptics';

interface PracticePathCardProps {
  anchor: Anchor;
  anchorState: AnchorState;
  activationsThisWeek: number;
}

export const PracticePathCard: React.FC<PracticePathCardProps> = ({
  anchor,
  anchorState,
  activationsThisWeek,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const heightAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const toggleExpanded = () => {
    safeHaptics.impact(Haptics.ImpactFeedbackStyle.Light);

    Animated.parallel([
      Animated.timing(heightAnim, {
        toValue: isExpanded ? 0 : 1,
        duration: 300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false, // Height cannot use native driver
      }),
      Animated.timing(rotateAnim, {
        toValue: isExpanded ? 0 : 1,
        duration: 300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();

    setIsExpanded(!isExpanded);
  };

  const chevronRotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const expandedHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 200], // Adjust based on content
  });

  return (
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
  );

  function renderCardContent() {
    return (
      <View style={styles.content}>
        {/* Header */}
        <TouchableOpacity
          style={styles.header}
          onPress={toggleExpanded}
          activeOpacity={0.7}
        >
          <Text style={styles.title}>Your Practice</Text>
          <Animated.Text
            style={[
              styles.chevron,
              {
                transform: [{ rotate: chevronRotation }],
              },
            ]}
          >
            ▼
          </Animated.Text>
        </TouchableOpacity>

        {/* Collapsed: 3-step checklist */}
        <View style={styles.checklistContainer}>
          {/* Step 1: Create */}
          <View style={styles.checklistItem}>
            <View style={styles.checklistIcon}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
            <Text style={styles.checklistText}>Create</Text>
          </View>

          {/* Step 2: Charge */}
          <View style={styles.checklistItem}>
            {anchor.isCharged ? (
              <View style={styles.checklistIcon}>
                <Text style={styles.checkmark}>✓</Text>
              </View>
            ) : (
              <View style={[styles.checklistIcon, styles.checklistIconPending]}>
                <Text style={styles.nextBadge}>Next</Text>
              </View>
            )}
            <Text style={styles.checklistText}>Charge</Text>
          </View>

          {/* Step 3: Activate daily */}
          <View style={styles.checklistItem}>
            <View style={styles.activationCountBadge}>
              <Text style={styles.activationCountText}>
                {activationsThisWeek}/7
              </Text>
            </View>
            <Text style={styles.checklistText}>Activate daily</Text>
          </View>
        </View>

        {/* Expanded: Activation history */}
        <Animated.View
          style={[
            styles.expandedContent,
            {
              height: expandedHeight,
              opacity: heightAnim,
            },
          ]}
        >
          <View style={styles.divider} />

          {/* Activation history section */}
          <Text style={styles.sectionTitle}>Recent Activations</Text>

          {anchor.activationCount > 0 && anchor.lastActivatedAt ? (
            <View style={styles.historyList}>
              {/* Placeholder: Show last activation (real implementation would iterate history array) */}
              <View style={styles.historyItem}>
                <View style={styles.historyDot} />
                <Text style={styles.historyDate}>
                  {format(new Date(anchor.lastActivatedAt), 'MMM d, yyyy')}
                </Text>
              </View>

              {/* TODO: Replace with actual activation history when available */}
              <Text style={styles.placeholderText}>
                Full activation history coming soon
              </Text>
            </View>
          ) : (
            <Text style={styles.emptyText}>No activations yet</Text>
          )}

          {/* Streak context */}
          <View style={styles.streakSection}>
            <Text style={styles.streakLabel}>Streak:</Text>
            <Text style={styles.streakValue}>
              {/* TODO: Calculate real streak from activation history */}
              {activationsThisWeek > 0 ? '1 day' : '0 days'}
            </Text>
          </View>
        </Animated.View>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  glassmorphicCard: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `rgba(212, 175, 55, 0.15)`,
    backgroundColor:
      Platform.OS === 'ios' ? 'transparent' : 'rgba(26, 26, 29, 0.9)',
  },
  androidFallback: {
    backgroundColor: 'rgba(26, 26, 29, 0.9)',
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fonts.heading,
    color: colors.gold,
  },
  chevron: {
    fontSize: 16,
    color: colors.gold,
  },
  checklistContainer: {
    gap: spacing.md,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  checklistIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${colors.gold}30`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistIconPending: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: `${colors.gold}50`,
  },
  checkmark: {
    fontSize: 14,
    color: colors.gold,
    fontWeight: '700',
  },
  nextBadge: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  checklistText: {
    fontSize: typography.fontSize.md,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
  },
  activationCountBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: `${colors.gold}50`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activationCountText: {
    fontSize: 10,
    color: colors.gold,
    fontWeight: '600',
  },
  expandedContent: {
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    backgroundColor: `${colors.gold}20`,
    marginVertical: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyList: {
    gap: spacing.sm,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  historyDate: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fonts.body,
    color: colors.text.primary,
  },
  placeholderText: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  emptyText: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    fontStyle: 'italic',
  },
  streakSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  streakLabel: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fonts.body,
    color: colors.text.secondary,
  },
  streakValue: {
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fonts.body,
    color: colors.gold,
    fontWeight: '600',
  },
});
