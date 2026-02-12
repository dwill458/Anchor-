/**
 * Depth Card Component
 *
 * Sacred depth selection cards for Light and Deep charging modes.
 * Visual hierarchy privileges Deep ritual over Light charge.
 *
 * Design Principles:
 * - Deep (Ritual): Larger, softer glow, slower feel
 * - Light (Focus): Smaller, sharper borders, quick exit feel
 * - Floating panels with glassmorphic effect
 * - Reduced borders and contrast for sacred aesthetic
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Animated,
} from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { colors, spacing, typography } from '@/theme';
import { safeHaptics } from '@/utils/haptics';
import type { DepthType } from '../utils/transitionConstants';

interface DepthCardProps {
  type: DepthType;
  isSelected: boolean;
  onSelect: () => void;
  opacity: Animated.Value;
}

export const DepthCard: React.FC<DepthCardProps> = ({
  type,
  isSelected,
  onSelect,
  opacity,
}) => {
  const isDeep = type === 'deep';

  // ══════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ══════════════════════════════════════════════════════════════

  const config = {
    deep: {
      label: 'Deep Ritual',
      subtitle: 'A guided, immersive experience',
      description: 'Multi-phase ceremony for lasting transformation',
      durations: '5 min · 10 min · Custom',
      height: 180,
      shadowRadius: 20,
      borderWidth: 1.5,
      glowColor: colors.bronze,
    },
    light: {
      label: 'Light Charge',
      subtitle: 'A brief moment of alignment',
      description: 'Quick energy boost for focused attention',
      durations: '30 sec · 2 min · 5 min',
      height: 150,
      shadowRadius: 12,
      borderWidth: 2,
      glowColor: colors.gold,
    },
  };

  const settings = config[type];

  // ══════════════════════════════════════════════════════════════
  // HANDLERS
  // ══════════════════════════════════════════════════════════════

  const handlePress = () => {
    void safeHaptics.selection();
    onSelect();
  };

  // ══════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity,
          height: settings.height,
        },
      ]}
    >
      <TouchableOpacity
        onPress={handlePress}
        activeOpacity={0.8}
        accessibilityRole="radio"
        accessibilityLabel={type === 'light' ? 'Focus mode' : 'Ritual mode'}
        accessibilityState={{ selected: isSelected }}
        style={styles.touchable}
      >
        <View
          style={[
            styles.card,
            {
              borderWidth: settings.borderWidth,
              borderColor: isSelected
                ? settings.glowColor
                : `rgba(192, 192, 192, 0.15)`,
              shadowColor: settings.glowColor,
              shadowRadius: isSelected ? settings.shadowRadius : settings.shadowRadius * 0.5,
              shadowOpacity: isSelected ? 0.4 : 0.2,
            },
          ]}
        >
          {Platform.OS === 'ios' ? (
            <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill}>
              {renderCardContent()}
            </BlurView>
          ) : (
            <View style={[styles.androidFallback, { backgroundColor: 'rgba(12, 17, 24, 0.92)' }]}>
              {renderCardContent()}
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  // ══════════════════════════════════════════════════════════════
  // CARD CONTENT
  // ══════════════════════════════════════════════════════════════

  function renderCardContent() {
    return (
      <View
        style={[
          styles.content,
          {
            backgroundColor: isSelected
              ? `${settings.glowColor}15`
              : 'rgba(255, 255, 255, 0.02)',
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text
            style={[
              styles.label,
              isDeep && styles.labelDeep,
              { color: isSelected ? settings.glowColor : colors.text.primary },
            ]}
          >
            {settings.label}
          </Text>
          {isSelected && (
            <View
              style={[
                styles.checkmark,
                { backgroundColor: settings.glowColor },
              ]}
            >
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          )}
        </View>

        {/* Subtitle */}
        <Text
          style={[
            styles.subtitle,
            { color: isSelected ? settings.glowColor : colors.text.secondary },
          ]}
        >
          {settings.subtitle}
        </Text>

        {/* Description */}
        <Text style={styles.description}>
          {settings.description}
        </Text>

        {/* Durations */}
        <View style={styles.durationsContainer}>
          <Text style={styles.durations}>
            {settings.durations}
          </Text>
        </View>
      </View>
    );
  }
};

// ══════════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },

  touchable: {
    flex: 1,
  },

  card: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor:
      Platform.OS === 'ios' ? 'transparent' : 'rgba(26, 26, 29, 0.95)',
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },

  androidFallback: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 29, 0.95)',
  },

  content: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  label: {
    fontSize: typography.sizes.h4,
    fontFamily: typography.fonts.heading,
    letterSpacing: 0.5,
  },

  labelDeep: {
    fontSize: typography.sizes.h3,
  },

  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  checkmarkText: {
    fontSize: 14,
    color: colors.background.primary,
    fontWeight: 'bold',
  },

  subtitle: {
    fontSize: typography.sizes.body1,
    fontFamily: typography.fonts.body,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },

  description: {
    fontSize: typography.sizes.body2,
    fontFamily: typography.fonts.body,
    color: colors.text.tertiary,
    marginTop: spacing.sm,
    lineHeight: typography.lineHeights.body2,
  },

  durationsContainer: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(192, 192, 192, 0.1)',
  },

  durations: {
    fontSize: typography.sizes.caption,
    fontFamily: typography.fonts.bodyBold,
    color: colors.text.tertiary,
    letterSpacing: 1,
  },
});
