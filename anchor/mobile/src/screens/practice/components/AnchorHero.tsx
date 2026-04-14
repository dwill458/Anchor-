import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import type { Anchor } from '@/types';
import { OptimizedImage } from '@/components/common';
import { SvgXml } from 'react-native-svg';
import { colors, spacing, typography } from '@/theme';

interface AnchorHeroProps {
  anchor?: Anchor;
  onPress: () => void;
}

function getName(anchor?: Anchor): string {
  if (!anchor) return 'Select an anchor';
  const name = anchor.name || anchor.title;
  if (name) return name;
  const value = anchor.intentionText?.trim() || '';
  if (!value) return 'Select an anchor';
  return value.length > 20 ? `${value.slice(0, 20)}...` : value;
}

export const AnchorHero: React.FC<AnchorHeroProps> = ({ anchor, onPress }) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.switcherPill, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="Change current anchor"
    >
      <Text style={styles.switcherLabel}>Current anchor</Text>
      <View style={styles.switcherValueWrap}>
        {anchor && (
          <View style={styles.sigilThumbWrap}>
            {anchor.enhancedImageUrl ? (
              <OptimizedImage
                uri={anchor.enhancedImageUrl}
                style={styles.sigilThumb}
                resizeMode="cover"
              />
            ) : anchor.baseSigilSvg ? (
              <SvgXml xml={anchor.baseSigilSvg} width={18} height={18} />
            ) : (
              <Text style={styles.sigilFallback}>◈</Text>
            )}
          </View>
        )}
        <Text style={styles.switcherValue} numberOfLines={1}>
          {getName(anchor)}
        </Text>
        <ChevronDown size={14} color={colors.text.secondary} />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  switcherPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 16,
    backgroundColor: colors.practice.heroSwitcherSurface,
    borderWidth: 1,
    borderColor: colors.practice.heroSwitcherBorder,
    alignItems: 'center',
  },
  pressed: {
    transform: [{ scale: 0.985 }],
  },
  switcherLabel: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  switcherValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  switcherValue: {
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 14,
    color: colors.text.primary,
    maxWidth: 200,
  },
  sigilThumbWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(12, 12, 18, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2a38',
  },
  sigilThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  sigilFallback: {
    fontFamily: typography.fontFamily.serif,
    fontSize: 10,
    color: '#555a6a',
  },
});
