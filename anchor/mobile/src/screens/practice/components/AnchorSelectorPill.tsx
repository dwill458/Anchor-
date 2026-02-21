import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import type { Anchor } from '@/types';
import { GlassCard, OptimizedImage } from '@/components/common';
import { colors, spacing, typography } from '@/theme';

interface AnchorSelectorPillProps {
  anchor?: Anchor;
  onPress: () => void;
}

const AVATAR_SIZE = 44;

function getAnchorName(anchor?: Anchor): string {
  if (!anchor) return 'Select an anchor';
  const trimmed = anchor.intentionText.trim();
  if (!trimmed) return 'Untitled anchor';
  if (trimmed.length <= 28) return trimmed;
  return `${trimmed.slice(0, 27)}...`;
}

export const AnchorSelectorPill: React.FC<AnchorSelectorPillProps> = ({ anchor, onPress }) => {
  const sigil = anchor?.reinforcedSigilSvg ?? anchor?.baseSigilSvg;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={anchor ? `Selected anchor: ${getAnchorName(anchor)}` : 'Select an anchor'}
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
    >
      <GlassCard contentStyle={styles.cardContent} style={styles.card}>
        <View style={styles.avatarWrap}>
          {anchor ? <View style={styles.avatarHalo} /> : null}
          <View style={styles.avatar}>
            {anchor?.enhancedImageUrl ? (
              <OptimizedImage uri={anchor.enhancedImageUrl} style={styles.avatarImage} resizeMode="cover" />
            ) : sigil ? (
              <SvgXml xml={sigil} width={AVATAR_SIZE} height={AVATAR_SIZE} />
            ) : (
              <Text style={styles.avatarFallback}>◈</Text>
            )}
          </View>
        </View>

        <View style={styles.textWrap}>
          <Text style={styles.label}>Choose your anchor</Text>
          <Text style={styles.value} numberOfLines={1}>
            {getAnchorName(anchor)}
          </Text>
        </View>

        {anchor?.isCharged ? (
          <View style={styles.chargedBadge}>
            <View style={styles.badgeHalo} />
            <Text style={styles.chargedText}>Charged</Text>
          </View>
        ) : null}
      </GlassCard>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 20,
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.995 }],
  },
  card: {
    borderColor: 'rgba(212, 175, 55, 0.26)',
  },
  cardContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHalo: {
    position: 'absolute',
    width: AVATAR_SIZE + 10,
    height: AVATAR_SIZE + 10,
    borderRadius: (AVATAR_SIZE + 10) / 2,
    backgroundColor: 'rgba(212, 175, 55, 0.12)',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  avatarFallback: {
    fontFamily: typography.fontFamily.serif,
    color: colors.gold,
    fontSize: 18,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    fontFamily: typography.fontFamily.sans,
    fontSize: 11,
    color: colors.text.tertiary,
    letterSpacing: 0.3,
  },
  value: {
    marginTop: 2,
    fontFamily: typography.fontFamily.sansBold,
    fontSize: 15,
    color: colors.text.primary,
  },
  chargedBadge: {
    position: 'relative',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.36)',
    backgroundColor: 'rgba(212,175,55,0.12)',
    overflow: 'hidden',
  },
  badgeHalo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(212,175,55,0.1)',
  },
  chargedText: {
    fontFamily: typography.fontFamily.sansBold,
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 0.4,
  },
});
