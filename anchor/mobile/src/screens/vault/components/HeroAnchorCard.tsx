/**
 * HeroAnchorCard — Circular hero display for the primary anchor.
 *
 * Shows the sigil/image inside a large circle (matching the AnchorReveal screen)
 * with a gold ring border, glow backdrop, and text info below.
 */

import React, { useEffect } from 'react';
import {
  Dimensions,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { colors } from '@/theme';
import type { Anchor, AnchorCategory } from '@/types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const H_PAD = 28;
// Scale circle to ~38% of screen height so everything fits without scrolling
const CIRCLE_SIZE = Math.min(SCREEN_WIDTH - H_PAD * 2 - 40, Math.round(SCREEN_HEIGHT * 0.32));

function formatCategory(cat: AnchorCategory): string {
  const labels: Record<AnchorCategory, string> = {
    career: 'Career',
    health: 'Health',
    wealth: 'Wealth',
    relationships: 'Relationships',
    personal_growth: 'Growth',
    desire: 'Desire',
    experience: 'Experience',
    custom: 'Custom',
  };
  return labels[cat] ?? 'Custom';
}

function anchorDisplayName(anchor: Anchor): string {
  return `${formatCategory(anchor.category)} Anchor`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface HeroAnchorCardProps {
  anchor: Anchor;
  onPress: () => void;
  reduceMotionEnabled?: boolean;
}

export const HeroAnchorCard: React.FC<HeroAnchorCardProps> = ({
  anchor,
  onPress,
  reduceMotionEnabled = false,
}) => {
  const imageUrl = anchor.enhancedImageUrl;
  const sigilSvg = anchor.reinforcedSigilSvg ?? anchor.baseSigilSvg;

  // ── Glow breathe ────────────────────────────────────────────────────────────
  const glowOpacity = useSharedValue(0.5);
  useEffect(() => {
    if (reduceMotionEnabled) {
      glowOpacity.value = 0.5;
      return;
    }
    glowOpacity.value = withRepeat(
      withTiming(1.0, { duration: 5000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(glowOpacity);
  }, [reduceMotionEnabled, glowOpacity]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  // ── Press scale ──────────────────────────────────────────────────────────────
  const pressScale = useSharedValue(1);
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  useEffect(() => () => cancelAnimation(pressScale), [pressScale]);

  const onPressIn = () => {
    if (reduceMotionEnabled) return;
    pressScale.value = withTiming(0.97, { duration: 120, easing: Easing.out(Easing.quad) });
  };
  const onPressOut = () => {
    pressScale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityLabel={`${anchorDisplayName(anchor)}: ${anchor.intentionText}`}
    >
      <Animated.View style={[styles.heroWrap, cardStyle]}>
        {/* ── Circle image/sigil ── */}
        <View style={styles.circleOuter}>
          {/* Glow behind circle */}
          <Animated.View style={[styles.glowBackdrop, glowStyle]} />

          <View style={styles.circleClip}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.circleImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.sigilFallback}>
                <SvgXml xml={sigilSvg} width={CIRCLE_SIZE * 0.55} height={CIRCLE_SIZE * 0.55} />
              </View>
            )}
            {/* Inner glow ring overlay */}
            <View style={styles.innerGlowRing} pointerEvents="none" />
          </View>

          {/* Charged badge */}
          {anchor.isCharged && (
            <View style={styles.chargedBadge}>
              <View style={styles.badgeDot} />
              <Text style={styles.badgeText}>CHARGED</Text>
            </View>
          )}
        </View>

        {/* ── Text info below circle ── */}
        <View style={styles.textInfo}>
          <Text style={styles.intention} numberOfLines={1}>
            &ldquo;{anchor.intentionText}&rdquo;
          </Text>
          <View style={styles.nameRow}>
            <Text style={styles.anchorName}>{anchorDisplayName(anchor)}</Text>
            <View style={styles.categoryTag}>
              <Text style={styles.categoryLabel}>{formatCategory(anchor.category)}</Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  heroWrap: {
    alignItems: 'center',
  },
  circleOuter: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowBackdrop: {
    position: 'absolute',
    width: CIRCLE_SIZE + 30,
    height: CIRCLE_SIZE + 30,
    borderRadius: (CIRCLE_SIZE + 30) / 2,
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  circleClip: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: '#0d1117',
  },
  circleImage: {
    width: '100%',
    height: '100%',
  },
  sigilFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d1117',
  },
  innerGlowRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    borderColor: 'rgba(212,175,55,0.1)',
  },
  chargedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.4)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    elevation: 8,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.gold,
    shadowColor: colors.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 4,
  },
  badgeText: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 1.8,
    color: colors.gold,
    textTransform: 'uppercase',
  },
  textInfo: {
    marginTop: 12,
    alignItems: 'center',
    width: '100%',
  },
  intention: {
    fontFamily: 'CormorantGaramond-Italic',
    fontSize: 13,
    color: 'rgba(192,192,192,0.55)',
    marginBottom: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  anchorName: {
    fontFamily: 'Cinzel-Medium',
    fontSize: 16,
    color: colors.bone,
    letterSpacing: 0.8,
  },
  categoryTag: {
    backgroundColor: 'rgba(62,44,91,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  categoryLabel: {
    fontFamily: 'Cinzel-Regular',
    fontSize: 9,
    letterSpacing: 1.5,
    color: 'rgba(212,175,55,0.7)',
    textTransform: 'uppercase',
  },
});
